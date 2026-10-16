import { useEffect, useRef, useState } from 'react';
import { request } from '../../lib/pilotApi.js';
import { authView } from '../../lib/authFlow.js';
import { BackButton, Button, Field, ErrorMessage } from './Controls.jsx';
import { beginGoogleSignIn } from '../../lib/googleSignIn';

// Follows Google's sign-in branding guidelines: the standard multicolour "G" mark,
// approved "Continue with Google" wording, neutral light theme. The flow itself is
// Supabase's OAuth redirect, so this is a branded link-style button rather than
// the Identity Services rendered button.
function GoogleButton({ busy, onClick }) {
  return <button type="button" className="google-signin-button" disabled={busy} aria-busy={busy || undefined} onClick={onClick}>
    <svg className="google-signin-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
    <span>{busy ? 'Please wait…' : 'Continue with Google'}</span>
  </button>;
}

// Method-first auth (Fix 5): chooser → Google or email & password.
// Local state (method, forgot, sent, createOrganization, showPassword, error, busy)
// is reset by App's <AuthDialog key={authMode || 'closed'} …>: every close and
// every mode change remounts this component, so no manual reset is needed here.
export default function AuthDialog({ mode, initialMethod = null, onClose, onSignedIn, onMode, googleSignup, initialError = '', onClearError }) {
  const dialog = useRef(null);
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

  const heading = view === 'forgot' ? 'Reset your password'
    : linking ? <>Connect <span translate="no">Google</span> to <span translate="no">StoneDesk</span></>
    : signup ? 'Set up your account'
    : 'Welcome back';

  const orgModeChoice = (
    <fieldset className="auth-mode">
      <legend className="auth-mode-legend">How are you joining?</legend>
      {[
        [false, 'Join organization', 'Use the private invitation code from your administrator.'],
        [true, 'Create new workspace', 'Set up your business. You will be the administrator.']
      ].map(([value, title, detail]) => (
        <label key={title} className="auth-mode-option">
          <input type="radio" name="orgMode" className="auth-mode-input" checked={createOrganization === value} disabled={busy} onChange={() => setCreateOrganization(value)} />
          <span className="auth-mode-mark" aria-hidden="true" />
          <span className="auth-mode-text"><strong>{title}</strong><span>{detail}</span></span>
        </label>
      ))}
    </fieldset>
  );

  // One back control, at the top of the dialog body, for every step past the sign-in chooser.
  const backControl = view === 'forgot'
    ? <BackButton className="mt-3" disabled={busy} onClick={() => { setForgot(false); setSent(false); }} label="Back to log in" />
    : view !== 'chooser' && view !== 'link' ? <BackButton className="mt-3" disabled={locked} onClick={backToChooser} label="Back to sign-in options" /> : null;

  const modeSwitch = <button type="button" className="text-button mt-3 w-full" disabled={busy} onClick={() => onMode(signup ? 'login' : 'signup')}>{signup ? 'Already have an account? Log in' : 'New here? Create an account'}</button>;

  return <dialog ref={dialog} className="app-dialog pilot auth-screen" aria-labelledby="auth-title" onCancel={e => { if (locked) e.preventDefault(); else onClose(); }}>
    <div className="p-6 text-sm"><div className="action-row flex items-center justify-between gap-3"><p className="eyebrow" translate="no">STONEDESK</p><button type="button" className="text-button px-3" disabled={locked} onClick={onClose}>Close</button></div>
      {backControl}
      {backControl}
      <h2 id="auth-title" className="screen-heading mt-3 text-2xl font-semibold">{heading}</h2>

      {view === 'chooser' && <>
        <p className="auth-intro">{signup ? 'Choose how you want to create your account.' : 'Sign in to your business workspace.'}</p>
        <ErrorMessage error={error || initialError} />
        <div className="action-row mt-4"><GoogleButton busy={busy} onClick={continueWithGoogle} /></div>
        <div className="action-row mt-3"><Button className="w-full" disabled={busy} label="Use email & password" onClick={() => { setMethod('email'); setError(''); }} /></div>
        {modeSwitch}
      </>}

      {view === 'google' && <>
        <p role="status" className="auth-intro mt-4">Opening Google…</p>
      </>}

      {view === 'forgot' && <>
        <p className="auth-intro">Enter your account email. We will send a link that works for 1 hour.</p>
        <form className="space-y-4" onSubmit={sendReset}>
          <Field name="email" label="Email address" type="email" defaultValue={forgotEmail} autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} />
          <ErrorMessage error={error} />
          {sent && <p role="status" className="success-message">If that email exists, we sent a link</p>}
          <div className="action-row"><Button primary type="submit" className="w-full" disabled={busy} label={busy ? 'Please wait…' : 'Send reset link'} /></div>
        </form>
      </>}

      {(view === 'email' || view === 'google-signup' || view === 'link') && <>
        {view === 'link'
          ? <p className="auth-intro">Google verified your email. A StoneDesk account already exists with this address.</p>
          : signup
            ? ((view === 'email' || view === 'google-signup') && orgModeChoice)
            : <p className="auth-intro">Sign in to your business workspace.</p>}

        <form className="space-y-4" onSubmit={submit}>
          <ErrorMessage error={error || initialError} />
          {signup && <Field name="name" label="Your name" autoComplete="name" required maxLength={120} />}
          {signup && (createOrganization ? <><Field name="businessName" label="Business name" required maxLength={120} autoComplete="organization" /><p className="text-sm text-on-surface-variant">Invite your team from Settings after creating your workspace.</p></> : <Field name="invitationToken" label="Invitation code" required minLength={43} maxLength={43} pattern="[A-Za-z0-9_-]{43}" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} />)}
          {googleSignup ? <p className="break-all text-sm">Google account: <span translate="no">{googleSignup.email}</span></p> : <Field name="email" label="Email address" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} />}
          {googleSignup?.needsLink && <p className="text-sm text-on-surface">Confirm your StoneDesk password once to connect Google. Future Google sign-ins will not need it.</p>}
          {(!googleSignup || googleSignup.needsLink) && <>
          <Field name="password" label={linking ? 'Existing StoneDesk password' : 'Password'} type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} minLength={12} maxLength={128} required />
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-primary" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />Show password</label>
          {signup && <p className="text-sm text-on-surface">Use at least 12 characters.</p>}
          {!signup && !linking && !googleSignup && <button type="button" className="text-button self-start" disabled={busy} onClick={e => { setForgotEmail(e.currentTarget.form?.elements.email?.value || ''); setForgot(true); setError(''); }}>Forgot password?</button>}
          </>}
          <div className="action-row"><Button primary type="submit" className="w-full" disabled={busy} label={busy ? 'Please wait…' : linking ? 'Connect Google and continue' : signup ? createOrganization ? 'Create organization' : 'Join organization' : 'Log in'} /></div>
        </form>

        {view !== 'link' && modeSwitch}
      </>}
    </div>
  </dialog>;
}
