import { useLanguage } from '../../i18n/LanguageContext';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, ErrorMessage } from './Controls.jsx';
import { deleteDispatch, request } from '../../lib/pilotApi.js';
import { buyerExcel, driverPdf } from '../../utils/pilotExports.js';
import { runExclusive, shareOrDownload } from '../../utils/shareFiles.js';
import { billFilename } from '../../utils/ledgerPdf.js';
import { a4InvoiceFromDispatch } from '../../utils/a4InvoiceModel.js';
import { paginateA4Invoice } from '../../utils/a4InvoicePagination.js';
import { renderA4Invoice, renderStandaloneA4Invoice } from '../../utils/a4InvoiceRender.js';
import { a4InvoicePdf } from '../../utils/a4InvoicePdf.js';
import { startPrint, printToWindow } from '../../utils/printInvoice.js';
import invoiceCss from '../../styles/a4Invoice.css?raw';
import Icon from './Icon.jsx';
import PaymentSection from './PaymentSection.jsx';
export default function BillView({ record, onBack, onResume, onEdit, onChanged, onDeleted, canFinalize = true, admin = false }) {
  const { pick, language } = useLanguage();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [documentType, setDocumentType] = useState('invoice');
  const [confirming, setConfirming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [exportWarnings, setExportWarnings] = useState([]);
  const [printFallback, setPrintFallback] = useState(false);
  const [invoiceState, setInvoiceState] = useState(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const previewId = useId();
  const historyPreviewId = `${previewId}-history`;
  // Version history: keyed by record identity so a revised/other record resets the selection.
  const historyKey = `${record.id}:${record.updatedAt || ''}`;
  const [historySelection, setHistorySelection] = useState(null);
  const [historyState, setHistoryState] = useState(null);
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
  const showHistory = admin && finalized && Array.isArray(record.revisions) && record.revisions.length > 0;
  // Most recent first; keep the stored index so keys/selection stay stable.
  const versions = useMemo(() => !showHistory ? [] : record.revisions
    .map((snapshot, index) => ({ snapshot, index, time: Date.parse(snapshot?.revisedAt) }))
    .sort((a, b) => (Number.isFinite(b.time) ? b.time : -Infinity) - (Number.isFinite(a.time) ? a.time : -Infinity) || b.index - a.index),
  [showHistory, record.revisions]);
  const versionTime = useMemo(() => {
    const format = new Intl.DateTimeFormat(language === 'te' ? 'te-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
    return value => { const time = Date.parse(value); return Number.isFinite(time) ? format.format(time) : pick('Unknown time', 'తెలియని సమయం'); };
  }, [language, pick]);
  const selectedVersion = showHistory && historySelection?.key === historyKey ? versions.find(version => version.index === historySelection.index) || null : null;
  const selectedVersionKey = selectedVersion ? `${historyKey}:${selectedVersion.index}` : '';
  const historyCurrent = historyState?.key === selectedVersionKey ? historyState : null;
  const historyHtml = useMemo(() => historyCurrent?.preview ? renderA4Invoice(historyCurrent.preview.model, historyCurrent.preview.pages, historyPreviewId, pick) : '', [historyCurrent, historyPreviewId, pick]);
  useEffect(() => {
    if (!selectedVersion) return;
    let live = true;
    // Prior versions render from the stored snapshot; slip number, id and status never change across revisions.
    const source = { ...selectedVersion.snapshot, id: record.id, dispatchSlipNumber: record.dispatchSlipNumber, status: record.status };
    Promise.resolve().then(() => a4InvoiceFromDispatch(source)).then(model => paginateA4Invoice(model, document, pick))
      .then(result => { if (live) setHistoryState({ key: selectedVersionKey, preview: result, issue: '' }); })
      .catch(err => { if (live) setHistoryState({ key: selectedVersionKey, preview: null, issue: err?.message || String(err) }); });
    return () => { live = false; };
  }, [selectedVersion, selectedVersionKey, record.id, record.dispatchSlipNumber, record.status, layoutVersion, pick]);
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
  function resetExportFeedback() { setExportError(''); setExportNotice(''); setExportWarnings([]); setPrintFallback(false); }
  // Print/PDF: everything up to window.open runs synchronously in the click
  // handler (no await before it) so popup blockers treat it as user-initiated.
  async function printInvoice() {
    if (lock.current) return;
    lock.current = true; setBusy(true); resetExportFeedback();
    let printWindow = null;
    try {
      let start;
      try {
        start = startPrint({ record, buildModel: a4InvoiceFromDispatch, openWindow: () => window.open('', '_blank') });
      } catch (err) {
        setExportError(pick(`The invoice could not be prepared for printing. ${err?.message || ''}`.trim(), `ప్రింట్ కోసం బిల్లును సిద్ధం చేయలేకపోయాం. ${err?.message || ''}`.trim()));
        return;
      }
      if (start.status === 'warnings') { setExportWarnings(start.warnings); return; }
      if (start.status === 'blocked') {
        setExportError(pick('The browser blocked the print window. Allow pop-ups for this site and try again, or download the HTML invoice and print it offline.', 'బ్రౌజర్ ప్రింట్ విండోను అడ్డుకుంది. ఈ సైట్‌కు పాప్-అప్‌లను అనుమతించి మళ్లీ ప్రయత్నించండి, లేదా HTML బిల్లును డౌన్‌లోడ్ చేసి ఆఫ్‌లైన్‌లో ప్రింట్ చేయండి.'));
        setPrintFallback(true);
        return;
      }
      printWindow = start.printWindow;
      const paginated = await paginateA4Invoice(start.model, document, pick);
      const html = renderStandaloneA4Invoice(paginated.model, paginated.pages, invoiceCss, pick);
      await printToWindow(printWindow, html);
      setExportNotice(pick('In the print dialog, choose A4, 100% scale, background graphics on and browser headers/footers off. Choose Save as PDF if needed.', 'ప్రింట్ డైలాగ్‌లో A4, 100% స్కేలు, నేపథ్య చిత్రాలు ఆన్, బ్రౌజర్ హెడ్డర్/ఫూటర్ ఆఫ్ ఎంచుకోండి. అవసరమైతే PDFగా సేవ్ చేయండి.'));
    } catch (err) {
      try { if (printWindow && !printWindow.closed) printWindow.close(); } catch { /* window already gone */ }
      const detail = err?.message ? ` (${err.message})` : '';
      setExportError(pick(`Printing did not complete. Your invoice is unchanged; you can try again.${detail}`, `ప్రింట్ పూర్తి కాలేదు. మీ బిల్లు మారలేదు; మళ్లీ ప్రయత్నించవచ్చు.${detail}`));
    } finally { lock.current = false; setBusy(false); }
  }
  // Download or share one document. The in-flight lock blocks a second
  // concurrent export/share/print. Share outcomes: 'shared' → done,
  // 'cancelled' → silent no-op, 'unsupported' → download + notice.
  function exportFile(kind, share = false) {
    return runExclusive(lock, async () => {
      setBusy(true); resetExportFeedback();
      try {
        const data = record;
        let output;
        if (kind === 'invoice') {
          // Same prepared model and row packing as the A4 preview, drawn as a vector PDF.
          const model = a4InvoiceFromDispatch(data);
          if (model.warnings.length) { setExportWarnings(model.warnings); return; }
          output = a4InvoicePdf(model, billFilename(data, 'Invoice', 'pdf'));
        } else if (kind === 'html') {
          const model = a4InvoiceFromDispatch(data);
          if (model.warnings.length) { setExportWarnings(model.warnings); return; }
          const paginated = await paginateA4Invoice(model, document, pick);
          const html = renderStandaloneA4Invoice(paginated.model, paginated.pages, invoiceCss, pick);
          output = { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), filename: billFilename(data, 'Invoice', 'html') };
        } else if (kind === 'excel') output = buyerExcel(data);
        else if (kind === 'driver') output = driverPdf(data);
        else throw new Error(`Unknown export type: ${kind}`);
        if (!share) { download(output); return; }
        const title = record.businessSnapshot?.businessName || pick('Load bill', 'లోడ్ బిల్లు');
        const outcome = await shareOrDownload(output, { title, text: pick('Load bill', 'లోడ్ బిల్లు'), download });
        if (outcome === 'unsupported') setExportNotice(pick('Sharing isn’t available in this browser, so the document was downloaded instead. Attach it from your downloads.', 'ఈ బ్రౌజర్‌లో షేర్ అందుబాటులో లేదు, కాబట్టి పత్రం డౌన్‌లోడ్ అయింది. డౌన్‌లోడ్‌ల నుండి జత చేయండి.'));
      } catch (err) {
        const detail = err?.message ? ` (${err.message})` : '';
        setExportError(share
          ? pick(`The document could not be shared. Your invoice is unchanged; you can try again or download it.${detail}`, `పత్రాన్ని షేర్ చేయలేకపోయాం. మీ బిల్లు మారలేదు; మళ్లీ ప్రయత్నించండి లేదా డౌన్‌లోడ్ చేయండి.${detail}`)
          : pick(`The document could not be downloaded. Your invoice is unchanged; you can try again.${detail}`, `పత్రాన్ని డౌన్‌లోడ్ చేయలేకపోయాం. మీ బిల్లు మారలేదు; మళ్లీ ప్రయత్నించవచ్చు.${detail}`));
      } finally { setBusy(false); }
    });
  }
  async function delivered() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { onChanged(await request(`/dispatches/${record.id}/status`, { method: 'PATCH', body: { status: 'Delivered' } })); setConfirming(false); }
    catch (err) { setError(err.message); } finally { lock.current = false; setBusy(false); }
  }
  // Admin-only; the API enforces the role too. Only runs after the explicit confirm step.
  async function removeInvoice() {
    if (!admin || lock.current) return;
    lock.current = true; setBusy(true); setDeleteError('');
    try {
      await deleteDispatch(record.id);
      setConfirmingDelete(false);
      onDeleted?.(record.id);
    } catch (err) {
      setDeleteError(err.status === 409
        ? pick('This invoice has payments recorded. Remove those payments first, then delete it.', 'ఈ బిల్లుకు చెల్లింపులు నమోదయ్యాయి. ముందుగా ఆ చెల్లింపులను తొలగించి, తర్వాత బిల్లును తొలగించండి.')
        : err.status === 403
          ? pick('You are not permitted to delete this invoice.', 'ఈ బిల్లును తొలగించడానికి మీకు అనుమతి లేదు.')
          : err.message);
      setConfirmingDelete(false);
    } finally { lock.current = false; setBusy(false); }
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
            ['invoice', pick('Buyer invoice', 'కొనుగోలుదారు బిల్లు'), pick('Approved A4 layout', 'ఆమోదిత A4 నమూనా'), 'PDF', ''],
            ['html', pick('Buyer invoice · web copy', 'కొనుగోలుదారు బిల్లు · వెబ్ కాపీ'), pick('Opens offline in any browser', 'ఏ బ్రౌజర్‌లోనైనా ఆఫ్‌లైన్‌లో తెరుచుకుంటుంది'), 'HTML', ''],
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
          <p className="invoice-export-help">{pick('The buyer invoice PDF and Print / PDF both use the approved A4 layout. The web copy works offline and includes the saved logo.', 'కొనుగోలుదారు బిల్లు PDF మరియు ప్రింట్ / PDF రెండూ ఆమోదిత A4 నమూనాను వాడతాయి. వెబ్ కాపీ ఆఫ్‌లైన్‌లో పని చేస్తుంది, సేవ్ చేసిన లోగో ఉంటుంది.')}</p>
          <div className="invoice-export-feedback" aria-live="polite">
            {exportWarnings.length > 0 && <div role="alert" className="control-error"><strong>{pick('Export is paused. Review these invoice values first:', 'ఎగుమతి ఆపబడింది. ముందుగా ఈ బిల్లు విలువలను తనిఖీ చేయండి:')}</strong><ul>{exportWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
            {exportError ? <ErrorMessage error={exportError} /> : exportNotice && <p className="invoice-export-notice">{exportNotice}</p>}
            {printFallback && <div className="action-row"><Button disabled={busy} en="Download HTML invoice" te="HTML బిల్లు డౌన్‌లోడ్ చేయండి" onClick={() => exportFile('html')} /></div>}
          </div>
          <div className="action-row"><Button disabled={busy} en="Print / PDF" te="ప్రింట్ / PDF" onClick={printInvoice} /><Button disabled={busy} en="Download" te="డౌన్‌లోడ్" onClick={() => exportFile(documentType)} /><Button primary disabled={busy} en={busy ? 'Preparing…' : 'Share document'} te={busy ? 'సిద్ధం అవుతోంది…' : 'పత్రం షేర్ చేయండి'} onClick={() => exportFile(documentType, true)}><Icon name="arrow" /></Button></div>
        </footer>
      </section>
      {admin && onEdit && <section className="invoice-admin-edit flex flex-col gap-3 border-t border-base-300 pt-5 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="invoice-edit-title">
        <div className="min-w-0">
          <h2 id="invoice-edit-title" className="text-base font-semibold">{pick('Edit invoice', 'బిల్లు మార్చండి')}</h2>
          <p className="text-sm opacity-70">{pick('Admins only. Correct measurements, prices or details. The slip number stays the same and the current version is kept in history.', 'అడ్మిన్‌లకు మాత్రమే. కొలతలు, ధరలు లేదా వివరాలు సరిచేయండి. స్లిప్ నంబర్ మారదు, ప్రస్తుత వెర్షన్ చరిత్రలో ఉంటుంది.')}</p>
        </div>
        <div className="action-row shrink-0"><Button disabled={busy} en="Edit invoice" te="బిల్లు మార్చండి" onClick={() => onEdit(record)} /></div>
      </section>}
      {showHistory && <section className="invoice-admin-history flex flex-col gap-3 border-t border-base-300 pt-5" aria-labelledby="invoice-history-title">
        <div className="min-w-0">
          <h2 id="invoice-history-title" className="text-base font-semibold">{pick('Version history', 'వెర్షన్ చరిత్ర')}</h2>
          <p className="text-sm opacity-70">{pick('Admins only. Earlier versions of this invoice, most recent first. They are read-only.', 'అడ్మిన్‌లకు మాత్రమే. ఈ బిల్లు పాత వెర్షన్లు, తాజావి ముందు. వీటిని చూడటం మాత్రమే సాధ్యం.')}</p>
        </div>
        <ul className="flex flex-col divide-y divide-base-300 border-y border-base-300">
          {versions.map(version => {
            const active = selectedVersion?.index === version.index;
            return <li key={version.index} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate text-sm">{versionTime(version.snapshot?.revisedAt)}</span>
              <button type="button" className="text-button shrink-0 text-sm" aria-pressed={active} disabled={busy} onClick={() => setHistorySelection(active ? null : { key: historyKey, index: version.index })}>
                {active ? pick('Hide', 'దాచండి') : pick('View', 'చూడండి')}
              </button>
            </li>;
          })}
        </ul>
        {selectedVersion && <div className="flex flex-col gap-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <strong className="min-w-0 text-sm">{pick(`Version from ${versionTime(selectedVersion.snapshot?.revisedAt)} (read-only)`, `${versionTime(selectedVersion.snapshot?.revisedAt)} నాటి వెర్షన్ (చూడటానికి మాత్రమే)`)}</strong>
            <button type="button" className="text-button shrink-0 text-sm" onClick={() => setHistorySelection(null)}>{pick('Close', 'మూసివేయండి')}</button>
          </div>
          <div className="invoice-paper-shell a4-preview-shell">
            {historyCurrent?.issue ? <p className="a4-preview-feedback" role="alert">{historyCurrent.issue}</p>
              : historyCurrent?.preview ? <>{historyCurrent.preview.model.warnings.length > 0 && <div className="a4-preview-feedback" role="alert"><strong>{pick('This earlier version has values that need review.', 'ఈ పాత వెర్షన్‌లోని విలువలను తనిఖీ చేయాలి.')}</strong><ul>{historyCurrent.preview.model.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}<div dangerouslySetInnerHTML={{ __html: historyHtml }} /></>
                : <p className="a4-preview-feedback">{pick('Preparing this earlier version…', 'ఈ పాత వెర్షన్‌ను సిద్ధం చేస్తున్నాం…')}</p>}
          </div>
        </div>}
      </section>}
      {admin && <section className="invoice-admin-delete flex flex-col gap-3 border-t border-base-300 pt-5 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="invoice-delete-title" data-state={confirmingDelete ? 'confirming' : 'idle'}>
        <div className="min-w-0" aria-live="polite">
          <h2 id="invoice-delete-title" className="text-base font-semibold">{confirmingDelete ? pick('Delete this invoice?', 'ఈ బిల్లును తొలగించాలా?') : pick('Delete invoice', 'బిల్లును తొలగించండి')}</h2>
          <p className="text-sm opacity-70">{confirmingDelete ? pick('It will be removed from your loads. This can’t be undone.', 'ఇది మీ లోడ్‌ల నుండి తొలగించబడుతుంది. దీన్ని మార్చలేరు.') : pick('Admins only. Invoices with recorded payments can’t be deleted.', 'అడ్మిన్‌లకు మాత్రమే. చెల్లింపులు నమోదైన బిల్లులను తొలగించలేరు.')}</p>
          <ErrorMessage error={deleteError} />
        </div>
        <div className="action-row shrink-0">
          {confirmingDelete
            ? <><Button disabled={busy} en="Keep invoice" te="బిల్లు ఉంచండి" onClick={() => setConfirmingDelete(false)} /><Button primary disabled={busy} en={busy ? 'Deleting…' : 'Yes, delete'} te={busy ? 'తొలగిస్తోంది…' : 'అవును, తొలగించండి'} onClick={removeInvoice} /></>
            : <Button disabled={busy} en="Delete invoice" te="బిల్లును తొలగించండి" onClick={() => { setDeleteError(''); setConfirmingDelete(true); }} />}
        </div>
      </section>}
    </> : <div className="invoice-draft-action"><Button primary disabled={busy} en="Continue this draft" te="డ్రాఫ్ట్ కొనసాగించండి" onClick={() => onResume(record)}><Icon name="arrow" /></Button></div>}
  </div>;
}
