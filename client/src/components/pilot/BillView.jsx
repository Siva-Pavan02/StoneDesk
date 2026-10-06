import { useLanguage } from '../../i18n/LanguageContext';
import React, { useRef, useState } from 'react';
import { Button, Card, ErrorMessage, Field } from './Controls.jsx';
import { request } from '../../lib/pilotApi.js';
import LoadSummary from './LoadSummary.jsx';
import { billRows } from '../../utils/billData.js';
import { buyerPdf, buyerExcel, driverPdf } from '../../utils/pilotExports.js';
import { shareFiles } from '../../utils/shareFiles.js';
export default function BillView({ record, onBack, onResume, onChanged, canFinalize = true }) {
  const { pick, t } = useLanguage();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [documentType, setDocumentType] = useState('pdf');
  const lock = useRef(false);
  const finalized = record.status !== 'Draft';
  const rows = billRows(record);
  async function exportFile(kind, share = false) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      const saved = await request(`/dispatches/${record._id}`);
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
    try { onChanged(await request(`/dispatches/${record._id}/status`, { method: 'PATCH', body: { status: 'Delivered' } })); }
    catch (err) { setError(err.message); } finally { lock.current = false; setBusy(false); }
  }
  return <div className="space-y-4">
    <div><h1 className="text-2xl font-bold">{finalized ? pick('Load bill', 'లోడ్ బిల్లు') : pick('Saved draft', 'సేవ్ చేసిన డ్రాఫ్ట్')}</h1></div>
    <ErrorMessage error={error} />
    <Card className="gap-2">
      {record.businessSnapshot?.logoDataUrl && <img src={record.businessSnapshot.logoDataUrl} alt="Bill business logo" className="h-20 w-20 object-contain" />}
      <h2 className="font-bold text-xl break-words">{record.businessSnapshot?.businessName || 'GraniteSync'}</h2>
      <p className="break-words">{record.businessSnapshot?.address} {record.businessSnapshot?.phone}</p>
      <p className="text-xs break-all text-gray-700">{record.dispatchSlipNumber}</p>
      <strong className="break-words">{record.partyName || 'Legacy load'} · {t(record.status.toLowerCase())}</strong>
      <p>{record.logistics.truckNumber} · {new Date(record.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
      <p className="break-words">{record.logistics.buyerDestination} · {record.supervisor}</p>
    </Card>
    {rows.map((r, i) => <Card key={i} className="gap-1"><strong className="break-words">{r.stoneType} · {r.finish} · {pick(r.category, r.category === 'TOP' ? 'టాప్' : 'సాధారణ')}</strong><p>{r.lengthFt} × {r.widthFt} {pick('ft', 'అడుగులు')} × {r.quantity} {pick('pieces', 'ముక్కలు')} = {r.sqFt.toFixed(2)} {pick('sq ft', 'చ.అ.')}</p></Card>)}
    <LoadSummary rows={rows} summary={record.summary} groups={record.inventory.every(g => !g.measurementRows?.length) ? record.inventory.map(g => ({ ...g, category: 'Regular', quantity: g.pieces.length, sqFt: g.totalSqFt ?? g.pieces.reduce((sum, p) => sum + p.sqFt, 0) })) : undefined} />
    {finalized ? <>
      <Card className="gap-4"><h2 className="font-bold text-lg">{pick('Export & share', 'ఎగుమతి మరియు షేర్')}</h2><Field en="Document" te="పత్రం"><select className="input rounded-xl" disabled={busy} value={documentType} onChange={e => setDocumentType(e.target.value)}><option value="pdf">{pick('Buyer bill · PDF', 'కొనుగోలుదారు బిల్లు · PDF')}</option><option value="excel">{pick('Buyer bill · Excel (.xlsx)', 'కొనుగోలుదారు బిల్లు · Excel (.xlsx)')}</option><option value="driver">{pick('Driver slip · PDF (no prices)', 'డ్రైవర్ స్లిప్ · PDF (ధరలు లేవు)')}</option></select></Field>
      <Button primary className="w-full" disabled={busy} en={busy ? 'Preparing…' : documentType === 'excel' ? 'Share Excel' : 'Share PDF'} te={busy ? 'సిద్ధం అవుతోంది…' : documentType === 'excel' ? 'Excel షేర్ చేయండి' : 'PDF షేర్ చేయండి'} onClick={() => exportFile(documentType, true)} />
      <Button className="w-full" disabled={busy} en={documentType === 'excel' ? 'Export Excel (.xlsx)' : 'Download PDF'} te={documentType === 'excel' ? 'Excel ఎగుమతి చేయండి' : 'PDF డౌన్‌లోడ్'} onClick={() => exportFile(documentType)} /></Card>
      <p className="text-sm text-gray-700">{pick('Driver slips hide prices. Choose WhatsApp from your phone’s share menu.', 'డ్రైవర్ స్లిప్‌లో ధరలు ఉండవు. ఫోన్ షేర్ మెనూలో WhatsApp ఎంచుకోండి.')}</p>
      {record.status === 'Dispatched' && canFinalize && <Button className="w-full" disabled={busy} en="Mark delivered" te="డెలివరీ పూర్తయింది" onClick={delivered} />}
    </> : <Button primary className="w-full" en="Continue this draft" te="డ్రాఫ్ట్ కొనసాగించండి" onClick={() => onResume(record)} />}
    <Button className="w-full" en="Back to home" te="హోమ్‌కు వెళ్ళండి" onClick={onBack} />
  </div>;
}
