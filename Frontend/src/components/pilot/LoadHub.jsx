import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { money } from '../../utils/pilotDraft.js';
import { Button, Card } from './Controls.jsx';
import Icon from './Icon.jsx';

export default function LoadHub({ loads, view, query, onOpen, onNew, onRefresh, onLoadMore, hasMore, loading, recovery, onContinue, onNavigate, updatedAt }) {
  const { pick } = useLanguage();
  const [filter, setFilter] = useState('all');
  const drafts = loads.filter(l => l.status === 'Draft');
  const transit = loads.filter(l => l.status === 'Dispatched');
  const invoices = loads.filter(l => l.status !== 'Draft');
  const search = query.trim().toLowerCase();
  const filtered = loads.filter(l => (view !== 'invoices' || l.status !== 'Draft') &&
    (filter === 'all' || l.status === filter) &&
    [l.partyName, l.logistics?.truckNumber, l.dispatchSlipNumber, l.logistics?.buyerDestination].some(s => s?.toLowerCase().includes(search)));
  const titles = { home: ['Your yard, at a glance', 'మీ యార్డ్ వివరాలు'], entries: ['Loading entries', 'లోడ్ వివరాలు'], monitor: ['Monitor & dispatch', 'లోడ్ మానిటర్'], invoices: ['Invoices', 'బిల్లులు'] };
  const heading = titles[view] || titles.home;
  return <>
    <div><p className="eyebrow mb-2">{pick('OPERATIONS', 'కార్యకలాపాలు')}</p><h1 className="text-2xl font-bold tracking-tight">{pick(...heading)}</h1><p className="mt-2 text-sm text-gray-700">{view === 'invoices' ? pick('Final bills. Original values. Ready to share.', 'ఖరారు చేసిన బిల్లులు. అసలు మొత్తాలు. షేర్ చేయడానికి సిద్ధం.') : pick('From the first measurement to the final bill.', 'మొదటి కొలత నుండి చివరి బిల్లు వరకు.')}</p></div>
    {view === 'home' && <>
      <Button primary className="w-full min-h-16 justify-between px-5" en="New Load" te="కొత్త లోడ్" onClick={onNew}><Icon name="plus" /></Button>
      {recovery && <Card className="gap-3 border-l-4 border-l-teal-700"><h2 className="font-bold">{pick('Pick up where you left off', 'మీ లోడ్ కొనసాగించండి')}</h2><p className="text-sm text-gray-700 break-words">{recovery.partyName || recovery.truckNumber || pick('An unfinished load is saved on this phone.', 'ఈ ఫోన్‌లో పూర్తి కాని లోడ్ సేవ్ అయింది.')}</p><Button en="Continue unsaved load" te="లోడ్ కొనసాగించండి" onClick={onContinue} /></Card>}
      <div className="dashboard-metrics"><Card className="gap-2"><span className="text-sm font-semibold text-gray-700">{pick('Drafts to review', 'తనిఖీ చేయవలసినవి')}</span><strong className="text-3xl tabular-nums">{drafts.length}</strong></Card><Card className="gap-2"><span className="text-sm font-semibold text-gray-700">{pick('Lorries in transit', 'ప్రయాణంలో లారీలు')}</span><strong className="text-3xl tabular-nums">{transit.length}</strong></Card>
      <Card className="gap-3 metric-billed"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-gray-700">{pick('Total billed · all time', 'మొత్తం బిల్లులు')}</p><strong className="text-2xl tabular-nums break-all">{money(invoices.reduce((sum, l) => sum + l.summary.netBillableAmount, 0))}</strong></div><Icon name="bill" /></div><button className="text-button flex items-center justify-between font-semibold text-teal-900" onClick={() => onNavigate('invoices')}>{pick('View invoices', 'బిల్లులు చూడండి')}<Icon name="arrow" /></button></Card></div>
    </>}
    <div className="flex items-center justify-between gap-3"><h2 className="font-bold">{view === 'home' ? pick('Recent loads', 'ఇటీవలి లోడ్లు') : `${filtered.length} ${pick('records', 'రికార్డులు')}`}</h2><button disabled={loading} className="text-button flex items-center gap-2 text-sm" onClick={onRefresh}><Icon name="refresh" />{loading ? pick('Refreshing…', 'లోడ్ అవుతోంది…') : pick('Refresh', 'రిఫ్రెష్')}</button></div>
    {view !== 'home' && view !== 'invoices' && <div className="load-filters" aria-label={pick('Filter loads', 'లోడ్ ఫిల్టర్')}>{[['all', 'All loads', 'అన్ని లోడ్లు'], ['Draft', 'Draft / loaded', 'డ్రాఫ్ట్ / లోడ్'], ['Dispatched', 'In transit', 'ప్రయాణంలో'], ['Delivered', 'Completed', 'పూర్తయినవి']].map(([value, en, te]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-12 rounded-xl border-2 px-3 text-sm font-semibold ${filter === value ? 'bg-teal-800 border-teal-800 text-white' : 'bg-white border-gray-300'}`}>{pick(en, te)}</button>)}</div>}
    {view === 'monitor' && <p className="text-sm text-gray-700">{pick('Drafts with measurements are shown as Loaded. Finalize a bill to dispatch the load.', 'కొలతలు ఉన్న డ్రాఫ్ట్‌లు లోడ్ అయినవిగా కనిపిస్తాయి. డిస్పాచ్ కోసం బిల్లును ఖరారు చేయండి.')}</p>}
    {!filtered.length && <Card className="items-start gap-4 py-7"><Icon name={view === 'invoices' ? 'bill' : 'truck'} className="h-8 w-8 text-teal-800" /><h3 className="text-lg font-bold">{search ? pick('No matching loads', 'లోడ్లు కనబడలేదు') : view === 'invoices' ? pick('Your first bill starts with a load', 'మొదటి బిల్లు లోడ్‌తో ప్రారంభమవుతుంది') : pick('A fresh page for your yard', 'మీ యార్డ్ కోసం కొత్త పేజీ')}</h3><p className="text-gray-700">{search ? pick('Try a lorry number, party name or another bill ID.', 'లారీ నంబర్, పార్టీ పేరు లేదా బిల్లు ఐడీతో వెతకండి.') : pick('Add your measurements, review the totals and finalize when ready.', 'కొలతలు జోడించి, మొత్తాలు తనిఖీ చేసి బిల్లును ఖరారు చేయండి.')}</p>{!search && <Button en="Create a load" te="లోడ్ సృష్టించండి" onClick={onNew} />}</Card>}
    {(view === 'home' ? filtered.slice(0, 5) : filtered).map(item => {
      const itemId = item.id;
      const state = item.status === 'Draft' ? 'Draft' : item.status === 'Delivered' ? 'Completed' : 'Dispatched';
      return <Card key={itemId} className="load-record gap-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-lg font-bold">{item.logistics.truckNumber}</h3><p className="mt-1 break-words text-sm text-gray-700">{item.partyName || item.logistics.buyerDestination}</p></div><span className={`status-tag ${item.status === 'Draft' ? 'bg-gray-100' : 'bg-teal-50 text-teal-900'}`}>{pick(view === 'invoices' ? 'Billed' : state, view === 'invoices' ? 'బిల్లు సిద్ధం' : item.status === 'Draft' ? 'డ్రాఫ్ట్' : item.status === 'Delivered' ? 'పూర్తయింది' : 'పంపబడింది')}</span></div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-gray-200 pt-3 text-sm"><span>{new Date(item.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} · {item.summary.totalDispatchVolumeSqFt} {pick('sq ft', 'చ.అ.')}</span><strong className="tabular-nums">{money(item.summary.netBillableAmount)}</strong></div>
        <Button className="w-full justify-between" en={item.status === 'Draft' ? 'Review draft' : view === 'monitor' ? 'Open dispatch' : 'View invoice'} te={item.status === 'Draft' ? 'డ్రాఫ్ట్ చూడండి' : 'బిల్లు చూడండి'} onClick={() => onOpen(itemId)}><Icon name="arrow" /></Button>
      </Card>;
    })}
    {view !== 'home' && hasMore && <Button className="w-full" en="Load more" te="మరిన్ని చూడండి" onClick={onLoadMore} disabled={loading} />}
    {view === 'home' && loads.length > 5 && <Button className="w-full" en="View all loads" te="అన్ని లోడ్లు చూడండి" onClick={() => onNavigate('entries')} />}
    {updatedAt && <p className="text-xs text-gray-600">{pick('Updated', 'నవీకరించబడింది')} {new Date(updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}{view === 'monitor' ? pick(' · refreshes every 30 seconds', ' · ప్రతి 30 సెకన్లకు నవీకరణ') : ''}</p>}
  </>;
}
