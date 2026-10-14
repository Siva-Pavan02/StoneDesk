import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { request } from '../../lib/pilotApi.js';
import { authView } from '../../lib/authFlow.js';
import { Button, Field, ErrorMessage } from './Controls.jsx';
import { beginGoogleSignIn } from '../../lib/googleSignIn';

// Follows Google's sign-in branding guidelines: the standard multicolour "G" mark,
// approved "Continue with Google" wording, neutral light theme. The flow itself is
// Supabase's OAuth redirect, so this is a branded link-style button rather than
// the Identity Services rendered button.
function GoogleButton({ busy, onClick }) {
  const { pick } = useLanguage();
  return <button type="button" className="google-signin-button" disabled={busy} aria-busy={busy || undefined} onClick={onClick}>
    <svg className="google-signin-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
    <span>{busy ? pick('Please wait…', 'దయచేసి వేచి ఉండండి…') : pick('Continue with Google', 'Googleతో కొనసాగించండి')}</span>
  </button>;
}

// Method-first auth (Fix 5): chooser → Google or email & password.
// Local state (method, forgot, sent, createOrganization, showPassword, error, busy)
// is reset by App's <AuthDialog key={authMode || 'closed'} …>: every close and
// every mode change remounts this component, so no manual reset is needed here.
export default function AuthDialog({ mode, initialMethod = null, onClose, onSignedIn, onMode, googleSignup, initialError = '', onClearError }) {
  const dialog = useRef(null);
  const { pick } = useLanguage();
  const [method, setMethod] = useState(initialMethod); // null | 'google' | 'email'; initialMethod is read once per mount
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createOrganization, setCreateOrganization] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const signup = mode === 'signup';
  const linking = Boolean(googleSignup?.needsLink);
  const view = authView({ mode, method, googleSignup, forgot });
  const googleAttempt = useRef(null);
  // Close and mode changes remount this component; abandon any pending Google attempt.
  useEffect(() => () => googleAttempt.current?.abort(), []);
  // The pending Google view stays escapable; every other view keeps its busy lock.
  const locked = busy && view !== 'google';

  useEffect(() => { if (mode) { dialog.current.showModal(); } else dialog.current.close(); }, [mode]);

  async function submit(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError(''); onClearError?.();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    if (signup) values.createOrganization = createOrganization;
    // An opaque server-side ticket; the browser never holds Supabase tokens.
    if (googleSignup) values.googleTicket = googleSignup.ticket;
    try {
      const data = await request(googleSignup?.needsLink ? '/auth/google/link' : `/auth/${mode}`, { method: 'POST', body: values });
      e.target.reset();
      onSignedIn(data.user);
    }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function sendReset(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const email = new FormData(e.currentTarget).get('email');
      await request('/auth/forgot-password', { method: 'POST', body: { email } });
      setSent(true);
    }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function continueWithGoogle() {
    if (busy) return;
    const attempt = new AbortController(); googleAttempt.current = attempt;
    setMethod('google'); setBusy(true); setError(''); onClearError?.();
    try { await beginGoogleSignIn({ signal: attempt.signal }); }
    catch (err) { if (attempt.signal.aborted) return; setError(err.message); setBusy(false); setMethod(null); }
  }

  // Back control: on email → return to the chooser; on google-signup → ask App to
  // clear googleSignup while keeping the same authMode (no remount) so the view
  // falls through to the chooser.
  function backToChooser() {
    if (view === 'google-signup') onMode(mode);
    else {
      googleAttempt.current?.abort(); googleAttempt.current = null;
      setMethod(null); setForgot(false); setError(''); setBusy(false);
    }
  }

  const heading = view === 'forgot' ? pick('Reset your password', 'మీ పాస్‌వర్డ్ రీసెట్ చేయండి')
    : linking ? pick('Connect Google to StoneDesk', 'Googleను StoneDeskకు అనుసంధానించండి')
    : signup ? pick('Set up your account', 'మీ ఖాతా సృష్టించండి')
    : pick('Welcome back', 'తిరిగి స్వాగతం');

  const orgModeChoice = (
    <fieldset className="auth-mode">
      <legend className="auth-mode-legend">{pick('How are you joining?', 'ఎలా చేరుతున్నారు?')}</legend>
      {[
        [false, 'Join organization', 'సంస్థలో చేరండి', 'Use the private invitation code from your administrator.', 'మీ అడ్మిన్ ఇచ్చిన ఆహ్వాన కోడ్‌తో చేరండి.'],
        [true, 'Create new workspace', 'కొత్త వర్క్‌స్పేస్ సృష్టించండి', 'Set up your business. You will be the administrator.', 'మీ వ్యాపారాన్ని సెటప్ చేయండి. మీరు అడ్మిన్ అవుతారు.']
      ].map(([value, en, te, detailEn, detailTe]) => (
        <label key={en} className="auth-mode-option">
          <input type="radio" name="orgMode" className="auth-mode-input" checked={createOrganization === value} disabled={busy} onChange={() => setCreateOrganization(value)} />
          <span className="auth-mode-mark" aria-hidden="true" />
          <span className="auth-mode-text"><strong>{pick(en, te)}</strong><span>{pick(detailEn, detailTe)}</span></span>
        </label>
      ))}
    </fieldset>
  );

  const backControl = <button type="button" className="text-button mt-3 min-h-11 w-full text-sm underline underline-offset-4" disabled={locked} onClick={backToChooser}>{pick('Back to sign-in options', 'లాగిన్ ఎంపికలకు తిరిగి వెళ్ళండి')}</button>;

  const modeSwitch = <button type="button" className="text-button mt-3 min-h-11 w-full text-sm underline underline-offset-4" disabled={busy} onClick={() => onMode(signup ? 'login' : 'signup')}>{signup ? pick('Already have an account? Log in', 'ఖాతా ఉందా? లాగిన్ అవ్వండి') : pick('New here? Create an account', 'కొత్తవారా? ఖాతా సృష్టించండి')}</button>;

  return <dialog ref={dialog} className="app-dialog pilot auth-screen" aria-labelledby="auth-title" onCancel={e => { if (locked) e.preventDefault(); else onClose(); }}>
    <div className="p-6 text-sm"><div className="action-row flex items-center justify-between gap-3"><p className="eyebrow">STONEDESK</p><button type="button" className="text-button min-h-11 px-3" disabled={locked} onClick={onClose}>{pick('Close', 'మూసివేయండి')}</button></div>
      <h2 id="auth-title" className="screen-heading mt-3 text-2xl font-semibold">{heading}</h2>

      {view === 'chooser' && <>
        <p className="auth-intro">{signup ? pick('Choose how you want to create your account.', 'మీ ఖాతాను ఎలా సృష్టించాలో ఎంచుకోండి.') : pick('Sign in to your business workspace.', 'మీ వ్యాపార వర్క్‌స్పేస్‌లో లాగిన్ అవ్వండి.')}</p>
        <ErrorMessage error={error || initialError} />
        <div className="action-row mt-4"><GoogleButton busy={busy} onClick={continueWithGoogle} /></div>
        <div className="action-row mt-3"><Button className="w-full" disabled={busy} en="Use email & password" te="ఇమెయిల్ & పాస్‌వర్డ్ ఉపయోగించండి" onClick={() => { setMethod('email'); setError(''); }} /></div>
        {modeSwitch}
      </>}

      {view === 'google' && <>
        <p role="status" className="auth-intro mt-4">{pick('Opening Google…', 'Google తెరుస్తోంది…')}</p>
        {backControl}
      </>}

      {view === 'forgot' && <>
        <p className="auth-intro">{pick('Enter your account email. We will send a link that works for 1 hour.', 'మీ ఖాతా ఇమెయిల్ నమోదు చేయండి. 1 గంట పనిచేసే లింక్ పంపుతాము.')}</p>
        <form className="space-y-4" onSubmit={sendReset}>
          <Field name="email" en="Email address" te="ఇమెయిల్ చిరునామా" type="email" defaultValue={forgotEmail} autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} />
          <ErrorMessage error={error} />
          {sent && <p role="status" className="success-message">{pick('If that email exists, we sent a link', 'ఆ ఇమెయిల్ ఉంటే, మేము లింక్ పంపాము')}</p>}
          <div className="action-row"><Button primary type="submit" className="w-full" disabled={busy} en={busy ? 'Please wait…' : 'Send reset link'} te={busy ? 'దయచేసి వేచి ఉండండి…' : 'రీసెట్ లింక్ పంపండి'} /></div>
        </form>
        <button type="button" className="text-button mt-3 min-h-11 w-full text-sm underline underline-offset-4" disabled={busy} onClick={() => { setForgot(false); setSent(false); }}>{pick('Back to log in', 'లాగిన్‌కు తిరిగి వెళ్ళండి')}</button>
      </>}

      {(view === 'email' || view === 'google-signup' || view === 'link') && <>
        {view === 'link'
          ? <p className="auth-intro">{pick('Google verified your email. A StoneDesk account already exists with this address.', 'Google మీ ఇమెయిల్‌ను ధృవీకరించింది. ఈ చిరునామాతో ఇప్పటికే StoneDesk ఖాతా ఉంది.')}</p>
          : signup
            ? ((view === 'email' || view === 'google-signup') && orgModeChoice)
            : <p className="auth-intro">{pick('Sign in to your business workspace.', 'మీ వ్యాపార వర్క్‌స్పేస్‌లో లాగిన్ అవ్వండి.')}</p>}

        <form className="space-y-4" onSubmit={submit}>
          <ErrorMessage error={error || initialError} />
          {signup && <Field name="name" en="Your name" te="మీ పేరు" autoComplete="name" required maxLength={120} />}
          {signup && (createOrganization ? <><Field name="businessName" en="Business name" te="వ్యాపారం పేరు" required maxLength={120} autoComplete="organization" /><p className="text-sm text-gray-600">{pick('Invite your team from Settings after creating your workspace.', 'మీ బృందం చేరడానికి చిన్న సంస్థ ఐడీని సృష్టిస్తాము.')}</p></> : <Field name="invitationToken" en="Invitation code" te="ఆహ్వాన కోడ్" required minLength={43} maxLength={43} pattern="[A-Za-z0-9_-]{43}" autoCapitalize="none" autoCorrect="off" spellCheck={false} />)}
          {googleSignup ? <p className="break-all text-sm">{pick('Google account:', 'Google ఖాతా:')} {googleSignup.email}</p> : <Field name="email" en="Email address" te="ఇమెయిల్ చిరునామా" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} />}
          {googleSignup?.needsLink && <p className="text-sm text-gray-700">{pick('Confirm your StoneDesk password once to connect Google. Future Google sign-ins will not need it.', 'Googleను అనుసంధానించడానికి ఒకసారి మీ StoneDesk పాస్‌వర్డ్‌ను నిర్ధారించండి.')}</p>}
          {(!googleSignup || googleSignup.needsLink) && <>
          <Field name="password" en={linking ? 'Existing StoneDesk password' : 'Password'} te={linking ? 'ప్రస్తుత StoneDesk పాస్‌వర్డ్' : 'పాస్‌వర్డ్'} type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={12} maxLength={128} required />
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-teal-800" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />{pick('Show password', 'పాస్‌వర్డ్ చూపండి')}</label>
          {signup && <p className="text-sm text-gray-700">{pick('Use at least 12 characters.', 'కనీసం 12 అక్షరాలు ఉపయోగించండి.')}</p>}
          {!signup && !linking && !googleSignup && <button type="button" className="text-button text-sm underline underline-offset-4" disabled={busy} onClick={e => { setForgotEmail(e.currentTarget.form?.elements.email?.value || ''); setForgot(true); setError(''); }}>{pick('Forgot password?', 'పాస్‌వర్డ్ మర్చిపోయారా?')}</button>}
          </>}
          <div className="action-row"><Button primary type="submit" className="w-full" disabled={busy} en={busy ? 'Please wait…' : linking ? 'Connect Google and continue' : signup ? createOrganization ? 'Create organization' : 'Join organization' : 'Log in'} te={busy ? 'దయచేసి వేచి ఉండండి…' : linking ? 'Googleను అనుసంధానించి కొనసాగించండి' : signup ? createOrganization ? 'సంస్థ సృష్టించండి' : 'సంస్థలో చేరండి' : 'లాగిన్'} /></div>
        </form>

        {view !== 'link' && <>{backControl}{modeSwitch}</>}
      </>}
    </div>
  </dialog>;
}
