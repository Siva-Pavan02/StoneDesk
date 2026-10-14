import { useId, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { request } from '../../lib/pilotApi.js';
import { validResetLink } from '../../lib/authFlow.js';
import { Button, Card, ErrorMessage, Field } from './Controls.jsx';

// Pre-authentication reset screen. App renders this when consumeResetLink() found a link.
// Props: { link, onDone, onLogin, onHome }. All text is bilingual via pick().
export default function ResetPassword({ link, onDone, onLogin, onHome }) {
  const { pick } = useLanguage();
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

  return <div className="pilot min-h-dvh bg-gray-50 px-4 py-12">
    <Card className="mx-auto max-w-lg gap-5">
      {link.done
        ? <>
            <p role="status">{pick('Password updated. Log in with your new password.', 'పాస్‌వర్డ్ మార్చబడింది. కొత్త పాస్‌వర్డ్‌తో లాగిన్ అవ్వండి.')}</p>
            <Button primary en="Log in" te="లాగిన్" onClick={onLogin} />
            <Button en="Back to home" te="హోమ్‌కు తిరిగి వెళ్ళండి" onClick={onHome} />
          </>
        : !validResetLink(link)
          ? <>
              <p>{pick('This reset link is incomplete or invalid. Request a new one from Log in → Forgot password?', 'ఈ రీసెట్ లింక్ అసంపూర్ణం లేదా చెల్లదు. లాగిన్ → పాస్‌వర్డ్ మర్చిపోయారా? నుండి కొత్తది అభ్యర్థించండి.')}</p>
              <Button primary en="Log in" te="లాగిన్" onClick={onLogin} />
              <Button en="Back to home" te="హోమ్‌కు తిరిగి వెళ్ళండి" onClick={onHome} />
            </>
          : <form className="flex flex-col gap-5" onSubmit={submit}>
              <h1 className="text-xl font-semibold">{pick('Choose a new password', 'కొత్త పాస్‌వర్డ్ ఎంచుకోండి')}</h1>
              <p>{pick('Account:', 'ఖాతా:')} <strong>{link.email}</strong></p>
              <input type="text" autoComplete="username" value={link.email} readOnly hidden />
              <Field en="New password (12+ characters)" te="కొత్త పాస్‌వర్డ్ (12+ అక్షరాలు)">
                <input className="input" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" autoCapitalize="none" spellCheck={false} minLength={12} maxLength={128} required />
              </Field>
              <label className="flex items-center gap-2" htmlFor={showId}>
                <input id={showId} type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />
                {pick('Show password', 'పాస్‌వర్డ్ చూపండి')}
              </label>
              <ErrorMessage error={error} />
              <Button primary type="submit" disabled={busy} aria-busy={busy || undefined} en={busy ? 'Please wait…' : 'Save new password'} te={busy ? 'దయచేసి వేచి ఉండండి…' : 'కొత్త పాస్‌వర్డ్ సేవ్ చేయండి'} />
            </form>}
    </Card>
  </div>;
}
