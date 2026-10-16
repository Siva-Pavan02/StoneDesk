import { useId, useRef, useState } from 'react';

import { money } from '../../utils/pilotDraft.js';
import { formatA4Money } from '../../utils/a4InvoiceModel.js';
import { landingSampleModel } from '../../utils/landingSampleInvoice.js';
import Icon from './Icon.jsx';
import BrandLogo from './BrandLogo.jsx';
import { SampleMotionBadge } from './MarketingMotion.jsx';
import SampleA4Invoice from './SampleA4Invoice.jsx';

// Public demonstration only. No session, API call, saved draft or real customer data.
const sampleRows = Object.freeze([
  Object.freeze({ lengthFt: 3.5, widthFt: 2, quantity: 30, category: 'Regular', sqFt: 210 }),
  Object.freeze({ lengthFt: 3, widthFt: 1.5, quantity: 13, category: 'TOP', sqFt: 58.5 }),
]);
export function SampleLabel() {
  return <span className="mk-sample-label inline-flex items-center gap-1.5 rounded-full border border-[#ceded8] bg-[#f0f7f4] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[#355f55]">SAMPLE DATA</span>;
}

function MeasurementTable() {
  return <div className="mk-table-scroll overflow-x-auto" role="region" tabIndex={0} aria-label="Sample measurements, scroll horizontally if needed">
    <table className="mk-sample-table w-full border-collapse text-sm">
      <caption className="sr-only">{`Sample stone · Polished · ${money(64)} per square foot`}</caption>
      <thead><tr className="bg-[#f2f6f4] text-[#526661]">
        <th scope="col">Type</th>
        <th scope="col">Size (ft)</th>
        <th scope="col" className="mk-numeric">Qty</th>
        <th scope="col" className="mk-numeric">Sq ft</th>
      </tr></thead>
      <tbody>{sampleRows.map((row, index) => <tr key={row.category}>
        <td className="mk-type">{row.category === 'TOP' ? 'TOP' : null}</td>
        <th scope="row" className="whitespace-nowrap font-medium">{index === 0 ? '3½ × 2' : '3 × 1½'}</th>
        <td className="mk-numeric">{row.quantity}</td><td className="mk-numeric">{row.sqFt}</td>
      </tr>)}</tbody>
      <tfoot><tr><th scope="row" colSpan={2}>Total</th><td className="mk-numeric">43</td><td className="mk-numeric">268.5</td></tr></tfoot>
    </table>
  </div>;
}

