import { useLanguage } from '../../i18n/LanguageContext';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, ErrorMessage } from './Controls.jsx';
import { request } from '../../lib/pilotApi.js';
import { buyerPdf, buyerExcel, driverPdf } from '../../utils/pilotExports.js';
import { shareFiles } from '../../utils/shareFiles.js';
import { billFilename } from '../../utils/ledgerPdf.js';
import { a4InvoiceFromDispatch } from '../../utils/a4InvoiceModel.js';
import { paginateA4Invoice } from '../../utils/a4InvoicePagination.js';
import { renderA4Invoice, renderStandaloneA4Invoice } from '../../utils/a4InvoiceRender.js';
import invoiceCss from '../../styles/a4Invoice.css?raw';
import Icon from './Icon.jsx';
import PaymentSection from './PaymentSection.jsx';
export default function BillView({ record, onBack, onResume, onChanged, canFinalize = true }) {
  const { pick } = useLanguage();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [documentType, setDocumentType] = useState('html');
  const [confirming, setConfirming] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [invoiceState, setInvoiceState] = useState(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const previewId = useId();
  const lock = useRef(false);
  const finalized = record.status !== 'Draft';
  const invoiceKey = `${record.id}:${record.status}`;
  const currentInvoice = invoiceState?.key === invoiceKey ? invoiceState : null;
  // PilotApp only passes complete records (GET by id or a save/finalize/status
  // response), so the bill never needs to be fetched again here.
  const invoiceSource = finalized ? record : null;
  const preview = currentInvoice?.preview;
  const previewIssue = currentInvoice?.issue || '';
  const destination = record.logistics?.buyerDestination;
  const invoiceHtml = useMemo(() => preview ? renderA4Invoice(preview.model, preview.pages, previewId, pick) : '', [preview, previewId, pick]);
  useEffect(() => {
    const refresh = () => setLayoutVersion(version => version + 1);
    window.addEventListener('resize', refresh);
    document.fonts?.addEventListener?.('loadingdone', refresh);
    return () => { window.removeEventListener('resize', refresh); document.fonts?.removeEventListener?.('loadingdone', refresh); };
  }, []);
  useEffect(() => {
    if (!invoiceSource) return;
    let live = true;
    Promise.resolve().then(() => a4InvoiceFromDispatch(invoiceSource)).then(model => paginateA4Invoice(model, document, pick))
      .then(result => {
        if (live) setInvoiceState({ key: invoiceKey, preview: result, issue: '' });
      }).catch(err => {
        if (live) setInvoiceState({ key: invoiceKey, preview: null, issue: err.message });
      });
    return () => { live = false; };
  }, [invoiceSource, invoiceKey, layoutVersion, pick]);
  function download(output) {
    const url = URL.createObjectURL(output.blob);
    const a = document.createElement('a'); a.href = url; a.download = output.filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function exportFile(kind, share = false) {
    if (lock.current) return; lock.current = true; setBusy(true); setExportError(''); setExportNotice('');
    // Open immediately from the user's gesture; asynchronous fetch/pagination
    // must not trigger a browser popup blocker before the print window exists.
    const printWindow = kind === 'print' ? window.open('', '_blank') : null;
    try {
      if (kind === 'print' && !printWindow) throw new Error('Allow pop-ups to print, or download the HTML invoice and print it offline.');
      const data = record;
      let output;
      if (kind === 'html' || kind === 'print') {
        const model = a4InvoiceFromDispatch(data);
        if (model.warnings.length) throw new Error(`Invoice data needs review before printing or sharing: ${model.warnings.slice(0, 3).join(' ')}`);
        const paginated = await paginateA4Invoice(model, document, pick);
        const html = renderStandaloneA4Invoice(paginated.model, paginated.pages, invoiceCss, pick);
        if (kind === 'print') {
          printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
          await printWindow.document.fonts.ready;
          await Promise.all([...printWindow.document.images].map(image => image.decode().catch(() => {})));
          printWindow.focus(); printWindow.print();
          setExportNotice(pick('In the print dialog, choose A4, 100% scale, background graphics on and browser headers/footers off. Choose Save as PDF if needed.', 'ప్రింట్ డైలాగ్‌లో A4, 100% స్కేలు, నేపథ్య చిత్రాలు ఆన్, బ్రౌజర్ హెడ్డర్/ఫూటర్ ఆఫ్ ఎంచుకోండి. అవసరమైతే PDFగా సేవ్ చేయండి.'));
          return;
        }
        output = { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), filename: billFilename(data, 'Invoice', 'html') };
      } else output = kind === 'excel' ? buyerExcel(data) : kind === 'driver' ? driverPdf(data) : buyerPdf(data);
      if (!share) download(output);
      else if (await shareFiles([new File([output.blob], output.filename, { type: output.blob.type })], record.businessSnapshot?.businessName || 'Load bill', 'Load bill') === 'unsupported') {
        download(output);
        setExportNotice(pick('This browser can’t share files, so the document was downloaded instead. Attach it from your downloads.', 'ఈ బ్రౌజర్ ఫైళ్లను షేర్ చేయలేదు, కాబట్టి పత్రం డౌన్‌లోడ్ అయింది. డౌన్‌లోడ్‌ల నుండి జత చేయండి.'));
      }
    } catch (err) { if (printWindow && !printWindow.closed) printWindow.close(); setExportError(err.message); } finally { lock.current = false; setBusy(false); }
  }
  async function delivered() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { onChanged(await request(`/dispatches/${record.id}/status`, { method: 'PATCH', body: { status: 'Delivered' } })); setConfirming(false); }
    catch (err) { setError(err.message); } finally { lock.current = false; setBusy(false); }
  }
  return <div className="bill-screen space-y-6">
    <div className="screen-heading invoice-screen-heading"><div><h1>{finalized ? pick('Load bill', 'లోడ్ బిల్లు') : pick('Saved draft', 'సేవ్ చేసిన డ్రాఫ్ట్')}</h1><p className="truncate">{finalized ? pick('Check the totals, then download or share.', 'మొత్తాలు చూసి, డౌన్‌లోడ్ లేదా షేర్ చేయండి.') : pick('Not final yet. Continue to finish this bill.', 'ఇంకా పూర్తి కాలేదు. కొనసాగించండి.')}</p></div><button type="button" className="text-button inline-flex items-center gap-1.5" disabled={busy} onClick={onBack}><Icon name="back" className="h-4 w-4" />{pick('Back to dashboard', 'డ్యాష్‌బోర్డ్‌కు వెళ్ళండి')}</button></div>
    <ErrorMessage error={error} />
    {record.status === 'Dispatched' && <section className="delivery-bar" data-state={confirming ? 'confirming' : 'transit'} aria-label={pick('Delivery status', 'డెలివరీ స్థితి')}>
      <span className="delivery-bar-dot" aria-hidden="true" />
      <div className="delivery-bar-text" aria-live="polite">
        <strong>{confirming ? pick('Has this load reached its destination?', 'ఈ లోడ్ గమ్యస్థానానికి చేరిందా?') : pick('In transit', 'దారిలో ఉంది')}</strong>
        <span>{confirming ? pick('This can’t be undone.', 'దీన్ని మార్చలేరు.') : destination ? pick(`On the way to ${destination}`, `${destination}కు వెళ్తోంది`) : pick('Waiting for delivery confirmation', 'డెలివరీ నిర్ధారణ కోసం వేచి ఉంది')}</span>
      </div>
      {canFinalize && <div className="delivery-bar-actions">
        {confirming
          ? <><Button disabled={busy} en="Not yet" te="ఇంకా లేదు" onClick={() => setConfirming(false)} /><Button primary disabled={busy} en={busy ? 'Saving…' : 'Yes, delivered'} te={busy ? 'సేవ్ అవుతోంది…' : 'అవును, చేరింది'} onClick={delivered} /></>
          : <Button disabled={busy} en="Mark delivered" te="డెలివరీ పూర్తయింది" onClick={() => setConfirming(true)} />}
      </div>}
    </section>}
    {record.status === 'Delivered' && <section className="delivery-bar" data-state="delivered" aria-label={pick('Delivery status', 'డెలివరీ స్థితి')}>
      <span className="delivery-bar-dot" aria-hidden="true" />
      <div className="delivery-bar-text"><strong>{pick('Delivered', 'డెలివరీ అయింది')}</strong>{destination && <span>{pick(`Reached ${destination}`, `${destination}కు చేరింది`)}</span>}</div>
    </section>}
    {finalized && <PaymentSection dispatchId={record.id} canRecordPayment={canFinalize} />}
    <div className="invoice-paper-shell a4-preview-shell" aria-live="polite">
      {!finalized ? <p className="a4-preview-feedback">{pick('Complete this draft to see the final A4 invoice. Missing data is never replaced with sample values.', 'చివరి A4 బిల్లు చూడటానికి డ్రాఫ్ట్‌ను పూర్తి చేయండి. లేని సమాచారాన్ని నమూనా విలువలతో నింపము.')}</p>
        : previewIssue ? <p className="a4-preview-feedback" role="alert">{previewIssue}</p>
          : preview ? <>{preview.model.warnings.length > 0 && <div className="a4-preview-feedback" role="alert"><strong>{pick('Saved invoice values need review before export.', 'సేవ్ చేసిన బిల్లు విలువలను ఎగుమతికి ముందు తనిఖీ చేయండి.')}</strong><ul>{preview.model.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}<div dangerouslySetInnerHTML={{ __html: invoiceHtml }} /></>
            : <p className="a4-preview-feedback">{pick('Preparing the saved A4 invoice…', 'సేవ్ చేసిన A4 బిల్లును సిద్ధం చేస్తున్నాం…')}</p>}
    </div>
    {finalized ? <>
      <section className="invoice-export-panel" aria-labelledby="invoice-export-title">
        <header className="invoice-export-intro"><h2 id="invoice-export-title">{pick('Export & share', 'ఎగుమతి మరియు షేర్')}</h2><p>{pick('Pick a copy, then share or download it.', 'పత్రం ఎంచుకుని షేర్ లేదా డౌన్‌లోడ్ చేయండి.')}</p></header>
        <fieldset className="invoice-export-options" disabled={busy}>
          <legend className="sr-only">{pick('Document', 'పత్రం')}</legend>
          {[
            ['html', pick('Buyer invoice', 'కొనుగోలుదారు బిల్లు'), pick('Approved A4 layout · portable offline file', 'ఆమోదిత A4 నమూనా · ఆఫ్‌లైన్ ఫైల్'), 'HTML', ''],
            ['pdf', pick('Previous buyer PDF', 'మునుపటి కొనుగోలుదారు PDF'), pick('Legacy layout for existing downloads', 'పాత డౌన్‌లోడ్ లేఅవుట్'), 'PDF', ''],
            ['excel', pick('Buyer bill', 'కొనుగోలుదారు బిల్లు'), pick('Editable spreadsheet', 'మార్చగల స్ప్రెడ్‌షీట్'), 'XLSX', ''],
            ['driver', pick('Driver slip', 'డ్రైవర్ స్లిప్'), pick('Measurements only', 'కొలతలు మాత్రమే'), 'PDF', pick('No prices', 'ధరలు లేవు')],
          ].map(([value, title, meta, format, tag]) => (
            <label key={value} className="invoice-export-option">
              <input type="radio" name="invoice-export-document" value={value} checked={documentType === value} onChange={() => setDocumentType(value)} />
              <span className="export-option-text"><span className="export-option-title">{title}{tag && <span className="export-option-tag">{tag}</span>}</span><span className="export-option-meta">{meta}</span></span>
              <span className="export-option-format">{format}</span>
            </label>
          ))}
        </fieldset>
        <footer className="invoice-export-footer">
          <p className="invoice-export-help">{pick('Print / PDF uses the approved A4 layout. The older PDF option keeps its previous layout. HTML works offline and includes the saved logo.', 'ప్రింట్ / PDF ఆమోదిత A4 నమూనాను వాడుతుంది. పాత PDF ఎంపిక పాత నమూనాలోనే ఉంటుంది. HTML ఆఫ్‌లైన్‌లో పని చేస్తుంది, సేవ్ చేసిన లోగో ఉంటుంది.')}</p>
          {(exportError || exportNotice) && <div className="invoice-export-feedback" aria-live="polite">{exportError ? <ErrorMessage error={exportError} /> : <p className="invoice-export-notice">{exportNotice}</p>}</div>}
          <div className="action-row"><Button disabled={busy} en="Print / PDF" te="ప్రింట్ / PDF" onClick={() => exportFile('print')} /><Button disabled={busy} en="Download" te="డౌన్‌లోడ్" onClick={() => exportFile(documentType)} /><Button primary disabled={busy} en={busy ? 'Preparing…' : 'Share document'} te={busy ? 'సిద్ధం అవుతోంది…' : 'పత్రం షేర్ చేయండి'} onClick={() => exportFile(documentType, true)}><Icon name="arrow" /></Button></div>
        </footer>
      </section>
    </> : <div className="invoice-draft-action"><Button primary disabled={busy} en="Continue this draft" te="డ్రాఫ్ట్ కొనసాగించండి" onClick={() => onResume(record)}><Icon name="arrow" /></Button></div>}
  </div>;
}
