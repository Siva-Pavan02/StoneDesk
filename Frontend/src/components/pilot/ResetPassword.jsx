import { useId, useState } from 'react';
import { request } from '../../lib/pilotApi.js';
import { validResetLink } from '../../lib/authFlow.js';
import { BackButton, Button, Card, ErrorMessage, Field } from './Controls.jsx';

// Pre-authentication reset screen. App renders this when consumeResetLink() found a link.
// Props: { link, onDone, onLogin, onHome }. All text is bilingual via .
export default function ResetPassword({ link, onDone, onLogin, onHome }) {
  const showId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const password = new FormData(e.currentTarget).get('password');
    try {
      await request('/auth/reset-password', { method: 'POST', body: { token: link.token, email: link.email, password } });
      onDone();
    }
    catch (err) { setError(err.message); setBusy(false); }
  }

  return <div className="pilot min-h-dvh bg-surface px-4 py-12">
    <Card className="mx-auto max-w-lg gap-5">
      <BackButton label="Back to home" onClick={onHome} />
      {link.done
        ? <>
            <h1 className="sr-only">Password updated</h1>
            <p role="status">Password updated. Log in with your new password.</p>
            <Button primary label="Log in" onClick={onLogin} />
          </>
        : !validResetLink(link)
          ? <>
              <h1 className="sr-only">Reset link not valid</h1>
              <p>This reset link is incomplete or invalid. Request a new one from Log in → Forgot password?</p>
              <Button primary label="Log in" onClick={onLogin} />
            </>
          : <form className="flex flex-col gap-5" onSubmit={submit}>
              <h1 className="text-xl font-semibold">Choose a new password</h1>
              <p>Account: <strong translate="no">{link.email}</strong></p>
              <input type="text" autoComplete="username" value={link.email} readOnly hidden />
              <Field label="New password (12+ characters)">
                <input className="input" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" autoCapitalize="none" spellCheck={false} minLength={12} maxLength={128} required />
              </Field>
              <label className="flex items-center gap-2" htmlFor={showId}>
                <input id={showId} type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />
                Show password
              </label>
              <ErrorMessage error={error} />
              <Button primary type="submit" disabled={busy} aria-busy={busy || undefined} label={busy ? 'Please wait…' : 'Save new password'} />
            </form>}
    </Card>
  </div>;
}
