import { useLanguage } from '../../i18n/LanguageContext';
import { lazy, Suspense, useEffect, useState } from 'react';
import { request, settingsPath } from '../../lib/pilotApi.js';
import { fromDispatch, newDraft, readDraft, clearDraft } from '../../utils/pilotDraft.js';
import { Button, Card, ErrorMessage } from './Controls.jsx';
import BusinessSetup from './BusinessSetup.jsx';
import ProductSettings from './ProductSettings.jsx';
import NewLoad from './NewLoad.jsx';
import WorkspaceShell from './WorkspaceShell.jsx';
import LoadHub from './LoadHub.jsx';
import AccountSettings from './AccountSettings.jsx';
const BillView = lazy(() => import('./BillView.jsx'));
const route = () => window.location.hash.slice(1) || 'home';

export default function PilotApp({ user, onLogout, onLanding, onOpenLoadingLists, onOpenLegacySettings }) {
  const { pick } = useLanguage();
  const [settings, setSettings] = useState(null), [loads, setLoads] = useState([]);
  const [view, setView] = useState(route), [record, setRecord] = useState(null);
  const [initialDraft, setInitialDraft] = useState(null), [query, setQuery] = useState('');
  const [error, setError] = useState(''), [historyError, setHistoryError] = useState('');
  const [busy, setBusy] = useState(true), [refreshing, setRefreshing] = useState(false), [updatedAt, setUpdatedAt] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const admin = user.role === 'Admin', canFinalize = user.role !== 'Yard Manager';
  function navigate(next) { window.location.hash = next; setView(next); setError(''); window.scrollTo(0, 0); }
  async function refreshLoads() {
    setRefreshing(true);
    try {
      const res = await request('/dispatches');
      setLoads(res.data); setNextCursor(res.nextCursor); setHistoryError(''); setUpdatedAt(Date.now());
    } catch (err) { setHistoryError(err.message); } finally { setRefreshing(false); }
  }
  async function loadMore() {
    if (!nextCursor || refreshing) return;
    setRefreshing(true);
    try {
      const res = await request(`/dispatches?cursor=${nextCursor}`);
      setLoads(prev => [...prev, ...res.data]); setNextCursor(res.nextCursor);
    } catch (err) { setHistoryError(err.message); } finally { setRefreshing(false); }
  }
  function load() {
    return request(settingsPath(user.organizationId)).then(data => { setSettings(data); return refreshLoads(); })
      .catch(err => setError(err.message)).finally(() => setBusy(false));
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const changed = () => setView(route()); window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, []);
  // readDraft is async — read it into state so we never pass a Promise as a prop
  useEffect(() => {
    if (!settings?.id) return;
    let cancelled = false;
    readDraft(undefined, settings.id).then(value => { if (!cancelled) setRecovery(value); });
    return () => { cancelled = true; };
  }, [settings?.id, view]);
  useEffect(() => {
    if (view !== 'monitor') return;
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refreshLoads(); }, 30000);
    return () => clearInterval(interval);
  }, [view]);
  useEffect(() => {
    if (!view.startsWith('bill/')) return;
    const id = view.slice(5);
    if (record?.id === id) return;
    let cancelled = false;
    request(`/dispatches/${id}`).then(data => { if (!cancelled) setRecord(data); }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [view, record?.id]);
  function home() { navigate('home'); refreshLoads(); }
  async function newLoad() {
    if (!settings?.businessName) return navigate('profile');
    if (!settings.stoneRates.length) return navigate('products');
    const currentRecovery = await readDraft(undefined, settings.id);
    if (currentRecovery && !window.confirm(pick('Start a new load and replace the unfinished load on this phone? Use Continue to keep working on it.', 'ఫోన్‌లోని పూర్తి కాని లోడ్ స్థానంలో కొత్త లోడ్ ప్రారంభించాలా?'))) return;
    if (!await clearDraft(settings.id)) { setError('Unable to replace the recovery copy. Check browser storage.'); return; }
    setRecovery(null);
    setInitialDraft({ ...newDraft(settings.defaultRoyaltyFee), supervisor: user.name }); navigate('load');
  }
  async function resume(value) {
    const currentRecovery = await readDraft(undefined, settings.id);
    if (currentRecovery && currentRecovery.serverId !== value.id && !window.confirm(pick('Replace the unsaved load on this phone with this saved draft?', 'ఫోన్‌లోని సేవ్ చేయని లోడ్ స్థానంలో ఈ డ్రాఫ్ట్ తెరవాలా?'))) return;
    if (!await clearDraft(settings.id)) { setError('Unable to replace the recovery copy. Check browser storage.'); return; }
    setRecovery(null);
    setInitialDraft(fromDispatch(value)); navigate('load');
  }
  function saved(data) { setRecovery(null); setRecord(data); navigate(`bill/${data.id}`); refreshLoads(); }
  const needsSetup = settings && (!settings.businessName || !settings.stoneRates.length);
  const current = needsSetup && !['settings', 'profile'].includes(view) ? (!settings.businessName ? 'profile' : 'products') : view.split('/')[0];
  let content;
  const openingBill = view.startsWith('bill/') && record?.id !== view.slice(5) && !error;
  if (busy || openingBill) content = <div role="status" className="space-y-4"><p className="font-semibold">{pick('Loading workspace…', 'వర్క్‌స్పేస్ లోడ్ అవుతోంది…')}</p><div className="h-24 rounded-2xl bg-gray-200" /><div className="h-44 rounded-2xl bg-gray-200" /></div>;
  else if (!settings) content = <Button en="Retry connection" te="మళ్ళీ ప్రయత్నించండి" onClick={load} />;
  else if (['profile', 'products'].includes(current) && !admin) content = <Card><p>{pick('Ask your administrator to complete business setup or update products.', 'వ్యాపార వివరాలు లేదా రకాలను మార్చడానికి అడ్మిన్‌ను సంప్రదించండి.')}</p></Card>;
  else if (current === 'profile') content = <BusinessSetup settings={settings} user={user} onBack={settings.businessName ? home : undefined} onSaved={data => { setSettings(data); navigate(data.stoneRates.length ? 'home' : 'products'); }} />;
  else if (current === 'products') content = <ProductSettings settings={settings} onChanged={setSettings} onBack={home} onboarding={needsSetup} user={user} />;
  else if (current === 'load') content = <NewLoad recentLoads={loads} user={user} key={initialDraft?.clientRequestId || 'recovery'} settings={settings} initialDraft={initialDraft} canFinalize={canFinalize} onBack={home} onSaved={saved} />;
  else if (current === 'bill') content = record && record.id === view.slice(5) ? <Suspense fallback={<p>{pick('Loading bill…', 'బిల్లు లోడ్ అవుతోంది…')}</p>}><BillView record={record} canFinalize={canFinalize} onChanged={saved} onBack={home} onResume={resume} /></Suspense> : <Button en="Back to dashboard" te="డ్యాష్‌బోర్డ్‌కు వెళ్ళండి" onClick={home} />;
  else if (current === 'settings') content = <AccountSettings settings={settings} user={user} navigate={navigate} onLogout={onLogout} onLoadingLists={onOpenLoadingLists} onLegacySettings={onOpenLegacySettings} onLanding={onLanding} />;
  else content = <><ErrorMessage error={historyError} /><LoadHub key={current} loads={loads} view={current} query={query} onOpen={id => navigate(`bill/${id}`)} onNew={newLoad} onRefresh={refreshLoads} onLoadMore={loadMore} hasMore={!!nextCursor} loading={refreshing} recovery={recovery} onContinue={() => { setInitialDraft(recovery); setRecovery(null); navigate('load'); }} onNavigate={navigate} updatedAt={updatedAt} /></>;
  return <WorkspaceShell settings={settings} user={user} view={current} navigate={navigate} onNew={newLoad} onLogout={onLogout} query={query} setQuery={setQuery} attention={loads.filter(l => l.status === 'Draft').length}><ErrorMessage error={error} />{content}</WorkspaceShell>;
}
