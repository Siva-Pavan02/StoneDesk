import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { request } from '../../lib/pilotApi.js';
import { Button, Field, ErrorMessage } from './Controls.jsx';

export default function AuthDialog({ mode, onClose, onSignedIn, onMode }) {
  const dialog = useRef(null);
  const { pick } = useLanguage();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createOrganization, setCreateOrganization] = useState(false);
  const signup = mode === 'signup';
  
  useEffect(() => { if (mode) { dialog.current.showModal(); } else dialog.current.close(); }, [mode]);
  
  async function submit(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    const values = Object.fromEntries(new FormData(e.currentTarget));
    if (signup) values.createOrganization = createOrganization;
    try { 
      const data = await request(`/auth/${mode}`, { method: 'POST', body: values }); 
      e.target.reset(); 
      onSignedIn(data.user); 
    }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  
  return <dialog ref={dialog} className="app-dialog pilot" aria-labelledby="auth-title" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }}>
    <div className="p-6"><div className="flex items-center justify-between gap-3"><p className="eyebrow">STONEDESK</p><button type="button" className="text-button" disabled={busy} onClick={onClose}>{pick('Close', 'మూసివేయండి')}</button></div>
      <h2 id="auth-title" className="mt-3 text-2xl font-bold">{signup ? pick('Set up your account', 'మీ ఖాతా సృష్టించండి') : pick('Welcome back', 'తిరిగి స్వాగతం')}</h2>
      
      {signup && (
        <div className="mt-4 mb-2 grid gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <label className="flex min-h-12 items-center gap-3 cursor-pointer">
            <input type="radio" name="orgMode" checked={!createOrganization} onChange={() => setCreateOrganization(false)} className="accent-teal-800" />
            <span className="text-sm font-medium">{pick('Join organization', 'సంస్థలో చేరండి')}</span>
          </label>
          <label className="flex min-h-12 items-center gap-3 cursor-pointer">
            <input type="radio" name="orgMode" checked={createOrganization} onChange={() => setCreateOrganization(true)} className="accent-teal-800" />
            <span className="text-sm font-medium">{pick('Create New Workspace', 'కొత్త వర్క్‌స్పేస్ సృష్టించండి')}</span>
          </label>
        </div>
      )}

      <p className="mt-3 mb-5 text-sm leading-relaxed text-gray-700">
        {signup 
          ? (createOrganization 
              ? pick('Create a new organization workspace. You will be the administrator.', 'కొత్త ఆర్గనైజేషన్ సృష్టించండి. మీరు అడ్మిన్ అవుతారు.')
              : pick('Enter the Organization Code provided by your administrator to join their workspace.', 'అడ్మిన్ ఇచ్చిన ఆర్గనైజేషన్ కోడ్ ఎంటర్ చేసి చేరండి.'))
          : pick('Sign in to your business workspace.', 'మీ వ్యాపార వర్క్‌స్పేస్‌లో లాగిన్ అవ్వండి.')}
      </p>

      <form className="space-y-4" onSubmit={submit}>
        <ErrorMessage error={error} />
        {signup && <Field name="name" en="Your name" te="మీ పేరు" autoComplete="name" required maxLength={120} />}
        {signup && (createOrganization ? <><Field name="businessName" en="Business name" te="వ్యాపారం పేరు" required maxLength={120} autoComplete="organization" /><p className="text-sm text-gray-600">{pick('We will create a short organization ID for your team to join.', 'మీ బృందం చేరడానికి చిన్న సంస్థ ఐడీని సృష్టిస్తాము.')}</p></> : <Field name="organizationId" en="Organization ID" te="సంస్థ ఐడీ" required maxLength={50} pattern="[a-zA-Z0-9-]+" autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="STONE-YARD-7K2M4N" title={pick('Enter the ID shared by your administrator', 'మీ అడ్మిన్ పంచుకున్న ఐడీని నమోదు చేయండి')} />)}
        <Field name="email" en="Email address" te="ఇమెయిల్ చిరునామా" type="email" autoComplete="username" required maxLength={254} />
        <Field name="password" en="Password" te="పాస్‌వర్డ్" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={12} maxLength={128} required />
        <label className="flex min-h-12 items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-teal-800" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />{pick('Show password', 'పాస్‌వర్డ్ చూపండి')}</label>
        {signup && <p className="text-sm text-gray-700">{pick('Use at least 12 characters.', 'కనీసం 12 అక్షరాలు ఉపయోగించండి.')}</p>}
        <Button primary type="submit" className="w-full" disabled={busy} en={busy ? 'Please wait…' : signup ? createOrganization ? 'Create organization' : 'Join organization' : 'Log in'} te={busy ? 'దయచేసి వేచి ఉండండి…' : signup ? createOrganization ? 'సంస్థ సృష్టించండి' : 'సంస్థలో చేరండి' : 'లాగిన్'} />
      </form>
      <button className="text-button mt-3 w-full underline underline-offset-4" disabled={busy} onClick={() => onMode(signup ? 'login' : 'signup')}>{signup ? pick('Already have an account? Log in', 'ఖాతా ఉందా? లాగిన్ అవ్వండి') : pick('New here? Create an account', 'కొత్తవారా? ఖాతా సృష్టించండి')}</button>
      <p className="mt-4 border-t border-gray-200 pt-4 text-sm leading-relaxed text-gray-600">{pick('Google and Phone OTP are not connected yet. Email delivery and password-reset emails are not configured.', 'Google మరియు ఫోన్ OTP ఇంకా అందుబాటులో లేవు. ఇమెయిల్ పంపడం మరియు పాస్‌వర్డ్ రీసెట్ ఇమెయిల్స్ ఇంకా అమర్చలేదు.')}</p>
    </div>
  </dialog>;
}
