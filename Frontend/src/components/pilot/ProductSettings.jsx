import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState } from 'react';
import { request, settingsPath } from '../../lib/pilotApi.js';
import { Button, Card, Field, ErrorMessage } from './Controls.jsx';
import { money } from '../../utils/pilotDraft.js';
const empty = { stoneType: '', finish: '', defaultRate: '' };
export default function ProductSettings({ settings, onChanged, onBack, onboarding = false, user }) {
  const { pick } = useLanguage();
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const orgPath = settingsPath(user.organizationId);
  async function save(e) {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const data = await request(`${orgPath}/stone-rates${editId ? `/${editId}` : ''}`, { method: editId ? 'PUT' : 'POST', body: { ...form, defaultRate: Number(form.defaultRate) } });
      onChanged(data); setForm(empty); setEditId(null);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function remove(product) {
    if (busy || !window.confirm(pick(`Remove ${product.stoneType} (${product.finish})? Saved bills will keep their rates.`, `${product.stoneType} (${product.finish}) తొలగించాలా? సేవ్ చేసిన బిల్లుల ధరలు మారవు.`))) return;
    setBusy(true); setError('');
    try { onChanged(await request(`${orgPath}/stone-rates/${product.id}`, { method: 'DELETE' })); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <div><h1 className="text-2xl font-bold">{pick('Products & rates', 'రకాలు మరియు ధరలు')}</h1><p className="mt-3">{pick('Add the tiles or stones you sell. All rates are per sq ft.', 'మీరు అమ్మే టైల్స్ లేదా రాళ్లను జోడించండి. ధరలు చదరపు అడుగుకు.')}</p></div>
    <ErrorMessage error={error} />
    <form onSubmit={save}><Card className="product-form gap-4">
      <Field en="Tile / stone name" te="టైల్ / రాయి పేరు" required maxLength={120} value={form.stoneType} onChange={e => setForm({ ...form, stoneType: e.target.value })} />
      <Field en="Finish" te="ఫినిష్" required maxLength={120} placeholder={pick('e.g. Polished', 'ఉదా. పాలిష్')} value={form.finish} onChange={e => setForm({ ...form, finish: e.target.value })} />
      <Field en="Rate per sq ft (₹)" te="చదరపు అడుగు ధర" required type="number" min="0" step="0.01" value={form.defaultRate} onChange={e => setForm({ ...form, defaultRate: e.target.value })} />
      <Button type="submit" primary disabled={busy} en={editId ? 'Update product' : 'Add product'} te={editId ? 'రకాన్ని మార్చండి' : 'రకాన్ని జోడించండి'} />
      {editId && <Button en="Cancel edit" te="రద్దు చేయండి" disabled={busy} onClick={() => { setEditId(null); setForm(empty); }} />}
    </Card></form>
    {!settings.stoneRates.length && <p className="text-gray-700">{pick('Add at least one product to start your first load.', 'మొదటి లోడ్ ప్రారంభించడానికి కనీసం ఒక రకాన్ని జోడించండి.')}</p>}
    {settings.stoneRates.map(p => <Card key={p.id} className="product-record gap-3">
      <div className="flex justify-between gap-3"><div className="min-w-0 break-words"><h2 className="font-bold">{p.stoneType}</h2><p className="text-gray-600">{p.finish}</p></div><strong>{money(p.defaultRate)}<span className="block text-xs font-normal text-gray-600">/ {pick('sq ft', 'చ.అ.')}</span></strong></div>
      <div className="product-actions grid grid-cols-2 gap-2"><Button disabled={busy} en="Edit" te="మార్చండి" onClick={() => { setForm({ ...p, defaultRate: String(p.defaultRate) }); setEditId(p.id); window.scrollTo(0, 0); }} /><Button disabled={busy} en="Remove" te="తొలగించండి" onClick={() => remove(p)} /></div>
    </Card>)}
    <Button className="w-full" primary={onboarding} disabled={busy || !settings.stoneRates.length} en={onboarding ? 'Open workspace' : 'Back to home'} te={onboarding ? 'వర్క్‌స్పేస్ తెరవండి' : 'హోమ్‌కు వెళ్ళండి'} onClick={onBack} />
  </div>;
}
