import { useLanguage } from '../../i18n/LanguageContext';
import React, { useEffect, useRef, useState } from 'react';
import { request, settingsPath, logoUrl } from '../../lib/pilotApi.js';
import { Button, Card, Field, ErrorMessage, Label } from './Controls.jsx';
import Icon from './Icon.jsx';

export default function BusinessSetup({ settings, user, onSaved, onBack }) {
  const { pick } = useLanguage();
  const [form, setForm] = useState({ businessName: settings.businessName || '', address: settings.address || '', phone: settings.phone || '', gstNumber: settings.gstNumber || '', tradeLicense: settings.tradeLicense || '', defaultRoyaltyFee: String(settings.defaultRoyaltyFee ?? 0) });
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const stepTitle = useRef(null);
  const previousStep = useRef(step);
  const logoInput = useRef(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (previousStep.current !== step) stepTitle.current?.focus();
    previousStep.current = step;
  }, [step]);
  function chooseLogo(e) {
    const selected = e.target.files[0];
    if (!selected) return;
    if (!['image/png', 'image/jpeg'].includes(selected.type) || selected.size > 2 * 1024 * 1024) {
      setError(pick('Choose a JPEG or PNG logo up to 2 MB', '2 MB వరకు JPEG లేదా PNG లోగో ఎంచుకోండి'));
      e.target.value = ''; return;
    }
    setError(''); setFile(selected); setPreview(URL.createObjectURL(selected)); setRemoveLogo(false);
  }
  const update = key => e => setForm({ ...form, [key]: e.target.value });
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    if (step < 2) { setStep(step + 1); window.scrollTo(0, 0); return; }
    setBusy(true); setError('');
