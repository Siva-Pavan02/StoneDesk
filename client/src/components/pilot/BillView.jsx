import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState } from 'react';
import { Button, Card, ErrorMessage } from './Controls.jsx';
import LoadSummary from './LoadSummary.jsx';
import { billRows } from '../../utils/billData.js';
import { buyerPdf, buyerExcel, driverPdf } from '../../utils/pilotExports.js';
import { shareFiles } from '../../utils/shareFiles.js';
export default function BillView({ record, onBack, onResume }) {
  const { pick, t } = useLanguage();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const finalized = record.status !== 'Draft';
  const rows = billRows(record);
  async function exportFile(kind, share = false) {
    if (busy) return; setBusy(true); setError('');
    try {
      const output = kind === 'excel' ? buyerExcel(record) : kind === 'driver' ? driverPdf(record) : buyerPdf(record);
      if (share) await shareFiles([new File([output.blob], output.filename, { type: output.blob.type })], record.businessSnapshot?.businessName || 'Load bill', 'Load bill');
      else {
        const url = URL.createObjectURL(output.blob);
        const a = document.createElement('a'); a.href = url; a.download = output.filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
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
      <Button primary className="w-full" disabled={busy} en="Share bill PDF" te="PDF బిల్లు షేర్ చేయండి" onClick={() => exportFile('pdf', true)} />
      <div className="grid grid-cols-2 gap-2"><Button disabled={busy} en="Download PDF" te="PDF డౌన్‌లోడ్" onClick={() => exportFile('pdf')} /><Button disabled={busy} en="Download Excel" te="ఎక్సెల్ డౌన్‌లోడ్" onClick={() => exportFile('excel')} /></div>
      <Button className="w-full" disabled={busy} en="Share Excel" te="ఎక్సెల్ షేర్ చేయండి" onClick={() => exportFile('excel', true)} />
      <div className="grid grid-cols-2 gap-2"><Button disabled={busy} en="Driver slip" te="డ్రైవర్ స్లిప్" onClick={() => exportFile('driver')} /><Button disabled={busy} en="Share driver slip" te="స్లిప్ షేర్ చేయండి" onClick={() => exportFile('driver', true)} /></div>
      <p className="text-sm text-gray-700">{pick('Driver slips hide prices. Choose WhatsApp from your phone’s share menu.', 'డ్రైవర్ స్లిప్‌లో ధరలు ఉండవు. ఫోన్ షేర్ మెనూలో WhatsApp ఎంచుకోండి.')}</p>
    </> : <Button primary className="w-full" en="Continue this draft" te="డ్రాఫ్ట్ కొనసాగించండి" onClick={() => onResume(record)} />}
    <Button className="w-full" en="Back to home" te="హోమ్‌కు వెళ్ళండి" onClick={onBack} />
  </div>;
}
