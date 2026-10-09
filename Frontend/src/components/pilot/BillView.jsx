import { useLanguage } from '../../i18n/LanguageContext';
import React, { useRef, useState } from 'react';
import { Button, ErrorMessage, Field } from './Controls.jsx';
import { request } from '../../lib/pilotApi.js';
import { buyerPdf, buyerExcel, driverPdf } from '../../utils/pilotExports.js';
import { shareFiles } from '../../utils/shareFiles.js';
import InvoiceDocument from './InvoiceDocument.jsx';
import Icon from './Icon.jsx';
export default function BillView({ record, onBack, onResume, onChanged, canFinalize = true }) {
  const { pick } = useLanguage();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [documentType, setDocumentType] = useState('pdf');
  const lock = useRef(false);
  const finalized = record.status !== 'Draft';
  async function exportFile(kind, share = false) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      const saved = await request(`/dispatches/${record.id}`);
      const output = kind === 'excel' ? buyerExcel(saved) : kind === 'driver' ? driverPdf(saved) : buyerPdf(saved);
      if (share) await shareFiles([new File([output.blob], output.filename, { type: output.blob.type })], record.businessSnapshot?.businessName || 'Load bill', 'Load bill');
      else {
        const url = URL.createObjectURL(output.blob);
        const a = document.createElement('a'); a.href = url; a.download = output.filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch (err) { setError(err.message); } finally { lock.current = false; setBusy(false); }
  }
  async function delivered() {
    if (lock.current || !window.confirm(pick('Confirm this load has reached its destination?', 'ఈ లోడ్ గమ్యస్థానానికి చేరిందని నిర్ధారించాలా?'))) return;
    lock.current = true; setBusy(true); setError('');
    try { onChanged(await request(`/dispatches/${record.id}/status`, { method: 'PATCH', body: { status: 'Delivered' } })); }
    catch (err) { setError(err.message); } finally { lock.current = false; setBusy(false); }
  }
  return <div className="bill-screen space-y-6">
    <div className="screen-heading invoice-screen-heading"><div><h1>{finalized ? pick('Load bill', 'లోడ్ బిల్లు') : pick('Saved draft', 'సేవ్ చేసిన డ్రాఫ్ట్')}</h1><p>{pick('Business details, measurements and charges in one document.', 'వ్యాపార వివరాలు, కొలతలు మరియు ఛార్జీలు ఒకే పత్రంలో.')}</p></div><button type="button" className="text-button" disabled={busy} onClick={onBack}>{pick('Back to dashboard', 'డ్యాష్‌బోర్డ్‌కు వెళ్ళండి')}</button></div>
    <ErrorMessage error={error} />
    <div className="invoice-paper-shell"><InvoiceDocument record={record} /></div>
    {finalized ? <>
      <section className="invoice-export-panel" aria-labelledby="invoice-export-title">
        <div className="invoice-export-intro"><h2 id="invoice-export-title">{pick('Export & share', 'ఎగుమతి మరియు షేర్')}</h2><p>{pick('Choose the copy you need. Driver slips hide all prices.', 'మీకు కావలసిన పత్రం ఎంచుకోండి. డ్రైవర్ స్లిప్‌లో ధరలు ఉండవు.')}</p></div>
        <div className="invoice-export-controls"><Field en="Document" te="పత్రం"><select className="input" disabled={busy} value={documentType} onChange={e => setDocumentType(e.target.value)}><option value="pdf">{pick('Buyer bill · PDF', 'కొనుగోలుదారు బిల్లు · PDF')}</option><option value="excel">{pick('Buyer bill · Excel (.xlsx)', 'కొనుగోలుదారు బిల్లు · Excel (.xlsx)')}</option><option value="driver">{pick('Driver slip · PDF (no prices)', 'డ్రైవర్ స్లిప్ · PDF (ధరలు లేవు)')}</option></select></Field>
          <div className="action-row"><Button primary disabled={busy} en={busy ? 'Preparing…' : 'Share document'} te={busy ? 'సిద్ధం అవుతోంది…' : 'పత్రం షేర్ చేయండి'} onClick={() => exportFile(documentType, true)}><Icon name="arrow" /></Button><Button disabled={busy} en="Download" te="డౌన్‌లోడ్" onClick={() => exportFile(documentType)} /></div>
        </div>
        <p className="invoice-export-help">{pick('Choose WhatsApp from your phone’s share menu. Add a logo in Settings → Business for future bills; finalized bills retain their saved branding.', 'ఫోన్ షేర్ మెనూలో WhatsApp ఎంచుకోండి. కొత్త బిల్లుల కోసం సెట్టింగ్స్ → వ్యాపారంలో లోగో జోడించండి; ఖరారు చేసిన బిల్లుల్లో సేవ్ చేసిన వివరాలు ఉంటాయి.')}</p>
      </section>
      {record.status === 'Dispatched' && canFinalize && <div className="invoice-delivery-action"><p>{pick('Confirm delivery only after the load reaches its destination.', 'లోడ్ గమ్యస్థానానికి చేరిన తర్వాత మాత్రమే డెలివరీ నిర్ధారించండి.')}</p><Button disabled={busy} en="Mark delivered" te="డెలివరీ పూర్తయింది" onClick={delivered} /></div>}
    </> : <div className="invoice-draft-action"><Button primary disabled={busy} en="Continue this draft" te="డ్రాఫ్ట్ కొనసాగించండి" onClick={() => onResume(record)}><Icon name="arrow" /></Button></div>}
  </div>;
}