// Heading is the panel heading level: h2 when the showcase sits directly under the page h1.
function Overview({ onSelect, Heading = 'h3' }) {
  return <div className="space-y-5 p-4 sm:p-5">
    <div><Heading className="text-lg font-semibold tracking-tight">Your yard, at a glance</Heading><p className="mt-1 text-xs text-[#526661]">A sample workspace, not your business records.</p></div>
    <dl className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-[#e0eae7] p-3"><dt className="text-xs text-[#526661]">Drafts to review</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">1</dd></div>
      <div className="rounded-xl border border-[#e0eae7] p-3"><dt className="text-xs text-[#526661]">Lorries in transit</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">1</dd></div>
    </dl>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#edf6f2] px-4 py-3"><span className="text-xs text-[#355f55]">Sample total billed</span><strong className="text-xl font-semibold tracking-tight text-[#17645d] tabular-nums">{formatA4Money(landingSampleModel().totals.netPayable)}</strong></div>
    <div><p className="mb-2 text-xs font-semibold text-[#526661]">Recent sample loads</p>
      <button type="button" onClick={() => onSelect('dispatch')} className="mk-preview-row flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border-b border-[#e0eae7] py-3 text-left">
        <span className="min-w-0"><strong className="block text-sm font-medium">SAMPLE-LORRY</strong><span className="mt-1 block text-xs text-[#526661]">{'268.5\u00A0sq\u00A0ft · 43\u00A0pieces'}</span></span>
        <span className="mk-status">In transit</span><Icon name="arrow" className="h-4 w-4 text-[#526661]" />
      </button>
      <button type="button" onClick={() => onSelect('measure')} className="mk-preview-row flex min-h-16 w-full items-center justify-between gap-3 rounded-lg py-3 text-left">
        <span className="min-w-0"><strong className="block text-sm font-medium">Sample draft</strong><span className="mt-1 block text-xs text-[#526661]">Measurements awaiting review</span></span>
        <span className="mk-status mk-status-neutral">Draft</span><Icon name="arrow" className="h-4 w-4 text-[#526661]" />
      </button>
    </div>
  </div>;
}

function Measurements({ Heading = 'h3' }) {
  return <div className="space-y-5 p-4 sm:p-5">
    <div><Heading className="text-lg font-semibold tracking-tight">Fractions in. Clear totals out.</Heading><p className="mt-1 text-xs leading-relaxed text-[#526661]">Feet, quantities and numbered rows with Top pieces.</p></div>
    <div className="rounded-xl border border-[#d9e8e1] bg-[#edf6f2] p-4"><p className="text-xs text-[#355f55]">Sample calculation</p><p className="mk-calc mt-2 text-xl font-semibold tracking-tight">3½ × 2 × 30 <span className="text-[#526661]">=</span> 210 <span className="text-sm font-medium">sq ft</span></p></div>
    <MeasurementTable />
    <div className="flex flex-wrap items-baseline justify-between gap-3"><span className="text-sm text-[#526661]">Total measured area</span><strong className="mk-measure-total text-3xl font-semibold tracking-tight text-[#17645d] tabular-nums">268.5{'\u00A0'}<small className="text-sm font-medium">{'sq\u00A0ft'}</small></strong></div>
    <p className="text-xs leading-relaxed text-[#526661]">Enter 3½, 3 1/2 or 3.5 in the workspace. Review every row before finalizing.</p>
  </div>;
}

function Dispatch({ Heading = 'h3' }) {
  return <div className="space-y-5 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><Heading className="text-lg font-semibold" translate="no">SAMPLE-LORRY</Heading><p className="mt-1 text-xs text-[#526661]">Sample buyer · Sample destination</p></div><span className="mk-status">In transit</span></div>
    <ol className="mk-dispatch-path space-y-5 py-2">
      {[[true, 'Draft / loaded', 'Measurements prepared'], [true, 'Dispatched', 'Bill finalized; financial values locked'], [false, 'Delivered', 'Awaiting a team member’s confirmation']].map(([done, title, detail]) => <li key={title} className="relative flex items-start gap-3">
        <span className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${done ? 'border-[#17645d] bg-[#17645d] text-white' : 'border-[#cadbd5] bg-white text-[#526661]'}`} aria-hidden="true">{done ? <Icon name="check" className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-[#71857e]" />}</span>
        <div><p className="text-sm font-semibold">{title}<span className="sr-only">{done ? ' (completed)' : ' (pending)'}</span></p><p className="mt-1 text-xs leading-relaxed text-[#526661]">{detail}</p></div>
      </li>)}
    </ol>
    <p className="rounded-xl bg-[#f2f6f4] p-3 text-xs leading-relaxed text-[#526661]">Dispatchers and Admins record dispatch and delivery. Status is team-updated, not GPS tracking.</p>
  </div>;
}

export default function ProductShowcase({ initialTab = 'overview', animateStatus = false, className = '', headingLevel = 'h3', onOpenBill }) {
  const Heading = headingLevel;
  const [active, setActive] = useState(initialTab);
  const id = useId();
  const tabs = useRef([]);
  const screens = [['overview', 'Overview'], ['measure', 'Measure'], ['dispatch', 'Dispatch'], ['bill', 'Bill']];

  function keyboard(event, index) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? screens.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + screens.length) % screens.length;
    setActive(screens[next][0]); tabs.current[next]?.focus();
  }

  return <div className={`mk-double-bezel min-w-0 ${className}`}>
    <div className="mk-product-window overflow-hidden bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0eae7] px-4 py-3 sm:px-5"><span className="flex items-center gap-2 text-sm font-semibold"><BrandLogo size={28} className="h-7 w-7" /><span translate="no">StoneDesk</span></span><SampleLabel /></div>
      <div className="border-b border-[#e0eae7] px-3 py-3 sm:px-4"><div className="mk-showcase-tabs grid grid-cols-4" role="tablist" aria-label="Explore the sample workspace">
        {screens.map(([key, label], index) => <button type="button" key={key} ref={node => { tabs.current[index] = node; }} id={`${id}-tab-${key}`} role="tab" aria-selected={active === key} aria-controls={`${id}-panel`} tabIndex={active === key ? 0 : -1} onClick={() => setActive(key)} onKeyDown={event => keyboard(event, index)} className="min-w-0 px-1 sm:px-2">{label}</button>)}
      </div></div>
      <div id={`${id}-panel`} role="tabpanel" tabIndex={0} aria-labelledby={`${id}-tab-${active}`} className="mk-showcase-panel min-w-0">
        {active === 'overview' && <Overview Heading={Heading} onSelect={key => { setActive(key); tabs.current[screens.findIndex(screen => screen[0] === key)]?.focus(); }} />}
        {active === 'measure' && <Measurements Heading={Heading} />}
        {active === 'dispatch' && <Dispatch Heading={Heading} />}
        {active === 'bill' && <div className="p-3 sm:p-4"><SampleA4Invoice variant="frame" prefix="landing-showcase" onOpenBill={onOpenBill} /></div>}
      </div>
      {animateStatus ? <SampleMotionBadge /> : <p className="border-t border-[#e0eae7] px-4 py-3 text-xs text-[#526661] sm:px-5">Interactive sample · no real business data</p>}
    </div>
  </div>;
}