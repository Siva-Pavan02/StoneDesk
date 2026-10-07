import { useRef } from 'react';
import LanguageToggle from '../LanguageToggle.jsx';
import { useLanguage } from '../../i18n/LanguageContext';
import { logoUrl } from '../../lib/pilotApi.js';
import Icon from './Icon.jsx';

const navigation = [['home', 'home', 'Dashboard', 'డ్యాష్‌బోర్డ్'], ['entries', 'loads', 'Loading entries', 'లోడ్ వివరాలు'], ['monitor', 'truck', 'Monitor & dispatch', 'లోడ్ మానిటర్'], ['invoices', 'bill', 'Invoices', 'బిల్లులు'], ['settings', 'settings', 'Settings', 'సెట్టింగ్స్']];
export default function WorkspaceShell({ settings, user, view, navigate, onNew, onLogout, query, setQuery, attention, children }) {
  const { pick } = useLanguage();
  const drawer = useRef(null), notifications = useRef(null);
  function go(viewName) { drawer.current.close(); navigate(viewName); }
  return <div className="pilot min-h-dvh bg-gray-50 text-gray-900 pb-24">
    <a href="#workspace-main" className="skip-link">{pick('Skip to content', 'విషయానికి వెళ్ళండి')}</a>
    <header className="border-b border-gray-200 bg-white"><div className="mx-auto max-w-7xl px-4 py-3">
      <div className="flex items-center gap-2"><button className="icon-button" aria-label={pick('Open navigation', 'మెనూ తెరవండి')} onClick={() => drawer.current.showModal()}><Icon name="menu" /></button>
        <div className="min-w-0 flex-1"><p className="truncate font-bold">{settings?.businessName || 'StoneDesk'}</p><p className="text-xs text-gray-600">{pick('YARD WORKSPACE', 'యార్డ్ వర్క్‌స్పేస్')}</p></div><LanguageToggle /><button className="icon-button" aria-label={pick('Notifications and tasks', 'నోటిఫికేషన్లు')} onClick={() => notifications.current.showModal()}><Icon name="bell" /></button>
      </div>
      <div className="mt-3 flex items-center gap-2 max-w-2xl"><form className="relative min-w-0 flex-1" onSubmit={e => { e.preventDefault(); navigate('entries'); }}><label className="sr-only" htmlFor="global-search">{pick('Search lorry, party or invoice ID', 'లారీ, పార్టీ లేదా బిల్లు వెతకండి')}</label><input id="global-search" type="search" className="input rounded-xl pr-12" value={query} onChange={e => setQuery(e.target.value)} placeholder={pick('Lorry, party or bill ID', 'లారీ, పార్టీ లేదా బిల్లు')} /><button type="submit" className="icon-button absolute right-0 top-0" aria-label={pick('Search', 'వెతకండి')}><Icon name="search" /></button></form><button className="icon-button bg-teal-800 text-white shrink-0" aria-label={pick('New load', 'కొత్త లోడ్')} onClick={onNew}><Icon name="plus" /></button></div>
    </div></header>
    <main id="workspace-main" tabIndex={-1} className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:py-8">{children}</main>
    <nav aria-label={pick('Main navigation', 'ప్రధాన నావిగేషన్')} className="bottom-nav"><div className="mx-auto grid max-w-7xl grid-cols-5">{navigation.map(([key, icon, en, te]) => <button key={key} aria-current={view === key ? 'page' : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${view === key ? 'text-teal-800 bg-teal-50' : 'text-gray-700'}`} onClick={() => navigate(key)}><Icon name={icon} />{pick(key === 'entries' ? 'Loads' : key === 'monitor' ? 'Monitor' : en, te)}</button>)}</div></nav>
    <dialog ref={drawer} className="app-dialog nav-drawer" aria-labelledby="nav-title"><div className="flex min-h-full flex-col p-5"><div className="flex items-center gap-3 border-b border-gray-200 pb-5">{settings?.logoPath ? <img src={logoUrl(settings.logoPath)} className="h-12 w-12 object-contain" alt="" /> : <span className="brand-mark"><Icon name="loads" /></span>}<strong id="nav-title" className="min-w-0 flex-1 break-words">{settings?.businessName || 'StoneDesk'}</strong><button className="icon-button" aria-label={pick('Close navigation', 'మెనూ మూసివేయండి')} onClick={() => drawer.current.close()}><Icon name="close" /></button></div>
      <nav className="space-y-2 py-5">{navigation.map(([key, icon, en, te]) => <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => go(key)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-4 text-left font-semibold ${view === key ? 'bg-teal-50 text-teal-900' : 'hover:bg-gray-100'}`}><Icon name={icon} />{pick(en, te)}</button>)}</nav>
      <div className="mt-auto border-t border-gray-200 pt-5"><button className="flex min-h-14 w-full items-center gap-3 text-left" onClick={() => go('settings')}><span className="brand-mark bg-gray-100 text-gray-900"><Icon name="user" /></span><span className="min-w-0"><strong className="block truncate">{user.name}</strong><span className="text-sm text-gray-600">{pick(user.role, user.role === 'Admin' ? 'అడ్మిన్' : user.role === 'Yard Manager' ? 'యార్డ్ మేనేజర్' : 'డిస్పాచర్')}</span></span></button><button className="text-button mt-3 w-full text-left" onClick={() => { drawer.current.close(); onLogout(); }}>{pick('Log out', 'లాగ్ అవుట్')}</button></div>
    </div></dialog>
    <dialog ref={notifications} className="app-dialog" aria-labelledby="attention-title"><div className="space-y-4 p-6"><h2 id="attention-title" className="text-xl font-bold">{pick('Needs attention', 'చేయవలసినవి')}</h2><p>{attention} {pick('saved drafts to review.', 'సేవ్ చేసిన డ్రాఫ్ట్‌లు తనిఖీ చేయాలి.')}</p><button className="btn w-full min-h-12 bg-teal-800 text-white" onClick={() => { notifications.current.close(); navigate('entries'); }}>{pick('View loading entries', 'లోడ్ వివరాలు చూడండి')}</button><button className="text-button w-full" onClick={() => notifications.current.close()}>{pick('Close', 'మూసివేయండి')}</button></div></dialog>
  </div>;
}