try {
        if (file && (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024)) throw new Error('Choose a JPEG or PNG logo up to 2 MB');
        const orgPath = settingsPath(user.organizationId);
        let result = await request(`${orgPath}/profile`, { method: 'PUT', body: { ...form, defaultRoyaltyFee: Number(form.defaultRoyaltyFee), removeLogo } });
        if (file) result = await request(`${orgPath}/logo`, { method: 'POST', file });
        onSaved(result);
      } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="setup-form space-y-5">
    <div className="setup-heading"><p className="eyebrow mb-2">{pick('BUSINESS SETUP', 'వ్యాపార నమోదు')} · {step + 1} / 3</p><h1 ref={stepTitle} tabIndex={-1} className="text-2xl font-bold">{pick('Your business', 'మీ వ్యాపార వివరాలు')}</h1><p className="mt-3 text-gray-600">{pick('Set up once. Your name and logo appear on every new bill.', 'ఒకసారి నమోదు చేయండి. ప్రతి కొత్త బిల్లులో మీ పేరు మరియు లోగో కనిపిస్తాయి.')}</p></div>
    <ErrorMessage error={error} />
    <ol className="setup-progress" aria-label={pick('Setup progress', 'నమోదు పురోగతి')}>{[['Business', 'వ్యాపారం'], ['Contact', 'సంప్రదింపు'], ['Defaults', 'డిఫాల్ట్‌లు']].map(([en, te], index) => <li key={en} aria-current={step === index ? 'step' : undefined} data-complete={index < step}><span className="step-number" aria-hidden="true">{index < step ? <Icon name="check" /> : index + 1}</span><span>{pick(en, te)}{index < step && <span className="sr-only"> {pick('completed', 'పూర్తయింది')}</span>}</span></li>)}</ol>
    {step === 0 && <div className="setup-business-grid">
    <Card className="gap-5">
      <div><h2 className="font-bold text-lg">{pick('Business details', 'వ్యాపార వివరాలు')}</h2><p className="text-sm text-gray-600 mt-1">{pick('Use the name your customers know.', 'మీ కస్టమర్లకు తెలిసిన పేరును ఉపయోగించండి.')}</p></div>
      <Field en="Business name" te="వ్యాపారం పేరు" required maxLength={120} value={form.businessName} onChange={update('businessName')} />
      <div className="setup-optional-fields">
      <Field en="GST number (optional)" te="GST నంబర్ (ఐచ్ఛికం)" maxLength={15} value={form.gstNumber} onChange={update('gstNumber')} />
      <Field en="Trade license (optional)" te="వ్యాపార లైసెన్స్ (ఐచ్ఛికం)" maxLength={80} value={form.tradeLicense} onChange={update('tradeLicense')} />
      </div>
    </Card>
    <Card className="gap-3">
      <Label en="Business logo (optional)" te="వ్యాపార లోగో" />
      <label className="logo-picker"><input ref={logoInput} aria-label={pick('Upload business logo', 'వ్యాపార లోగో జోడించండి')} type="file" accept="image/png,image/jpeg" onChange={chooseLogo} />
        {(preview || (settings.logoPath && !removeLogo)) ? <img src={preview || logoUrl(settings.logoPath)} alt={pick('Business logo preview', 'వ్యాపార లోగో ప్రివ్యూ')} className="h-20 w-20 object-contain" /> : <span className="logo-placeholder"><Icon name="plus" /></span>}
        <strong>{pick(file || (settings.logoPath && !removeLogo) ? 'Change logo' : 'Choose a logo', file || (settings.logoPath && !removeLogo) ? 'లోగో మార్చండి' : 'లోగో ఎంచుకోండి')}</strong>
        <span className="text-sm text-gray-600">{pick('JPEG or PNG · up to 2 MB', 'JPEG లేదా PNG · గరిష్ఠంగా 2 MB')}</span>
      </label>
      {file && <p className="text-xs text-gray-600 break-all" role="status">{file.name}</p>}
      {(file || settings.logoPath) && <Button en={removeLogo ? 'Keep logo' : 'Remove logo'} te={removeLogo ? 'లోగో ఉంచండి' : 'లోగో తొలగించండి'} onClick={() => { setRemoveLogo(!removeLogo); setFile(null); setPreview(''); if (logoInput.current) logoInput.current.value = ''; }} />}
    </Card>
    </div>}
    {step === 1 && <Card className="gap-4"><Field en="Yard / office address (optional)" te="యార్డ్ / ఆఫీస్ చిరునామా" maxLength={300} value={form.address} onChange={update('address')} /><Field en="Primary phone (optional)" te="ప్రధాన ఫోన్ నంబర్" type="tel" maxLength={30} value={form.phone} onChange={update('phone')} /><p className="text-sm text-gray-700">{pick('Account contact', 'ఖాతా సంప్రదింపు')}: {user?.email}</p></Card>}
    {step === 2 && <Card className="gap-4"><h2 className="font-bold">{pick('Ready for your yard', 'మీ యార్డ్ కోసం సిద్ధం')}</h2><p className="break-words">{form.businessName}</p><dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt>{pick('Measurements', 'కొలతలు')}</dt><dd>{pick('Feet / square feet', 'అడుగులు / చదరపు అడుగులు')}</dd></div><div className="flex justify-between"><dt>{pick('Currency', 'కరెన్సీ')}</dt><dd>₹ INR</dd></div><div className="flex justify-between"><dt>{pick('Your role', 'మీ పాత్ర')}</dt><dd>{pick('Administrator', 'అడ్మిన్')}</dd></div></dl><Field en="Default loading / royalty charges (₹)" te="లోడింగ్ / రాయల్టీ ఛార్జీలు" type="number" min="0" step="0.01" required value={form.defaultRoyaltyFee} onChange={update('defaultRoyaltyFee')} /><p className="text-sm text-gray-700">{pick('GST details are for your business profile. No tax is added to bills. Staff roles are managed in Settings.', 'GST వివరాలు వ్యాపార ప్రొఫైల్ కోసం మాత్రమే. బిల్లులకు పన్ను జోడించబడదు. సిబ్బంది పాత్రలు సెట్టింగ్స్‌లో నిర్వహించండి.')}</p></Card>}
    <div className="setup-actions">
    <Button type="submit" primary disabled={busy} en={busy ? 'Saving…' : step < 2 ? 'Continue' : 'Save and continue'} te={busy ? 'సేవ్ అవుతోంది…' : step < 2 ? 'కొనసాగించండి' : 'సేవ్ చేసి కొనసాగించండి'} className="setup-continue" ><Icon name="arrow" /></Button>
    {step > 0 && <Button disabled={busy} en="Previous step" te="మునుపటి దశ" className="w-full" onClick={() => setStep(step - 1)} />}
    {onBack && <Button en="Back to home" te="హోమ్‌కు వెళ్ళండి" disabled={busy} onClick={onBack} className="w-full" />}
    </div>
  </form>;
}
