import { lazy, Suspense, useEffect, useState } from 'react';
import PilotApp from './components/pilot/PilotApp';
import LandingPage from './components/pilot/LandingPage';
import AuthDialog from './components/pilot/AuthDialog';
import { Button, Card, ErrorMessage } from './components/pilot/Controls';
import { request } from './lib/pilotApi';
import { useLanguage } from './i18n/LanguageContext';
const SettingsScreen = lazy(() => import('./components/SettingsScreen'));
const LoadingListScreen = lazy(() => import('./components/LoadingListScreen'));

export default function App() {
  const { pick } = useLanguage();
  const [user, setUser] = useState(null), [checking, setChecking] = useState(true);
  const [authMode, setAuthMode] = useState(null), [error, setError] = useState('');
  const [welcome, setWelcome] = useState(window.location.hash === '#welcome');
  const [legacy, setLegacy] = useState(null);
  function checkSession() {
    return request('/auth/me').then(data => { setUser(data.user); setError(''); })
      .catch(err => { if (err.status !== 401) setError(err.message); else setUser(null); })
      .finally(() => setChecking(false));
  }
  useEffect(() => { checkSession(); }, []);
  useEffect(() => {
    const expired = () => { setUser(null); setAuthMode('login'); setError(pick('Your session ended. Sign in again; your unfinished load is saved on this device.', 'సెషన్ ముగిసింది. మళ్ళీ లాగిన్ అవ్వండి; మీ లోడ్ ఈ పరికరంలో సేవ్ అయింది.')); };
    const changed = () => setWelcome(window.location.hash === '#welcome');
    window.addEventListener('session-expired', expired); window.addEventListener('hashchange', changed);
    return () => { window.removeEventListener('session-expired', expired); window.removeEventListener('hashchange', changed); };
  }, [pick]);
  async function logout() {
    try { await request('/auth/logout', { method: 'POST' }); setUser(null); setLegacy(null); window.location.hash = 'welcome'; setWelcome(true); }
    catch (err) { setError(err.message); }
  }
  function workspace() { window.location.hash = 'home'; setWelcome(false); setLegacy(null); }
  function signedIn(value) { setUser(value); setAuthMode(null); setError(''); workspace(); }
  if (checking) return <div className="pilot min-h-dvh bg-gray-50 p-6 text-gray-900" role="status">{pick('Opening GraniteSync…', 'GraniteSync తెరుస్తోంది…')}</div>;
  return <>
    {error && <div className="pilot mx-auto max-w-lg p-4"><ErrorMessage error={error} /></div>}
    {!user || welcome ? <LandingPage user={user} onWorkspace={workspace} onStart={() => setAuthMode('signup')} onLogin={() => setAuthMode('login')} /> : !user.active ? <div className="pilot min-h-dvh bg-gray-50 px-4 py-12"><Card className="mx-auto max-w-lg gap-5"><h1 className="text-2xl font-bold">{pick('Your account is ready for approval', 'మీ ఖాతా ఆమోదం కోసం సిద్ధంగా ఉంది')}</h1><p>{pick('Ask your business administrator to approve your account in Settings → Team & access.', 'సెట్టింగ్స్ → బృందం మరియు యాక్సెస్‌లో మీ ఖాతాను ఆమోదించమని అడ్మిన్‌ను అడగండి.')}</p><p className="break-all font-semibold">{user.email}</p><Button primary en="Check approval" te="ఆమోదం తనిఖీ చేయండి" onClick={checkSession} /><Button en="Log out" te="లాగ్ అవుట్" onClick={logout} /></Card></div> :
      <Suspense fallback={<p role="status" className="p-6 bg-gray-50 text-gray-900">{pick('Loading…', 'లోడ్ అవుతోంది…')}</p>}>
        {legacy === 'settings' && user.role === 'Admin' ? <SettingsScreen onClose={() => setLegacy(null)} /> : legacy === 'loading-lists' ? <LoadingListScreen onClose={() => setLegacy(null)} /> : <PilotApp user={user} onLogout={logout} onLanding={() => { window.location.hash = 'welcome'; setWelcome(true); }} onOpenLoadingLists={() => setLegacy('loading-lists')} onOpenLegacySettings={() => setLegacy('settings')} />}
      </Suspense>}
    <AuthDialog key={authMode || 'closed'} mode={authMode} onClose={() => setAuthMode(null)} onMode={setAuthMode} onSignedIn={signedIn} />
  </>;
}
