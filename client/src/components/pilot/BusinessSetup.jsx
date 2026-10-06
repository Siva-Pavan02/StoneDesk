import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState } from 'react';
import { request, settingsPath, logoUrl } from '../../lib/pilotApi.js';
import { Button, Card, Field, ErrorMessage, Label } from './Controls.jsx';

export default function BusinessSetup({ settings, onSaved, onBack }) {
  const { pick } = useLanguage();
  const [form, setForm] = useState({ businessName: settings.businessName || '', address: settings.address || '', phone: settings.phone || '', defaultRoyaltyFee: String(settings.defaultRoyaltyFee ?? 0) });
  const [file, setFile] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = key => e => setForm({ ...form, [key]: e.target.value });
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (file && (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024)) throw new Error('Choose a JPEG or PNG logo up to 2 MB');
      let result = await request(`${settingsPath}/profile`, { method: 'PUT', body: { ...form, defaultRoyaltyFee: Number(form.defaultRoyaltyFee), removeLogo } });
      if (file) result = await request(`${settingsPath}/logo`, { method: 'POST', file });
      onSaved(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-4">
    <div><h1 className="text-2xl font-bold">{pick('Your business', 'మీ వ్యాపార వివరాలు')}</h1><p className="mt-3 text-gray-700">{pick('Set up once. Your name and logo appear on every new bill.', 'ఒకసారి నమోదు చేయండి. ప్రతి కొత్త బిల్లులో మీ పేరు మరియు లోగో కనిపిస్తాయి.')}</p></div>
    <ErrorMessage error={error} />
    <Card className="gap-4">
      <Field en="Business name" te="వ్యాపారం పేరు" required maxLength={120} value={form.businessName} onChange={update('businessName')} />
      <Field en="Address (optional)" te="చిరునామా" maxLength={300} value={form.address} onChange={update('address')} />
      <Field en="Phone (optional)" te="ఫోన్ నంబర్" type="tel" maxLength={30} value={form.phone} onChange={update('phone')} />
      <Field en="Default loading / royalty charges" te="లోడింగ్ / రాయల్టీ ఛార్జీలు" type="number" min="0" step="0.01" required value={form.defaultRoyaltyFee} onChange={update('defaultRoyaltyFee')} />
    </Card>
    <Card className="gap-3">
      <Label en="Business logo (optional)" te="వ్యాపార లోగో" />
      {settings.logoPath && !removeLogo && <img src={logoUrl(settings.logoPath)} alt="Current business logo" className="h-20 w-20 object-contain" />}
      <input aria-label={pick('Upload business logo', 'వ్యాపార లోగో జోడించండి')} type="file" accept="image/png,image/jpeg" className="min-h-12 w-full border-2 border-gray-300 rounded-xl p-2 text-sm" onChange={e => { setFile(e.target.files[0] || null); setRemoveLogo(false); }} />
      <p className="text-sm text-gray-600">{pick('JPEG or PNG · up to 2 MB', 'JPEG లేదా PNG · గరిష్ఠంగా 2 MB')}</p>
      {settings.logoPath && <Button en={removeLogo ? 'Keep logo' : 'Remove logo'} te={removeLogo ? 'లోగో ఉంచండి' : 'లోగో తొలగించండి'} onClick={() => { setRemoveLogo(!removeLogo); setFile(null); }} />}
    </Card>
    <Button type="submit" primary disabled={busy} en={busy ? 'Saving…' : 'Save and continue'} te={busy ? 'సేవ్ అవుతోంది…' : 'సేవ్ చేసి కొనసాగించండి'} className="w-full" />
    {onBack && <Button en="Back to home" te="హోమ్‌కు వెళ్ళండి" disabled={busy} onClick={onBack} className="w-full" />}
  </form>;
}
