import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { request } from '../../lib/pilotApi.js';
import { Button, Field, ErrorMessage } from './Controls.jsx';
import { beginGoogleSignIn } from '../../lib/googleSignIn';

export default function AuthDialog({ mode, onClose, onSignedIn, onMode, googleSignup, initialError = '', onClearError }) {
  const dialog = useRef(null);
  const { pick } = useLanguage();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createOrganization, setCreateOrganization] = useState(false);
  const signup = mode === 'signup';
  const linking = Boolean(googleSignup?.needsLink);
  
  useEffect(() => { if (mode) { dialog.current.showModal(); } else dialog.current.close(); }, [mode]);
  
  async function submit(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError(''); onClearError?.();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    if (signup) values.createOrganization = createOrganization;
    if (googleSignup) values.googleAccessToken = googleSignup.accessToken;
    try { 
      const data = await request(googleSignup?.needsLink ? '/auth/google/link' : `/auth/${mode}`, { method: 'POST', body: values });
      e.target.reset(); 
      onSignedIn(data.user); 
    }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  
  return <dialog ref={dialog} className="app-dialog pilot auth-screen" aria-labelledby="auth-title" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }}>
    <div className="p-6 text-sm"><div className="action-row flex items-center justify-between gap-3"><p className="eyebrow">STONEDESK</p><button type="button" className="text-button min-h-11 px-3" disabled={busy} onClick={onClose}>{pick('Close', 'మూసివేయండి')}</button></div>
      <h2 id="auth-title" className="screen-heading mt-3 text-2xl font-semibold">{linking ? pick('Connect Google to StoneDesk', 'Googleను StoneDeskకు అనుసంధానించండి') : signup ? pick('Set up your account', 'మీ ఖాతా సృష్టించండి') : pick('Welcome back', 'తిరిగి స్వాగతం')}</h2>
      
      {signup ? (
        <fieldset className="auth-mode">
          <legend className="auth-mode-legend">{pick('How are you joining?', 'ఎలా చేరుతున్నారు?')}</legend>
          {[
            [false, 'Join organization', 'సంస్థలో చేరండి', 'Use the organization ID from your administrator.', 'మీ అడ్మిన్ ఇచ్చిన సంస్థ ఐడీతో చేరండి.'],
            [true, 'Create new workspace', 'కొత్త వర్క్‌స్పేస్ సృష్టించండి', 'Set up your business. You will be the administrator.', 'మీ వ్యాపారాన్ని సెటప్ చేయండి. మీరు అడ్మిన్ అవుతారు.']
          ].map(([value, en, te, detailEn, detailTe]) => (
            <label key={en} className="auth-mode-option">
              <input type="radio" name="orgMode" className="auth-mode-input" checked={createOrganization === value} disabled={busy} onChange={() => setCreateOrganization(value)} />
              <span className="auth-mode-mark" aria-hidden="true" />
              <span className="auth-mode-text"><strong>{pick(en, te)}</strong><span>{pick(detailEn, detailTe)}</span></span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="auth-intro">{linking ? pick('Google verified your email. A StoneDesk account already exists with this address.', 'Google మీ ఇమెయిల్‌ను ధృవీకరించింది. ఈ చిరునామాతో ఇప్పటికే StoneDesk ఖాతా ఉంది.') : pick('Sign in to your business workspace.', 'మీ వ్యాపార వర్క్‌స్పేస్‌లో లాగిన్ అవ్వండి.')}</p>
      )}

      <form className="space-y-4" onSubmit={submit}>
        <ErrorMessage error={error || initialError} />
        {signup && <Field name="name" en="Your name" te="మీ పేరు" autoComplete="name" required maxLength={120} />}
        {signup && (createOrganization ? <><Field name="businessName" en="Business name" te="వ్యాపారం పేరు" required maxLength={120} autoComplete="organization" /><p className="text-sm text-gray-600">{pick('We will create a short organization ID for your team to join.', 'మీ బృందం చేరడానికి చిన్న సంస్థ ఐడీని సృష్టిస్తాము.')}</p></> : <Field name="organizationId" en="Organization ID" te="సంస్థ ఐడీ" required maxLength={50} pattern="[a-zA-Z0-9-]+" autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="STONE-YARD-7K2M4N" title={pick('Enter the ID shared by your administrator', 'మీ అడ్మిన్ పంచుకున్న ఐడీని నమోదు చేయండి')} />)}
        {googleSignup ? <p className="break-all text-sm">{pick('Google account:', 'Google ఖాతా:')} {googleSignup.email}</p> : <Field name="email" en="Email address" te="ఇమెయిల్ చిరునామా" type="email" autoComplete="username" required maxLength={254} />}
        {googleSignup?.needsLink && <p className="text-sm text-gray-700">{pick('Confirm your StoneDesk password once to connect Google. Future Google sign-ins will not need it.', 'Googleను అనుసంధానించడానికి ఒకసారి మీ StoneDesk పాస్‌వర్డ్‌ను నిర్ధారించండి.')}</p>}
        {(!googleSignup || googleSignup.needsLink) && <>
        <Field name="password" en={linking ? 'Existing StoneDesk password' : 'Password'} te={linking ? 'ప్రస్తుత StoneDesk పాస్‌వర్డ్' : 'పాస్‌వర్డ్'} type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={12} maxLength={128} required />
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-teal-800" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />{pick('Show password', 'పాస్‌వర్డ్ చూపండి')}</label>
        {signup && <p className="text-sm text-gray-700">{pick('Use at least 12 characters.', 'కనీసం 12 అక్షరాలు ఉపయోగించండి.')}</p>}
        </>}
        <div className="action-row"><Button primary type="submit" className="w-full" disabled={busy} en={busy ? 'Please wait…' : linking ? 'Connect Google and continue' : signup ? createOrganization ? 'Create organization' : 'Join organization' : 'Log in'} te={busy ? 'దయచేసి వేచి ఉండండి…' : linking ? 'Googleను అనుసంధానించి కొనసాగించండి' : signup ? createOrganization ? 'సంస్థ సృష్టించండి' : 'సంస్థలో చేరండి' : 'లాగిన్'} /></div>
      </form>
      {!googleSignup && <div className="mt-4 border-t border-gray-200 pt-4"><Button className="w-full" style={{ minHeight: 48 }} disabled={busy} en={busy ? 'Please wait…' : 'Continue with Google'} te={busy ? 'దయచేసి వేచి ఉండండి…' : 'Googleతో కొనసాగించండి'} onClick={async () => {
        if (busy) return;
        setBusy(true); setError(''); onClearError?.();
        try { await beginGoogleSignIn(); } catch (err) { setError(err.message); setBusy(false); }
      }} /></div>}
      {!linking && <button type="button" className="text-button mt-3 min-h-11 w-full text-sm underline underline-offset-4" disabled={busy} onClick={() => onMode(signup ? 'login' : 'signup')}>{signup ? pick('Already have an account? Log in', 'ఖాతా ఉందా? లాగిన్ అవ్వండి') : pick('New here? Create an account', 'కొత్తవారా? ఖాతా సృష్టించండి')}</button>}
    </div>
  </dialog>;
}
