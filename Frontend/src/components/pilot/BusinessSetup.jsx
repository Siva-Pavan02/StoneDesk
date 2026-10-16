import React, { useEffect, useRef, useState } from 'react';
import { request, settingsPath, logoUrl } from '../../lib/pilotApi.js';
import { BackButton, Button, Field, FieldError, ErrorMessage, Label } from './Controls.jsx';
import Icon from './Icon.jsx';

// Example shown only while the bank field is empty; never saved. One detail per line (textarea keeps the newlines).
const BANK_PLACEHOLDER = ['Account holder: Venkata Granites', 'Bank: State Bank of India', 'A/c no: 1234 5678 9012', 'IFSC: SBIN0001234', 'UPI: venkata@okhdfc'].join('\n');

export default function BusinessSetup({ settings, user, onSaved, onBack }) {
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
  const logoMessage = 'Choose a JPEG or PNG logo up to 2\u00A0MB';
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
        setNotice('Profile saved');
        setFile(null); setPreview(''); setRemoveLogo(false);
        if (logoInput.current) logoInput.current.value = '';
      } catch (err) {
        setError(err.message);
        // The message shows at the top while focus is on the bottom button; move focus to it.
        requestAnimationFrame(() => errorBox.current?.focus());
      } finally { setBusy(false); }
  }
  return <form ref={formRef} onSubmit={save} className="setup-form business-setup">
    {onBack && <BackButton disabled={busy} onClick={onBack} label="Back" />}
    <div className="setup-heading screen-heading"><p className="mn-meta setup-meta">BUSINESS SETUP · {step + 1} / 3</p><h1 ref={stepTitle} tabIndex={-1} className="setup-title">Your business</h1><p className="setup-lede">Set up once. Your name and logo appear on every new bill.</p></div>
    {notice && <p role="status" className="success-message">{notice}</p>}
    <div ref={errorBox} tabIndex={-1} className="outline-none"><ErrorMessage error={error} /></div>
    <ol className="setup-progress" aria-label="Setup progress">{['Business', 'Contact', 'Defaults'].map((label, index) => <li key={label}><button type="button" className="setup-step-button" disabled={busy} aria-current={step === index ? 'step' : undefined} data-complete={index < step} onClick={() => goToStep(index)}><span className="step-number" aria-hidden="true">{index < step ? <Icon name="check" /> : index + 1}</span><span>{label}{index < step && <span className="sr-only"> completed</span>}</span></button></li>)}</ol>
    {step === 0 && <div className="setup-sheet setup-business-grid">
    <section className="setup-section">
      <div className="setup-section-head"><h2 className="section-heading">Business details</h2><p className="setup-hint">Use the name your customers know.</p></div>
      <Field label="Business name" name="businessName" autoComplete="organization" required maxLength={120} value={form.businessName} onChange={update('businessName')} />
      <div className="setup-optional-fields">
      <Field label="GST number (optional)" name="gstNumber" autoComplete="off" spellCheck={false} autoCapitalize="characters" maxLength={15} value={form.gstNumber} onChange={update('gstNumber')} />
      <Field label="Trade license (optional)" name="tradeLicense" autoComplete="off" spellCheck={false} maxLength={80} value={form.tradeLicense} onChange={update('tradeLicense')} />
      </div>
    </section>
    <section className="setup-section">
      <Label label="Business logo (optional)" />
      <label className="logo-picker"><input ref={logoInput} name="logo" aria-label="Upload business logo" aria-invalid={logoError ? true : undefined} aria-describedby={logoError ? 'business-logo-error' : undefined} type="file" accept="image/png,image/jpeg" onChange={chooseLogo} />
        {(preview || (settings.logoPath && !removeLogo)) ? <img src={preview || logoUrl(settings.logoPath)} alt="Business logo preview" className="logo-preview" width={64} height={64} /> : <span className="logo-placeholder"><Icon name="plus" /></span>}
        <span className="logo-picker-text">
          <strong>{file || (settings.logoPath && !removeLogo) ? 'Change logo' : 'Choose a logo'}</strong>
          <span>{'JPEG or PNG · up to 2\u00A0MB'}</span>
        </span>
      </label>
      <FieldError id="business-logo-error" error={logoError} />
      {file && <p className="setup-hint setup-file" role="status">{file.name}</p>}
      {(file || settings.logoPath) && <Button variant="ghost" className="setup-logo-toggle" label={removeLogo ? 'Keep logo' : 'Remove logo'} onClick={() => { setRemoveLogo(!removeLogo); setFile(null); setPreview(''); if (logoInput.current) logoInput.current.value = ''; }} />}
    </section>
    </div>}
    {step === 1 && <div className="setup-sheet"><section className="setup-section"><Field label="Yard / office address (optional)" name="address" autoComplete="street-address" maxLength={300} value={form.address} onChange={update('address')} /><Field label="Primary phone (optional)" type="tel" name="phone" autoComplete="tel" inputMode="tel" maxLength={30} value={form.phone} onChange={update('phone')} /><div className="setup-field-hint"><Field multiline rows={5} label="Bank / UPI details (optional)" name="bankDetails" autoComplete="off" spellCheck={false} maxLength={300} helper="One detail per line" placeholder={BANK_PLACEHOLDER} value={form.bankDetails} onChange={update('bankDetails')} /><p className="setup-hint">Printed on finalized invoices so buyers can pay you.</p></div><p className="setup-hint">Account contact: {user?.email}</p></section></div>}
    {step === 2 && <div className="setup-sheet"><section className="setup-section"><div className="setup-section-head"><h2 className="section-heading">Ready for your yard</h2><p className="setup-business-name">{form.businessName}</p></div><dl className="setup-summary"><div className="setup-summary-row"><dt>Measurements</dt><dd>Feet / square feet</dd></div><div className="setup-summary-row"><dt>Currency</dt><dd>₹ INR</dd></div><div className="setup-summary-row"><dt>Your role</dt><dd>Administrator</dd></div></dl><Field label="Default loading / royalty charges (₹)" type="number" name="defaultRoyaltyFee" min="0" step="0.01" required value={form.defaultRoyaltyFee} onChange={update('defaultRoyaltyFee')} /><p className="setup-hint">GST details are for your business profile. No tax is added to bills. Staff roles are managed in Settings.</p></section></div>}
    <div className="setup-actions action-row">
    <Button type="submit" primary disabled={busy} label={busy ? 'Saving…' : step < 2 ? 'Continue' : settings.businessName ? 'Save profile' : 'Save and continue'} className="setup-continue" ><Icon name="arrow" /></Button>
    {step > 0 && <Button disabled={busy} label="Previous step" onClick={() => { setNotice(''); setStep(step - 1); }} />}
    </div>
  </form>;
}
