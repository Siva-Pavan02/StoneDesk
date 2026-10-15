import { useLanguage } from '../../i18n/LanguageContext';
import React, { useEffect, useRef, useState } from 'react';
import { request, settingsPath, logoUrl } from '../../lib/pilotApi.js';
import { Button, Card, Field, FieldError, ErrorMessage, Label } from './Controls.jsx';
import Icon from './Icon.jsx';

export default function BusinessSetup({ settings, user, onSaved, onBack }) {
  const { pick } = useLanguage();
  const [form, setForm] = useState({ businessName: settings.businessName || '', address: settings.address || '', phone: settings.phone || '', gstNumber: settings.gstNumber || '', tradeLicense: settings.tradeLicense || '', bankDetails: settings.bankDetails || '', defaultRoyaltyFee: String(settings.defaultRoyaltyFee ?? 0) });
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState('');
  const [logoError, setLogoError] = useState('');
  const errorBox = useRef(null);
  const logoMessage = pick('Choose a JPEG or PNG logo up to 2\u00A0MB', '2\u00A0MB వరకు JPEG లేదా PNG లోగో ఎంచుకోండి');
  // Unsaved edits (fields, a picked logo, a pending logo removal) are lost on reload; warn first.
  const saved = { businessName: settings.businessName || '', address: settings.address || '', phone: settings.phone || '', gstNumber: settings.gstNumber || '', tradeLicense: settings.tradeLicense || '', bankDetails: settings.bankDetails || '', defaultRoyaltyFee: String(settings.defaultRoyaltyFee ?? 0) };
  const dirty = !busy && (Boolean(file) || removeLogo || Object.keys(saved).some(key => String(form[key]) !== saved[key]));
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
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
    setNotice('');
    if (!selected) return;
    if (!['image/png', 'image/jpeg'].includes(selected.type) || selected.size > 2 * 1024 * 1024) {
      setLogoError(logoMessage);
      e.target.value = ''; return;
    }
    setLogoError(''); setFile(selected); setPreview(URL.createObjectURL(selected)); setRemoveLogo(false);
  }
  const formRef = useRef(null);
  // Step buttons: going back is always allowed; going forward first checks the fields on the current step.
  function goToStep(index) {
    if (busy || index === step) return;
    if (index > step && formRef.current && !formRef.current.reportValidity()) return;
    setNotice(''); setStep(index); window.scrollTo(0, 0);
  }
  const update = key => e => { setNotice(''); setForm({ ...form, [key]: e.target.value }); };
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    if (step < 2) { setNotice(''); setStep(step + 1); window.scrollTo(0, 0); return; }
    setBusy(true); setError('');
