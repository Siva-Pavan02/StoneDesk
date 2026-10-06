import LanguageToggle from '../LanguageToggle.jsx';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { logoUrl, request, settingsPath } from '../../lib/pilotApi.js';
import { fromDispatch, newDraft, readDraft, money } from '../../utils/pilotDraft.js';
import { Button, Card, ErrorMessage } from './Controls.jsx';
import BusinessSetup from './BusinessSetup.jsx';
import ProductSettings from './ProductSettings.jsx';
import NewLoad from './NewLoad.jsx';
const BillView = lazy(() => import('./BillView.jsx'));

export default function PilotApp({ onOpenLoadingLists, onOpenLegacySettings }) {
  const { pick, t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [loads, setLoads] = useState([]);
  const [view, setView] = useState('home');
  const [record, setRecord] = useState(null);
  const [initialDraft, setInitialDraft] = useState(null);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [busy, setBusy] = useState(true);
  async function refreshLoads() {
    try { setLoads(await request('/dispatches')); setHistoryError(''); }
    catch (err) { setHistoryError(err.message); }
  }
  function load() {
    return request(settingsPath).then(data => {
      setSettings(data);
      if (!data.businessName) setView('profile');
      else if (!data.stoneRates.length) setView('products');
      return refreshLoads();
    }).catch(err => setError(err.message)).finally(() => setBusy(false));
  }
  useEffect(() => { load(); }, []);
  function home() { setView('home'); setError(''); refreshLoads(); window.scrollTo(0, 0); }
  async function open(id) {
    setBusy(true); setError('');
    try { setRecord(await request(`/dispatches/${id}`)); setView('bill'); window.scrollTo(0, 0); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  function resume(value) {
    const recovery = readDraft();
    if (recovery && recovery.serverId !== value._id && !window.confirm(pick('Replace the unsaved load on this phone with this saved draft?', 'ఫోన్‌లోని సేవ్ చేయని లోడ్ స్థానంలో ఈ డ్రాఫ్ట్ తెరవాలా?'))) return;
    setInitialDraft(fromDispatch(value)); setView('load'); window.scrollTo(0, 0);
  }
  const recovery = readDraft();
  return <div className="pilot min-h-screen bg-gray-50 text-gray-900 pb-8">
    <header className="bg-white border-b border-gray-200"><div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
      {settings?.logoPath ? <img src={logoUrl(settings.logoPath)} alt="Business logo" className="w-12 h-12 object-contain" /> : <div className="h-12 w-12 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold text-xl" aria-hidden="true">{settings?.businessName?.[0] || 'G'}</div>}
      <div className="min-w-0 flex-1"><p className="font-bold break-words">{settings?.businessName || 'GraniteSync'}</p><p className="text-xs text-gray-600 mt-1">{pick('Business load book', 'లోడ్ పుస్తకం')}</p></div><LanguageToggle />
    </div></header>
    <main className="max-w-md mx-auto p-4 space-y-4" aria-busy={busy}>
      <ErrorMessage error={error} />
      {busy ? <p role="status" className="py-10 text-center font-semibold">{pick('Loading…', 'లోడ్ అవుతోంది')}</p> : !settings ? <Button en="Retry" te="మళ్ళీ ప్రయత్నించండి" onClick={() => { setBusy(true); setError(''); load(); }} /> : view === 'profile' ?
        <BusinessSetup settings={settings} onBack={settings.businessName ? home : undefined} onSaved={data => { setSettings(data); setView(data.stoneRates.length ? 'home' : 'products'); }} /> : view === 'products' ?
        <ProductSettings settings={settings} onChanged={setSettings} onBack={home} /> : view === 'load' ?
        <NewLoad settings={settings} initialDraft={initialDraft} onBack={home} onSaved={data => { setRecord(data); setView('bill'); refreshLoads(); window.scrollTo(0, 0); }} /> : view === 'bill' ?
        <Suspense fallback={<p role="status">{pick('Loading bill…', 'బిల్లు లోడ్ అవుతోంది')}</p>}><BillView record={record} onBack={home} onResume={resume} /> </Suspense> : <>
          <div className="pt-2"><h1 className="text-2xl font-bold">{pick('Ready for the next load?', 'కొత్త లోడ్ ప్రారంభించండి')}</h1></div>
          {!settings.stoneRates.length ? <Card className="gap-3"><p>{pick('Add your first product and rate to start a load.', 'లోడ్ ప్రారంభించడానికి రకం మరియు ధరను జోడించండి.')}</p><Button primary en="Add products" te="రకాలు జోడించండి" onClick={() => setView('products')} /></Card> :
            <Button primary className="w-full min-h-20 justify-between px-5 text-lg" en={recovery ? 'Continue unsaved load' : 'New Load'} te={recovery ? 'లోడ్ కొనసాగించండి' : 'కొత్త లోడ్'} onClick={() => { setInitialDraft(null); setView('load'); }}><span aria-hidden="true" className="text-3xl">+</span></Button>}
          {recovery && settings.stoneRates.length > 0 && <Button className="w-full" en="Start another New Load" te="కొత్త లోడ్ ప్రారంభించండి" onClick={() => {
            if (!window.confirm(pick('Replace the unsaved load on this phone? Server-saved drafts will remain in recent loads.', 'ఫోన్‌లోని సేవ్ చేయని లోడ్ స్థానంలో కొత్త లోడ్ ప్రారంభించాలా? సేవ్ చేసిన డ్రాఫ్ట్‌లు అలాగే ఉంటాయి.'))) return;
            setInitialDraft(newDraft(settings.defaultRoyaltyFee)); setView('load');
          }} />}
          <div className="grid grid-cols-2 gap-3"><Button en="Business profile" te="వ్యాపార వివరాలు" onClick={() => setView('profile')} /><Button en="Products & rates" te="రకాలు / ధరలు" onClick={() => setView('products')} /></div>
          <h2 className="font-bold text-lg pt-3">{pick('Recent loads', 'ఇటీవలి లోడ్లు')}</h2>
          <ErrorMessage error={historyError} />
          {historyError && <Button en="Retry loads" te="మళ్ళీ లోడ్ చేయండి" onClick={refreshLoads} />}
          {!loads.length && !historyError && <Card><p>{pick('No loads yet. Your saved loads will appear here.', 'ఇంకా లోడ్లు లేవు. సేవ్ చేసిన లోడ్లు ఇక్కడ కనిపిస్తాయి.')}</p></Card>}
          {loads.map(item => <Card key={item._id} className="gap-3"><div className="flex justify-between gap-3"><div className="min-w-0"><h3 className="font-bold break-words">{item.partyName || item.logistics.truckNumber}</h3><p className="text-sm text-gray-700">{item.logistics.truckNumber} · {new Date(item.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p></div><strong className="shrink-0 text-sm">{t(item.status.toLowerCase())}</strong></div><strong>{money(item.summary.netBillableAmount)}</strong><Button en={item.status === 'Draft' ? 'Open draft' : 'Open bill'} te="వివరాలు చూడండి" onClick={() => open(item._id)} /></Card>)}
          <Button className="w-full" en="Loading requirements" te="లోడింగ్ అవసరాలు" onClick={onOpenLoadingLists} />
          <Button className="w-full" en="Saved trucks & destinations" te="లారీలు / గమ్యస్థానాలు" onClick={onOpenLegacySettings} />
        </>}
    </main>
  </div>;
}
