import { useLanguage } from '../../i18n/LanguageContext';
import React, { useEffect, useRef, useState } from 'react';
import { request } from '../../lib/pilotApi.js';
import { DRAFT_KEY, newDraft, readDraft, makeRow, payload, previewRows, round, money } from '../../utils/pilotDraft.js';
import { Button, Card, Field, ErrorMessage } from './Controls.jsx';
import MeasurementEntry from './MeasurementEntry.jsx';
import LoadSummary from './LoadSummary.jsx';

export default function NewLoad({ settings, initialDraft, onSaved, onBack }) {
  const { pick } = useLanguage();
  const [draft, setDraft] = useState(() => initialDraft || readDraft() || newDraft(settings.defaultRoyaltyFee));
  const first = settings.stoneRates[0];
  const [entry, setEntry] = useState(() => draft.entry || { productId: first?._id || '', category: 'Regular', length: '', width: '', quantity: '1', rate: String(first?.defaultRate ?? '') });
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, entry })); }
    catch { queueMicrotask(() => setStorageError('This browser cannot keep a recovery copy. Save your draft before leaving.')); }
  }, [draft, entry]);
  const rows = previewRows(draft.rows);
  const base = round(rows.reduce((sum, r) => sum + r.lineTotal, 0));
  const fee = round(Number(draft.fee) || 0);
  const summary = { totalPieces: rows.reduce((sum, r) => sum + r.quantity, 0), totalDispatchVolumeSqFt: round(rows.reduce((sum, r) => sum + r.sqFt, 0)), baseMaterialTotal: base, loadingAndRoyaltyFees: fee, netBillableAmount: round(base + fee) };
  const change = key => e => setDraft({ ...draft, [key]: e.target.value });
  function add() {
    setError('');
    try {
      const row = makeRow(entry, settings.stoneRates.find(p => p._id === entry.productId));
      setDraft({ ...draft, rows: [...draft.rows, row] });
      setEntry({ ...entry, length: '', width: '', quantity: '1' });
    } catch (err) { setError(err.message); }
  }
  function openReview() {
    try {
      if (entry.length || entry.width) throw new Error('Add the measurement row you are entering before reviewing');
      payload(draft); setError(''); setReview(true); window.scrollTo(0, 0);
    } catch (err) { setError(err.message); }
  }
  async function save(finalize) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (entry.length || entry.width) throw new Error('Add the current measurement row before saving');
      const body = payload(draft);
      let record = draft.serverId ? await request(`/dispatches/${draft.serverId}`) : await request('/dispatches', { method: 'POST', body });
      const savedDraft = { ...draft, serverId: record._id };
      setDraft(savedDraft);
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...savedDraft, entry })); } catch { /* Recovery warning already visible. */ }
      if (record.status === 'Draft') {
        record = await request(`/dispatches/${record._id}`, { method: 'PUT', body });
        if (finalize) record = await request(`/dispatches/${record._id}/finalize`, { method: 'POST' });
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* Saved record remains available on the home screen. */ }
      onSaved(record);
    } catch (err) { setError(err.message); } finally { lock.current = false; setBusy(false); }
  }
  return <div className="space-y-4">
    <div><h1 className="text-2xl font-bold">{review ? pick('Review load', 'లోడ్ వివరాలు తనిఖీ చేయండి') : pick('New Load', 'కొత్త లోడ్')}</h1></div>
    <ErrorMessage error={error} /><ErrorMessage error={storageError} />
    {!review ? <>
      <Card className="gap-4">
        <Field en="Party name" te="పార్టీ పేరు" required maxLength={120} value={draft.partyName} onChange={change('partyName')} />
        <Field en="Truck number" te="లారీ నంబర్" required maxLength={40} value={draft.truckNumber} onChange={change('truckNumber')} />
        <Field en="Load date" te="తేదీ" type="date" required value={draft.date} onChange={change('date')} />
        <Field en="Destination" te="గమ్యస్థానం" required maxLength={200} value={draft.buyerDestination} onChange={change('buyerDestination')} />
        <Field en="Supervisor" te="సూపర్‌వైజర్" required maxLength={120} value={draft.supervisor} onChange={change('supervisor')} />
      </Card>
      <MeasurementEntry products={settings.stoneRates} entry={entry} onChange={setEntry} onAdd={add} />
    </> : <Card className="gap-2"><h2 className="font-bold break-words">{draft.partyName}</h2><p>{draft.truckNumber} · {draft.date}</p><p className="break-words">{draft.buyerDestination} · {draft.supervisor}</p></Card>}
    {rows.map((r, i) => <Card key={i} className="gap-2">
      <strong className="break-words">{i + 1}. {r.stoneType} · {r.finish} · {pick(r.category, r.category === 'TOP' ? 'టాప్' : 'సాధారణ')}</strong><p>{r.lengthFt} × {r.widthFt} {pick('ft', 'అడుగులు')} × {r.quantity} {pick('pieces', 'ముక్కలు')}</p><p className="font-semibold">{r.sqFt.toFixed(2)} {pick('sq ft', 'చ.అ.')} · {money(r.lineTotal)}</p>
      {!review && <div className="grid grid-cols-2 gap-2"><Button en="Edit row" te="వరుస మార్చండి" onClick={() => {
        if (entry.length || entry.width) { setError('Add your current row before editing another'); return; }
        const product = settings.stoneRates.find(p => p.stoneType === r.stoneType && p.finish === r.finish);
        setEntry({ productId: product?._id || '', length: String(r.lengthFt), width: String(r.widthFt), quantity: String(r.quantity), category: r.category, rate: String(r.ratePerSqFt) });
        setDraft({ ...draft, rows: draft.rows.filter((_, index) => index !== i) });
      }} /><Button en="Remove row" te="వరుస తొలగించండి" onClick={() => setDraft({ ...draft, rows: draft.rows.filter((_, index) => index !== i) })} /></div>}
    </Card>)}
    {!review && <Card><Field en="Loading / royalty charges (₹)" te="లోడింగ్ / రాయల్టీ ఛార్జీలు" type="number" min="0" step="0.01" value={draft.fee} onChange={change('fee')} /></Card>}
    <LoadSummary rows={rows} summary={summary} />
    {review ? <>
      <p className="text-sm text-gray-700">{pick('Finalizing locks this bill’s quantities, prices, totals, and business branding.', 'ఖరారు చేసిన తర్వాత ఈ బిల్లులోని కొలతలు, ధరలు, మొత్తాలు మరియు వ్యాపార వివరాలు మారవు.')}</p>
      <Button className="w-full" primary disabled={busy} en={busy ? 'Saving…' : 'Finalize bill'} te={busy ? 'సేవ్ అవుతోంది…' : 'బిల్లును ఖరారు చేయండి'} onClick={() => save(true)} />
      <Button className="w-full" disabled={busy} en="Back to edit" te="వివరాలు మార్చండి" onClick={() => setReview(false)} />
    </> : <Button className="w-full" primary en="Review load" te="లోడ్ తనిఖీ చేయండి" onClick={openReview} />}
    <Button className="w-full" disabled={busy} en="Save draft" te="డ్రాఫ్ట్ సేవ్ చేయండి" onClick={() => save(false)} />
    <Button className="w-full" disabled={busy} en="Back to home" te="హోమ్‌కు వెళ్ళండి" onClick={onBack} />
  </div>;
}