try {
        if (file && (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024)) throw new Error(logoMessage);
        const orgPath = settingsPath(user.organizationId);
        let result = await request(`${orgPath}/profile`, { method: 'PUT', body: { ...form, defaultRoyaltyFee: Number(form.defaultRoyaltyFee), removeLogo } });
        if (file) result = await request(`${orgPath}/logo`, { method: 'POST', file });
        onSaved(result);
        setNotice(pick('Profile saved', 'ప్రొఫైల్ సేవ్ అయింది'));
        setFile(null); setPreview(''); setRemoveLogo(false);
        if (logoInput.current) logoInput.current.value = '';
      } catch (err) {
        setError(err.message);
        // The message shows at the top while focus is on the bottom button; move focus to it.
        requestAnimationFrame(() => errorBox.current?.focus());
      } finally { setBusy(false); }
  }
  return <form ref={formRef} onSubmit={save} className="setup-form business-setup space-y-5 text-sm">
    {onBack && <button type="button" className="text-button inline-flex items-center gap-1.5" disabled={busy} onClick={onBack}><Icon name="back" className="h-4 w-4" />{pick('Back', 'వెనక్కి')}</button>}
    <div className="setup-heading screen-heading"><p className="eyebrow mb-2">{pick('BUSINESS SETUP', 'వ్యాపార నమోదు')} · {step + 1} / 3</p><h1 ref={stepTitle} tabIndex={-1} className="text-2xl font-semibold">{pick('Your business', 'మీ వ్యాపార వివరాలు')}</h1><p className="mt-3 text-sm text-gray-600">{pick('Set up once. Your name and logo appear on every new bill.', 'ఒకసారి నమోదు చేయండి. ప్రతి కొత్త బిల్లులో మీ పేరు మరియు లోగో కనిపిస్తాయి.')}</p></div>
    {notice && <p role="status" className="success-message">{notice}</p>}
    <div ref={errorBox} tabIndex={-1} className="outline-none"><ErrorMessage error={error} /></div>
    <ol className="setup-progress" aria-label={pick('Setup progress', 'నమోదు పురోగతి')}>{[['Business', 'వ్యాపారం'], ['Contact', 'సంప్రదింపు'], ['Defaults', 'డిఫాల్ట్‌లు']].map(([en, te], index) => <li key={en}><button type="button" className="setup-step-button" disabled={busy} aria-current={step === index ? 'step' : undefined} data-complete={index < step} onClick={() => goToStep(index)}><span className="step-number" aria-hidden="true">{index < step ? <Icon name="check" /> : index + 1}</span><span>{pick(en, te)}{index < step && <span className="sr-only"> {pick('completed', 'పూర్తయింది')}</span>}</span></button></li>)}</ol>
    {step === 0 && <div className="setup-business-grid">
    <Card className="gap-5">
      <div><h2 className="section-heading font-semibold text-base">{pick('Business details', 'వ్యాపార వివరాలు')}</h2><p className="text-sm text-gray-600 mt-1">{pick('Use the name your customers know.', 'మీ కస్టమర్లకు తెలిసిన పేరును ఉపయోగించండి.')}</p></div>
      <Field en="Business name" te="వ్యాపారం పేరు" name="businessName" autoComplete="organization" required maxLength={120} value={form.businessName} onChange={update('businessName')} />
      <div className="setup-optional-fields">
      <Field en="GST number (optional)" te="GST నంబర్ (ఐచ్ఛికం)" name="gstNumber" autoComplete="off" spellCheck={false} autoCapitalize="characters" maxLength={15} value={form.gstNumber} onChange={update('gstNumber')} />
      <Field en="Trade license (optional)" te="వ్యాపార లైసెన్స్ (ఐచ్ఛికం)" name="tradeLicense" autoComplete="off" spellCheck={false} maxLength={80} value={form.tradeLicense} onChange={update('tradeLicense')} />
      </div>
    </Card>
    <Card className="gap-3">
      <Label en="Business logo (optional)" te="వ్యాపార లోగో" />
      <label className="logo-picker"><input ref={logoInput} name="logo" aria-label={pick('Upload business logo', 'వ్యాపార లోగో జోడించండి')} aria-invalid={logoError ? true : undefined} aria-describedby={logoError ? 'business-logo-error' : undefined} type="file" accept="image/png,image/jpeg" onChange={chooseLogo} />
        {(preview || (settings.logoPath && !removeLogo)) ? <img src={preview || logoUrl(settings.logoPath)} alt={pick('Business logo preview', 'వ్యాపార లోగో ప్రివ్యూ')} className="logo-preview" width={64} height={64} /> : <span className="logo-placeholder"><Icon name="plus" /></span>}
        <span className="logo-picker-text">
          <strong>{pick(file || (settings.logoPath && !removeLogo) ? 'Change logo' : 'Choose a logo', file || (settings.logoPath && !removeLogo) ? 'లోగో మార్చండి' : 'లోగో ఎంచుకోండి')}</strong>
          <span>{pick('JPEG or PNG · up to 2\u00A0MB', 'JPEG లేదా PNG · గరిష్ఠంగా 2\u00A0MB')}</span>
        </span>
      </label>
      <FieldError id="business-logo-error" error={logoError} />
      {file && <p className="text-xs text-gray-600 break-all" role="status">{file.name}</p>}
      {(file || settings.logoPath) && <Button en={removeLogo ? 'Keep logo' : 'Remove logo'} te={removeLogo ? 'లోగో ఉంచండి' : 'లోగో తొలగించండి'} onClick={() => { setRemoveLogo(!removeLogo); setFile(null); setPreview(''); if (logoInput.current) logoInput.current.value = ''; }} />}
    </Card>
    </div>}
    {step === 1 && <Card className="gap-4"><Field en="Yard / office address (optional)" te="యార్డ్ / ఆఫీస్ చిరునామా" name="address" autoComplete="street-address" maxLength={300} value={form.address} onChange={update('address')} /><Field en="Primary phone (optional)" te="ప్రధాన ఫోన్ నంబర్" type="tel" name="phone" autoComplete="tel" inputMode="tel" maxLength={30} value={form.phone} onChange={update('phone')} /><div><Field en="Bank / UPI details (optional)" te="బ్యాంక్ / UPI వివరాలు (ఐచ్ఛికం)" name="bankDetails" autoComplete="off" spellCheck={false} maxLength={300} value={form.bankDetails} onChange={update('bankDetails')} /><p className="text-xs text-gray-600 mt-1">{pick('Printed on finalized invoices so buyers can pay you.', 'కొనుగోలుదారులు చెల్లించడానికి ఖరారైన ఇన్వాయిస్‌లపై ముద్రించబడుతుంది.')}</p></div><p className="text-sm text-gray-700">{pick('Account contact', 'ఖాతా సంప్రదింపు')}: {user?.email}</p></Card>}
    {step === 2 && <Card className="gap-4"><h2 className="font-bold">{pick('Ready for your yard', 'మీ యార్డ్ కోసం సిద్ధం')}</h2><p className="break-words">{form.businessName}</p><dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="min-w-0 break-words">{pick('Measurements', 'కొలతలు')}</dt><dd className="min-w-0 break-words text-right">{pick('Feet / square feet', 'అడుగులు / చదరపు అడుగులు')}</dd></div><div className="flex justify-between gap-3"><dt className="min-w-0 break-words">{pick('Currency', 'కరెన్సీ')}</dt><dd className="min-w-0 break-words text-right">₹ INR</dd></div><div className="flex justify-between gap-3"><dt className="min-w-0 break-words">{pick('Your role', 'మీ పాత్ర')}</dt><dd className="min-w-0 break-words text-right">{pick('Administrator', 'అడ్మిన్')}</dd></div></dl><Field en="Default loading / royalty charges (₹)" te="లోడింగ్ / రాయల్టీ ఛార్జీలు" type="number" name="defaultRoyaltyFee" min="0" step="0.01" required value={form.defaultRoyaltyFee} onChange={update('defaultRoyaltyFee')} /><p className="text-sm text-gray-700">{pick('GST details are for your business profile. No tax is added to bills. Staff roles are managed in Settings.', 'GST వివరాలు వ్యాపార ప్రొఫైల్ కోసం మాత్రమే. బిల్లులకు పన్ను జోడించబడదు. సిబ్బంది పాత్రలు సెట్టింగ్స్‌లో నిర్వహించండి.')}</p></Card>}
    <div className="setup-actions action-row">
    <Button type="submit" primary disabled={busy} en={busy ? 'Saving…' : step < 2 ? 'Continue' : settings.businessName ? 'Save profile' : 'Save and continue'} te={busy ? 'సేవ్ అవుతోంది…' : step < 2 ? 'కొనసాగించండి' : settings.businessName ? 'ప్రొఫైల్ సేవ్ చేయండి' : 'సేవ్ చేసి కొనసాగించండి'} className="setup-continue" ><Icon name="arrow" /></Button>
    {step > 0 && <Button disabled={busy} en="Previous step" te="మునుపటి దశ" onClick={() => { setNotice(''); setStep(step - 1); }} />}
    </div>
  </form>;
}
