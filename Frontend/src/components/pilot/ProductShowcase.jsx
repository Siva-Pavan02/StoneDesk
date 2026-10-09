import { useId, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { money } from '../../utils/pilotDraft.js';
import Icon from './Icon.jsx';
import { SampleMotionBadge } from './MarketingMotion.jsx';
import InvoiceDocument from './InvoiceDocument.jsx';

// Public demonstration only. No session, API call, saved draft or real customer data.
const sampleRows = Object.freeze([
  Object.freeze({ lengthFt: 3.5, widthFt: 2, quantity: 30, category: 'Regular', sqFt: 210, lineTotal: 13440 }),
  Object.freeze({ lengthFt: 3, widthFt: 1.5, quantity: 13, category: 'TOP', sqFt: 58.5, lineTotal: 3744 }),
]);
const SAMPLE_DISPATCH = Object.freeze({
  id: 'public-sample', status: 'Dispatched', date: '2026-10-08T06:30:00.000Z', dispatchSlipNumber: 'SAMPLE-001',
  partyName: 'SAMPLE BUYER', supervisor: 'SAMPLE OPERATOR',
  businessSnapshot: Object.freeze({ businessName: 'SAMPLE DATA - StoneDesk demo', address: 'Demonstration only. Not a real bill or customer record.' }),
  logistics: Object.freeze({ truckNumber: 'SAMPLE-LORRY', buyerDestination: 'SAMPLE DESTINATION' }),
  inventory: Object.freeze([Object.freeze({ stoneType: 'Sample stone', finish: 'Polished', ratePerSqFt: 64, totalSqFt: 268.5, lineTotal: 17184, measurementRows: sampleRows })]),
  summary: Object.freeze({ totalPieces: 43, totalDispatchVolumeSqFt: 268.5, baseMaterialTotal: 17184, loadingAndRoyaltyFees: 1200, netBillableAmount: 18384 }),
});

export function SampleLabel() {
  const { pick } = useLanguage();
  return <span className="mk-sample-label inline-flex items-center gap-1.5 rounded-full border border-[#ceded8] bg-[#f0f7f4] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[#355f55]">{pick('SAMPLE DATA', 'నమూనా సమాచారం')}</span>;
}

function MeasurementTable({ invoice = false }) {
  const { pick } = useLanguage();
  return <div className="mk-table-scroll overflow-x-auto" role="region" tabIndex={0} aria-label={pick('Sample measurements, scroll horizontally if needed', 'నమూనా కొలతలు, అవసరమైతే అడ్డంగా స్క్రోల్ చేయండి')}>
    <table className={`mk-sample-table w-full border-collapse text-sm ${invoice ? 'mk-invoice-table' : ''}`}>
      <caption className="sr-only">{pick('Sample stone · Polished · ₹64 per square foot', 'నమూనా రాయి · పాలిష్ · చదరపు అడుగుకు ₹64')}</caption>
      <thead><tr className="bg-[#f2f6f4] text-[#526661]">
        <th scope="col">{pick('Size (ft)', 'సైజు (అడుగులు)')}</th>
        <th scope="col">{pick('Type', 'రకం')}</th>
        <th scope="col" className="mk-numeric">{pick('Qty', 'ముక్కలు')}</th>
        <th scope="col" className="mk-numeric">{pick('Sq ft', 'చ.అ.')}</th>
        {invoice && <th scope="col" className="mk-numeric">{pick('Amount', 'మొత్తం')}</th>}
      </tr></thead>
      <tbody>{sampleRows.map((row, index) => <tr key={row.category}>
        <th scope="row" className="whitespace-nowrap font-medium">{index === 0 ? '3½ × 2' : '3 × 1½'}</th>
        <td>{row.category === 'TOP' ? pick('TOP', 'టాప్') : pick('Regular', 'సాధారణ')}</td>
        <td className="mk-numeric">{row.quantity}</td><td className="mk-numeric">{row.sqFt}</td>
        {invoice && <td className="mk-numeric">{money(row.lineTotal)}</td>}
      </tr>)}</tbody>
      <tfoot><tr><th scope="row" colSpan={2}>{pick('Total', 'మొత్తం')}</th><td className="mk-numeric">43</td><td className="mk-numeric">268.5</td>{invoice && <td className="mk-numeric">{money(17184)}</td>}</tr></tfoot>
    </table>
  </div>;
}

export function SampleInvoice({ compact = false }) {
  return <InvoiceDocument record={SAMPLE_DISPATCH} compact={compact} sample>
    <MeasurementTable invoice />
  </InvoiceDocument>;
}

export function SampleDownload({ className = '' }) {
  const { pick } = useLanguage();
  const [status, setStatus] = useState('idle');
  const downloading = useRef(false);
  const statusId = useId();

  async function download() {
    if (downloading.current) return;
    downloading.current = true; setStatus('loading');
    let url;
    let link;
    try {
      const { buyerPdf } = await import('../../utils/pilotExports.js');
      const file = buyerPdf(SAMPLE_DISPATCH);
      url = URL.createObjectURL(file.blob);
      link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.appendChild(link); link.click();
      setStatus('success');
    } catch { setStatus('error'); }
    finally {
      link?.remove();
      // Keep the object URL alive long enough for the browser's download handoff.
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      downloading.current = false;
    }
  }

  return <div className={className}>
    <button type="button" disabled={status === 'loading'} aria-describedby={statusId} onClick={download} className="mk-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#cadbd5] bg-white px-5 text-sm font-semibold text-[#17645d]">
      <Icon name="bill" className="h-4 w-4" />{status === 'loading' ? pick('Preparing PDF…', 'PDF సిద్ధం అవుతోంది…') : pick('Download sample PDF', 'నమూనా PDF డౌన్‌లోడ్')}
    </button>
    <p id={statusId} role={status === 'error' ? 'alert' : 'status'} className={`mt-2 text-xs leading-relaxed ${status === 'error' ? 'text-[#9b3030]' : 'text-[#526661]'}`}>
      {status === 'error' ? pick('The PDF could not be created. Please try again.', 'PDF సృష్టించలేకపోయాము. మళ్ళీ ప్రయత్నించండి.') : status === 'success' ? pick('Sample PDF created. Check your browser downloads.', 'నమూనా PDF సిద్ధమైంది. బ్రౌజర్ డౌన్‌లోడ్‌లను చూడండి.') : pick('English PDF · generated locally · no account needed', 'ఇంగ్లీష్ PDF · ఈ పరికరంలో సృష్టించబడుతుంది · ఖాతా అవసరం లేదు')}
    </p>
  </div>;
}

function Overview({ onSelect }) {
  const { pick } = useLanguage();
  return <div className="space-y-5 p-4 sm:p-5">
    <div><h3 className="text-lg font-semibold tracking-tight">{pick('Your yard, at a glance', 'మీ యార్డ్ వివరాలు')}</h3><p className="mt-1 text-xs text-[#526661]">{pick('A sample workspace, not your business records.', 'ఇది నమూనా వర్క్‌స్పేస్, మీ వ్యాపార రికార్డులు కావు.')}</p></div>
    <dl className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-[#e0eae7] p-3"><dt className="text-xs text-[#526661]">{pick('Drafts to review', 'తనిఖీ చేయవలసినవి')}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">1</dd></div>
      <div className="rounded-xl border border-[#e0eae7] p-3"><dt className="text-xs text-[#526661]">{pick('Lorries in transit', 'ప్రయాణంలో లారీలు')}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">1</dd></div>
    </dl>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#edf6f2] px-4 py-3"><span className="text-xs text-[#355f55]">{pick('Sample total billed', 'నమూనా బిల్లుల మొత్తం')}</span><strong className="text-xl font-semibold tracking-tight text-[#17645d] tabular-nums">{money(18384)}</strong></div>
    <div><p className="mb-2 text-xs font-semibold text-[#526661]">{pick('Recent sample loads', 'ఇటీవలి నమూనా లోడ్లు')}</p>
      <button type="button" onClick={() => onSelect('dispatch')} className="mk-preview-row flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border-b border-[#e0eae7] py-3 text-left">
        <span className="min-w-0"><strong className="block text-sm font-medium">SAMPLE-LORRY</strong><span className="mt-1 block text-xs text-[#526661]">{pick('268.5 sq ft · 43 pieces', '268.5 చ.అ. · 43 ముక్కలు')}</span></span>
        <span className="mk-status">{pick('In transit', 'ప్రయాణంలో')}</span><Icon name="arrow" className="h-4 w-4 text-[#526661]" />
      </button>
      <button type="button" onClick={() => onSelect('measure')} className="mk-preview-row flex min-h-16 w-full items-center justify-between gap-3 rounded-lg py-3 text-left">
        <span className="min-w-0"><strong className="block text-sm font-medium">{pick('Sample draft', 'నమూనా డ్రాఫ్ట్')}</strong><span className="mt-1 block text-xs text-[#526661]">{pick('Measurements awaiting review', 'తనిఖీ చేయవలసిన కొలతలు')}</span></span>
        <span className="mk-status mk-status-neutral">{pick('Draft', 'డ్రాఫ్ట్')}</span><Icon name="arrow" className="h-4 w-4 text-[#526661]" />
      </button>
    </div>
  </div>;
}

function Measurements() {
  const { pick } = useLanguage();
  return <div className="space-y-5 p-4 sm:p-5">
    <div><h3 className="text-lg font-semibold tracking-tight">{pick('Fractions in. Clear totals out.', 'భిన్నాలతో కొలతలు. స్పష్టమైన మొత్తాలు.')}</h3><p className="mt-1 text-xs leading-relaxed text-[#526661]">{pick('Feet, quantities and numbered rows with Top pieces.', 'అడుగులు, ముక్కలు, టాప్ ముక్కలతో వరుస సంఖ్యలు.')}</p></div>
    <div className="rounded-xl border border-[#d9e8e1] bg-[#edf6f2] p-4"><p className="text-xs text-[#355f55]">{pick('Sample calculation', 'నమూనా లెక్క')}</p><p className="mt-2 text-xl font-semibold tracking-tight">3½ × 2 × 30 <span className="text-[#526661]">=</span> 210 <span className="text-sm font-medium">{pick('sq ft', 'చ.అ.')}</span></p></div>
    <MeasurementTable />
    <div className="flex flex-wrap items-baseline justify-between gap-3"><span className="text-sm text-[#526661]">{pick('Total measured area', 'మొత్తం కొలిచిన విస్తీర్ణం')}</span><strong className="text-3xl font-semibold tracking-tight text-[#17645d] tabular-nums">268.5 <small className="text-sm font-medium">{pick('sq ft', 'చ.అ.')}</small></strong></div>
    <p className="text-xs leading-relaxed text-[#526661]">{pick('Enter 3½, 3 1/2 or 3.5 in the workspace. Review every row before finalizing.', 'వర్క్‌స్పేస్‌లో 3½, 3 1/2 లేదా 3.5 నమోదు చేయండి. ఖరారు చేసే ముందు ప్రతి వరుస తనిఖీ చేయండి.')}</p>
  </div>;
}

function Dispatch() {
  const { pick } = useLanguage();
  return <div className="space-y-5 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">SAMPLE-LORRY</h3><p className="mt-1 text-xs text-[#526661]">{pick('Sample buyer · Sample destination', 'నమూనా కొనుగోలుదారు · నమూనా గమ్యస్థానం')}</p></div><span className="mk-status">{pick('In transit', 'ప్రయాణంలో')}</span></div>
    <ol className="mk-dispatch-path space-y-5 py-2">
      {[[true, 'Draft / loaded', 'డ్రాఫ్ట్ / లోడ్', 'Measurements prepared', 'కొలతలు సిద్ధమయ్యాయి'], [true, 'Dispatched', 'పంపబడింది', 'Bill finalized; financial values locked', 'బిల్లు ఖరారైంది; మొత్తాలు లాక్ అయ్యాయి'], [false, 'Delivered', 'డెలివరీ అయింది', 'Awaiting a team member’s confirmation', 'బృంద సభ్యుని నిర్ధారణ కోసం వేచి ఉంది']].map(([done, en, te, detailEn, detailTe]) => <li key={en} className="relative flex items-start gap-3">
        <span className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${done ? 'border-[#17645d] bg-[#17645d] text-white' : 'border-[#cadbd5] bg-white text-[#526661]'}`} aria-hidden="true">{done ? <Icon name="check" className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-[#71857e]" />}</span>
        <div><p className="text-sm font-semibold">{pick(en, te)}</p><p className="mt-1 text-xs leading-relaxed text-[#526661]">{pick(detailEn, detailTe)}</p></div>
      </li>)}
    </ol>
    <p className="rounded-xl bg-[#f2f6f4] p-3 text-xs leading-relaxed text-[#526661]">{pick('Dispatchers and Admins record dispatch and delivery. Status is team-updated, not GPS tracking.', 'డిస్పాచర్లు, అడ్మిన్లు డిస్పాచ్ మరియు డెలివరీ నమోదు చేస్తారు. స్థితిని బృందం నవీకరిస్తుంది; GPS ట్రాకింగ్ కాదు.')}</p>
  </div>;
}

export default function ProductShowcase({ initialTab = 'overview', animateStatus = false, className = '' }) {
  const { pick } = useLanguage();
  const [active, setActive] = useState(initialTab);
  const id = useId();
  const tabs = useRef([]);
  const screens = [['overview', 'Overview', 'సారాంశం'], ['measure', 'Measure', 'కొలతలు'], ['dispatch', 'Dispatch', 'డిస్పాచ్'], ['bill', 'Bill', 'బిల్లు']];

  function keyboard(event, index) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? screens.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + screens.length) % screens.length;
    setActive(screens[next][0]); tabs.current[next]?.focus();
  }

  return <div className={`mk-double-bezel min-w-0 rounded-[28px] border border-[#cfdfd8] p-2 sm:p-2.5 ${className}`}>
    <div className="mk-product-window overflow-hidden rounded-[20px] border border-[#d9e4df] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0eae7] px-4 py-3 sm:px-5"><span className="flex items-center gap-2 text-sm font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#17645d] text-white" aria-hidden="true"><Icon name="loads" className="h-4 w-4" /></span>StoneDesk</span><SampleLabel /></div>
      <div className="mk-showcase-tabs grid grid-cols-4 gap-1 border-b border-[#e0eae7] bg-[#fafcfb] p-2" role="tablist" aria-label={pick('Explore the sample workspace', 'నమూనా వర్క్‌స్పేస్ చూడండి')}>
        {screens.map(([key, en, te], index) => <button type="button" key={key} ref={node => { tabs.current[index] = node; }} id={`${id}-tab-${key}`} role="tab" aria-selected={active === key} aria-controls={`${id}-panel`} tabIndex={active === key ? 0 : -1} onClick={() => setActive(key)} onKeyDown={event => keyboard(event, index)} className="min-h-11 min-w-0 rounded-lg px-1 text-xs font-medium sm:px-2">{pick(en, te)}</button>)}
      </div>
      <div id={`${id}-panel`} role="tabpanel" tabIndex={0} aria-labelledby={`${id}-tab-${active}`} className="mk-showcase-panel min-w-0">
        {active === 'overview' && <Overview onSelect={key => { setActive(key); tabs.current[screens.findIndex(screen => screen[0] === key)]?.focus(); }} />}
        {active === 'measure' && <Measurements />}
        {active === 'dispatch' && <Dispatch />}
        {active === 'bill' && <div className="p-3 sm:p-4"><SampleInvoice compact /></div>}
      </div>
      {animateStatus ? <SampleMotionBadge /> : <p className="border-t border-[#e0eae7] px-4 py-3 text-xs text-[#526661] sm:px-5">{pick('Interactive sample · no real business data', 'ఇంటరాక్టివ్ నమూనా · నిజమైన వ్యాపార సమాచారం లేదు')}</p>}
    </div>
  </div>;
}