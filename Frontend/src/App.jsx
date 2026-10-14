import { lazy, Suspense, useEffect, useState } from 'react';
import AuthDialog from './components/pilot/AuthDialog';
import LogoutDialog from './components/pilot/LogoutDialog';
import ResetPassword from './components/pilot/ResetPassword';
import { Button, Card, ErrorMessage } from './components/pilot/Controls';
import { request } from './lib/pilotApi';
import { useLanguage } from './i18n/LanguageContext';
import { finishGoogleSignIn } from './lib/googleSignIn';
import { appView, consumeResetLink, takeResetLinkFromHash } from './lib/authFlow';
const PilotApp = lazy(() => import('./components/pilot/PilotApp'));
const LandingPage = lazy(() => import('./components/pilot/LandingPage'));

export default function App() {
  const { pick } = useLanguage();
  // First state hook: the initializer strips the reset link from the URL during the first render.
  const [reset, setReset] = useState(() => consumeResetLink());
  const [user, setUser] = useState(null), [checking, setChecking] = useState(true);
  const [authMode, setAuthMode] = useState(null), [error, setError] = useState('');
  const [googleSignup, setGoogleSignup] = useState(null);
  const [welcome, setWelcome] = useState(window.location.hash === '#welcome');
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  function checkSession() {
    return request('/auth/session').then(data => { setUser(data.user); setError(''); })
      .catch(err => { if (err.status !== 401) setError(err.message); else setUser(null); })
      .finally(() => setChecking(false));
  }
  useEffect(() => {
    finishGoogleSignIn().then(data => {
      if (data?.user) signedIn(data.user);
      else if (data?.needsSignup || data?.needsLink) { setGoogleSignup(data); setAuthMode(data.needsLink ? 'login' : 'signup'); }
      else return checkSession();
    }).catch(err => { setError(err.message); setAuthMode('login'); })
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    const expired = () => { setUser(null); setAuthMode('login'); setError(pick('Your session ended. Sign in again; your unfinished load is saved on this device.', 'సెషన్ ముగిసింది. మళ్ళీ లాగిన్ అవ్వండి; మీ లోడ్ ఈ పరికరంలో సేవ్ అయింది.')); };
    // A reset link pasted into a loaded tab: show Reset_View and close any dialog. Never clears reset.
    const changed = () => {
      const link = takeResetLinkFromHash(window);
      if (link) { setReset(link); setGoogleSignup(null); setAuthMode(null); }
      setWelcome(window.location.hash === '#welcome');
    };
    window.addEventListener('session-expired', expired); window.addEventListener('hashchange', changed);
    return () => { window.removeEventListener('session-expired', expired); window.removeEventListener('hashchange', changed); };
  }, [pick]);
  async function logout() {
    try { await request('/auth/logout', { method: 'POST' }); setUser(null); window.location.hash = 'welcome'; setWelcome(true); }
    catch (err) { setError(err.message); }
  }
  function workspace() { window.location.hash = 'home'; setWelcome(false); }
  function signedIn(value) { setUser(value); setGoogleSignup(null); setAuthMode(null); setError(''); setReset(null); workspace(); }
  function resetDone() { setReset({ done: true }); setWelcome(true); checkSession(); }
  const view = appView({ reset, checking, user, welcome });
  return <>
    {error && !authMode && <div className="pilot mx-auto max-w-lg p-4"><ErrorMessage error={error} /></div>}
    <Suspense fallback={<div className="pilot p-6" role="status">{pick('Opening StoneDesk…', 'StoneDesk తెరుస్తోంది…')}</div>}>
    {view === 'reset' ? <ResetPassword link={reset} onDone={resetDone} onLogin={() => setAuthMode('login')} onHome={() => setReset(null)} /> :
      view === 'loading' ? <div className="pilot min-h-dvh bg-gray-50 p-6 text-gray-900" role="status">{pick('Opening StoneDesk…', 'StoneDesk తెరుస్తోంది…')}</div> :
      view === 'landing' ? <LandingPage user={user} onWorkspace={workspace} onStart={() => setAuthMode('signup')} onLogin={() => setAuthMode('login')} /> :
      view === 'pending' ? <div className="pilot min-h-dvh bg-gray-50 px-4 py-12"><Card className="mx-auto max-w-lg gap-5"><h1 className="text-2xl font-bold">{pick('Your account is ready for approval', 'మీ ఖాతా ఆమోదం కోసం సిద్ధంగా ఉంది')}</h1><p>{pick('Ask your business administrator to approve your account in Settings → Team & access.', 'సెట్టింగ్స్ → బృందం మరియు యాక్సెస్‌లో మీ ఖాతాను ఆమోదించమని అడ్మిన్‌ను అడగండి.')}</p><p className="break-all font-semibold">{user.email}</p><Button primary en="Check approval" te="ఆమోదం తనిఖీ చేయండి" onClick={checkSession} /><Button en="Log out" te="లాగ్ అవుట్" onClick={() => setConfirmingLogout(true)} /></Card></div> :
      <PilotApp user={user} onLogout={logout} onUserChange={setUser} />}
    </Suspense>
    {view === 'pending' && <LogoutDialog open={confirmingLogout} onCancel={() => setConfirmingLogout(false)} onConfirm={async () => { await logout(); setConfirmingLogout(false); }} />}
    <AuthDialog key={authMode || 'closed'} mode={authMode} initialMethod={reset?.done && authMode === 'login' ? 'email' : undefined} googleSignup={googleSignup} initialError={error} onClearError={() => setError('')} onClose={() => { setGoogleSignup(null); setAuthMode(null); }} onMode={value => { setError(''); setGoogleSignup(null); setAuthMode(value); }} onSignedIn={signedIn} />
  </>;
}
