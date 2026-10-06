import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState } from 'react';
import { request, settingsPath, logoUrl } from '../../lib/pilotApi.js';
import { Button, Card, Field, ErrorMessage, Label } from './Controls.jsx';

export default function BusinessSetup({ settings, user, onSaved, onBack }) {
  const { pick } = useLanguage();
  const [form, setForm] = useState({ businessName: settings.businessName || '', address: settings.address || '', phone: settings.phone || '', gstNumber: settings.gstNumber || '', tradeLicense: settings.tradeLicense || '', defaultRoyaltyFee: String(settings.defaultRoyaltyFee ?? 0) });
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = key => e => setForm({ ...form, [key]: e.target.value });
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    if (step < 2) { setStep(step + 1); window.scrollTo(0, 0); return; }
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
    <ol className="grid grid-cols-3 gap-2" aria-label={pick('Setup progress', 'నమోదు పురోగతి')}>{[['Business', 'వ్యాపారం'], ['Contact', 'సంప్రదింపు'], ['Defaults', 'డిఫాల్ట్‌లు']].map(([en, te], index) => <li key={en} aria-current={step === index ? 'step' : undefined} className={`border-t-4 pt-2 text-sm font-semibold ${index <= step ? 'border-teal-800 text-teal-900' : 'border-gray-300 text-gray-600'}`}>{index + 1}. {pick(en, te)}</li>)}</ol>
    {step === 0 && <>
    <Card className="gap-4">
      <Field en="Business name" te="వ్యాపారం పేరు" required maxLength={120} value={form.businessName} onChange={update('businessName')} />
      <Field en="GST number (optional)" te="GST నంబర్ (ఐచ్ఛికం)" maxLength={15} value={form.gstNumber} onChange={update('gstNumber')} />
      <Field en="Trade license (optional)" te="వ్యాపార లైసెన్స్ (ఐచ్ఛికం)" maxLength={80} value={form.tradeLicense} onChange={update('tradeLicense')} />
    </Card>
    <Card className="gap-3">
      <Label en="Business logo (optional)" te="వ్యాపార లోగో" />
      {settings.logoPath && !removeLogo && <img src={logoUrl(settings.logoPath)} alt="Current business logo" className="h-20 w-20 object-contain" />}
      <input aria-label={pick('Upload business logo', 'వ్యాపార లోగో జోడించండి')} type="file" accept="image/png,image/jpeg" className="min-h-12 w-full border-2 border-gray-300 rounded-xl p-2 text-sm" onChange={e => { setFile(e.target.files[0] || null); setRemoveLogo(false); }} />
      <p className="text-sm text-gray-600">{pick('JPEG or PNG · up to 2 MB', 'JPEG లేదా PNG · గరిష్ఠంగా 2 MB')}</p>
      {settings.logoPath && <Button en={removeLogo ? 'Keep logo' : 'Remove logo'} te={removeLogo ? 'లోగో ఉంచండి' : 'లోగో తొలగించండి'} onClick={() => { setRemoveLogo(!removeLogo); setFile(null); }} />}
    </Card>
    </>}
    {step === 1 && <Card className="gap-4"><Field en="Yard / office address (optional)" te="యార్డ్ / ఆఫీస్ చిరునామా" maxLength={300} value={form.address} onChange={update('address')} /><Field en="Primary phone (optional)" te="ప్రధాన ఫోన్ నంబర్" type="tel" maxLength={30} value={form.phone} onChange={update('phone')} /><p className="text-sm text-gray-700">{pick('Account contact', 'ఖాతా సంప్రదింపు')}: {user?.email}</p></Card>}
    {step === 2 && <Card className="gap-4"><h2 className="font-bold">{pick('Ready for your yard', 'మీ యార్డ్ కోసం సిద్ధం')}</h2><p className="break-words">{form.businessName}</p><dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt>{pick('Measurements', 'కొలతలు')}</dt><dd>{pick('Feet / square feet', 'అడుగులు / చదరపు అడుగులు')}</dd></div><div className="flex justify-between"><dt>{pick('Currency', 'కరెన్సీ')}</dt><dd>₹ INR</dd></div><div className="flex justify-between"><dt>{pick('Your role', 'మీ పాత్ర')}</dt><dd>{pick('Administrator', 'అడ్మిన్')}</dd></div></dl><Field en="Default loading / royalty charges (₹)" te="లోడింగ్ / రాయల్టీ ఛార్జీలు" type="number" min="0" step="0.01" required value={form.defaultRoyaltyFee} onChange={update('defaultRoyaltyFee')} /><p className="text-sm text-gray-700">{pick('GST details are for your business profile. No tax is added to bills. Staff roles are managed in Settings.', 'GST వివరాలు వ్యాపార ప్రొఫైల్ కోసం మాత్రమే. బిల్లులకు పన్ను జోడించబడదు. సిబ్బంది పాత్రలు సెట్టింగ్స్‌లో నిర్వహించండి.')}</p></Card>}
    <Button type="submit" primary disabled={busy} en={busy ? 'Saving…' : step < 2 ? 'Continue' : 'Save and continue'} te={busy ? 'సేవ్ అవుతోంది…' : step < 2 ? 'కొనసాగించండి' : 'సేవ్ చేసి కొనసాగించండి'} className="w-full" />
    {step > 0 && <Button disabled={busy} en="Previous step" te="మునుపటి దశ" className="w-full" onClick={() => setStep(step - 1)} />}
    {onBack && <Button en="Back to home" te="హోమ్‌కు వెళ్ళండి" disabled={busy} onClick={onBack} className="w-full" />}
  </form>;
}
