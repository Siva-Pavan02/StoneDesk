import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import BrandLogo from './BrandLogo.jsx';
import ProductShowcase from './ProductShowcase.jsx';
import SampleA4Invoice from './SampleA4Invoice.jsx';
import { MagneticCTA, Reveal } from './MarketingMotion.jsx';
import { formatA4Money, formatA4Number } from '../../utils/a4InvoiceModel.js';
import { landingSampleModel } from '../../utils/landingSampleInvoice.js';

// Closes a native <dialog> only when its backdrop (the dialog element itself) is clicked.
function closeOnBackdrop(event) {
  if (event.target === event.currentTarget) event.currentTarget.close();
}

function Eyebrow({ children }) {
  return <p className="mk-eyebrow">{children}</p>;
}

function ScrubText({ text, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const words = [...node.querySelectorAll('span')];
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = node.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.85 - box.top) / (window.innerHeight * 0.5)));
      const lit = progress * words.length;
      words.forEach((word, index) => { word.style.opacity = String(Math.min(1, Math.max(0.3, lit - index + 0.3))); });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, [text]);
  return <p ref={ref} className={className}>{text.split(' ').map((word, index) => <span key={`${word}-${index}`} className="mk-scrub-word">{word} </span>)}</p>;
}

export default function LandingPage({ onStart, onLogin, user, onWorkspace }) {
  const info = useRef(null);
  const bill = useRef(null);
  const [topic, setTopic] = useState('privacy');
  const sample = landingSampleModel();
  // The browser chrome matches this page's background while it is shown.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return undefined;
    const previous = meta.getAttribute('content');
    meta.setAttribute('content', '#fafaf9');
    return () => meta.setAttribute('content', previous);
  }, []);
  const start = user ? onWorkspace : onStart;
  const startLabel = user ? 'Open workspace' : 'Sign up';
  const topics = {
    privacy: {
      title: 'Your data, explained',
      paragraphs: [
        'Accounts, business details, measurements and dispatch records are stored on the server running this StoneDesk installation. Your business administrator manages team access.',
        'Up to five unfinished loads are saved automatically and encrypted on this device for recovery. On a shared device, use your own account and sign out when finished.',
        'The public previews use sample data only and do not access or create a business record. Ask your administrator about this installation’s retention and deletion policies.',
      ],
    },
    terms: {
      title: 'Pilot terms & limitations',
      paragraphs: [
        'StoneDesk records material measurements and load bills in feet, square feet and INR. Review all dimensions, quantities, rates and loading / royalty charges before finalizing.',
        'Finalized bills preserve their original financial values and business snapshot. Dispatch and delivery status can still be updated by authorized team members.',
        'This pilot does not calculate GST or provide GPS tracking. A material load bill is not presented as a GST tax invoice. Payments received can be recorded against a finalized bill. Sample records are demonstrations, not transactions.',
      ],
    },
    support: {
      title: 'Support & account access',
      paragraphs: [
        'For account approval, a business organization ID or questions about a load, contact your yard’s administrator. They manage access in Settings → Team & access.',
        'Admin: business settings, rates and team access. Manager: prepare loads, enter measurements and add products. Dispatcher: prepare loads, finalize bills and confirm deliveries. Admins can also finalize and confirm deliveries.',
        'No public support email, phone number or response-time promise has been configured for this installation.',
      ],
    },
  };

  function openInfo(key) { setTopic(key); info.current?.showModal(); }
  // Keep #welcome intact: the parent app uses hashes for workspace navigation.
  function anchor(event, id) {
    event.preventDefault();
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    target?.focus({ preventScroll: true });
  }

  return <div className="marketing min-h-dvh bg-[#fafaf9] text-[#1c1917] selection:bg-[#fcd5cb]">
    <a className="mk-skip-link" href="#marketing-main" onClick={event => anchor(event, 'marketing-main')}>Skip to content</a>
    <header className="mk-public-header sticky top-3 z-20 mx-auto w-[calc(100%-24px)] max-w-[1160px] sm:top-4 sm:w-[calc(100%-48px)]">
      <nav aria-label="Public navigation" className="mk-nav flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[28px] border border-white px-3 py-2 sm:gap-x-5 sm:rounded-full sm:px-5">
        <a href="#marketing-main" onClick={event => anchor(event, 'marketing-main')} className="flex min-h-11 shrink-0 items-center gap-2.5" aria-label="StoneDesk home"><BrandLogo size={32} className="mk-brand h-8 w-8" /><span className="text-lg font-semibold tracking-[-0.045em]" translate="no">StoneDesk</span></a>
        <div className="mk-nav-links flex items-center gap-1 sm:gap-3">
          <a href="#product" onClick={event => anchor(event, 'product')} className="mk-nav-link flex min-h-11 items-center rounded-full px-3 text-sm">Product</a>
          <a href="#how-it-works" onClick={event => anchor(event, 'how-it-works')} className="mk-nav-link flex min-h-11 items-center rounded-full px-3 text-sm">How it works</a>
        </div>
        <div className="mk-nav-actions ml-auto flex items-center gap-1 sm:gap-3">
          {!user && <button type="button" onClick={onLogin} className="mk-login min-h-11 rounded-full px-3 text-sm font-medium">Log in</button>}
          <div className="mk-nav-cta"><MagneticCTA compact compactLabel={user ? 'Workspace' : undefined} onClick={start}>{startLabel}</MagneticCTA></div>
        </div>
      </nav>
    </header>

    <main id="marketing-main" tabIndex={-1} className="mx-auto max-w-[1240px] px-5 outline-none sm:px-8 lg:px-10">
      <section className="mk-hero grid min-w-0 grid-cols-1 items-center gap-10 pb-8 pt-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12 lg:pb-16 lg:pt-24" aria-labelledby="marketing-hero-title">
        <div className="min-w-0">
          <Eyebrow>Stone yard workspace</Eyebrow>
          <h1 id="marketing-hero-title" className="mk-hero-title font-semibold tracking-[-0.055em]">Every load.<br /><span className="text-[#FB471F]">Accounted for.</span></h1>
          <p className="mt-6 max-w-[36ch] text-base leading-relaxed text-[#57534e] sm:text-lg">From first measurement to final bill. A clear workspace for your stone business and the people running it.</p>
          <div className="mt-8"><MagneticCTA onClick={start}>{startLabel}</MagneticCTA></div>
        </div>
        <Reveal className="mk-hero-product relative min-w-0" delay={0.08}><ProductShowcase animateStatus headingLevel="h2" onOpenBill={() => bill.current?.showModal()} /></Reveal>
      </section>

      <ul className="mk-essentials" aria-label="Workspace essentials">
        {[[ 'loads', 'Feet, fractions & sq ft' ], [ 'user', 'Role-based access' ], [ 'bill', 'Invoice & driver slip PDFs' ]].map(([icon, label]) => <li key={icon}><span className="mk-essential-icon" aria-hidden="true"><Icon name={icon} className="h-4 w-4" /></span><span>{label}</span></li>)}
      </ul>

      <section id="product" tabIndex={-1} className="mk-section scroll-mt-32 outline-none" aria-labelledby="marketing-product-title">
        <Reveal><Eyebrow>Product</Eyebrow><h2 id="marketing-product-title" className="mk-section-title max-w-[18ch] font-semibold tracking-[-0.045em]">Made for the work. Not the paperwork.</h2></Reveal>
        <ScrubText className="mk-scrub mt-6 max-w-[34ch] font-medium tracking-[-0.03em]" text="Measurements, dispatch status and saved bills live together, so every load leaves the yard with numbers you can trust." />
        <div className="mk-bento mt-10 grid grid-flow-dense grid-cols-1 gap-4 lg:mt-14 lg:grid-cols-2 lg:grid-rows-2">
          <Reveal className="mk-bento-card mk-bento-lead group lg:row-span-2"><span className="mk-bento-icon" aria-hidden="true"><Icon name="loads" /></span><h3 className="mt-6 text-2xl font-semibold tracking-tight">Measurements that add up.</h3><p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-[#57534e]">Enter fractional feet, quantities and row numbers, with Top pieces kept in the same row. See area and material totals before you finalize.</p>
            <div className="mk-bento-sheet mt-8" aria-hidden="true">{[['6 1/2', '2', '13.0'], ['5 3/4', '3', '17.3'], ['7', '1', '7.0']].map(([length, qty, area]) => <div key={length} className="mk-bento-sheet-row"><span>{length} × 2</span><span>{qty}</span><span>{area}</span></div>)}<div className="mk-bento-sheet-row mk-bento-sheet-total"><span>Subtotal</span><span>6</span><span>37.3</span></div></div>
          </Reveal>
          <Reveal className="mk-bento-card group" delay={0.06}><span className="mk-bento-icon" aria-hidden="true"><Icon name="truck" /></span><h3 className="mt-5 text-xl font-semibold tracking-tight">Know where each load stands.</h3><p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-[#57534e]">Draft, dispatched or delivered. Your team records each step, with lorry and destination details close at hand.</p><p className="mt-3 text-xs text-[#57534e]">Team-updated status, not live GPS tracking.</p></Reveal>
          <Reveal className="mk-bento-card group" delay={0.12}><span className="mk-bento-icon" aria-hidden="true"><Icon name="lock" /></span><h3 className="mt-5 text-xl font-semibold tracking-tight">A final bill stays final.</h3><p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-[#57534e]">Finalized financial values stay locked. Original branding, rates and totals remain with the bill, even when business settings change.</p></Reveal>
        </div>
      </section>

      <section id="how-it-works" tabIndex={-1} className="mk-section scroll-mt-32 border-t border-[#e7e5e4] outline-none" aria-labelledby="marketing-workflow-title">
        <Reveal><Eyebrow>How it works</Eyebrow><h2 id="marketing-workflow-title" className="mk-section-title font-semibold tracking-[-0.045em]">One load. A clear next step.</h2></Reveal>
        <ol className="mk-steps mt-10 grid grid-cols-1 gap-0 md:grid-cols-3 md:gap-8">
          {[[ '01', 'Measure & prepare', 'Choose a product, add dimensions and quantities, then save a draft for review.' ], [ '02', 'Review & dispatch', 'An Admin or Dispatcher reviews rates and charges, finalizes the bill and records dispatch.' ], [ '03', 'Export & confirm', 'Download the buyer invoice PDF or the driver slip (no prices), or print it. An authorized team member confirms delivery.' ]].map(([number, title, detail]) => <li key={number} className="mk-workflow-step"><Reveal delay={Number(number) * 0.05}><span className="mk-step-dot" aria-hidden="true" /><h3 className="text-xl font-semibold tracking-tight">{title}</h3><p className="mt-3 max-w-[35ch] text-sm leading-relaxed text-[#57534e]">{detail}</p></Reveal></li>)}
        </ol>
      </section>

      <section className="mk-section border-t border-[#e7e5e4]" aria-labelledby="marketing-bill-title">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <Reveal><Eyebrow>Buyer invoice</Eyebrow><h2 id="marketing-bill-title" className="mk-section-title max-w-[14ch] font-semibold tracking-[-0.045em]">A bill you can actually open.</h2><p className="mt-5 max-w-[39ch] text-base leading-relaxed text-[#57534e]">Grouped measurements. Clear charges. A saved total. Download the buyer invoice PDF or the driver slip PDF from the workspace, or use Print / PDF.</p>
            <div className="mt-7 flex flex-col items-start gap-4"><button type="button" onClick={() => bill.current?.showModal()} className="mk-text-link inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#FB471F]">Open sample bill<span className="mk-link-disc" aria-hidden="true"><Icon name="arrow" className="h-3.5 w-3.5" /></span></button></div>
            <p className="mt-6 max-w-[43ch] text-xs leading-relaxed text-[#57534e]">Material bills in INR. GST is not calculated. All figures shown are sample data.</p>
          </Reveal>
          <Reveal className="mk-bill-bezel min-w-0" delay={0.06}>
            <div className="mk-bill-card" aria-label="Sample bill summary" role="group">
              <div className="mk-bill-card-head"><div><p className="mk-bill-card-kind">Buyer invoice</p><p className="mk-bill-card-no" translate="no">{sample.invoiceNumber}</p></div><span className="mk-bill-card-tag">SAMPLE DATA</span></div>
              <dl className="mk-bill-card-lines">
                {[[ `Material amount · ${formatA4Number(sample.totals.regularArea)}\u00A0sq\u00A0ft`, sample.totals.regularAmount ], [ `Top material amount · ${formatA4Number(sample.totals.topArea)}\u00A0sq\u00A0ft`, sample.totals.topAmount ], [ 'Loading / royalty', sample.loadingRoyalty ]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatA4Money(value)}</dd></div>)}
              </dl>
              <div className="mk-bill-card-total"><span>Net payable</span><strong>{formatA4Money(sample.totals.netPayable)}</strong></div>
              <ul className="mk-bill-card-files" aria-label="Download formats">{['Invoice PDF', 'Driver slip PDF', 'Print / PDF'].map(label => <li key={label}><span><Icon name="bill" className="h-3.5 w-3.5" />{label}</span></li>)}</ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mk-section border-t border-[#e7e5e4]" aria-labelledby="marketing-team-title">
        <Reveal className="mk-team-surface grid grid-cols-1 gap-8 rounded-[28px] border border-[#fcd5cb] bg-[#fef0ec] p-6 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div><Eyebrow>Team access</Eyebrow><h2 id="marketing-team-title" className="mk-section-title font-semibold tracking-[-0.045em]">Your team. The right access.</h2><p className="mt-4 text-sm leading-relaxed text-[#57534e]">A dedicated business workspace. Your administrator approves team access.</p></div>
          <dl className="divide-y divide-[#fcd5cb]">
            {[[ 'Admin', 'Business settings, rates, team access, dispatch and delivery.' ], [ 'Manager', 'Prepare loads, enter measurements and add products.' ], [ 'Dispatcher', 'Prepare loads, finalize bills and confirm deliveries.' ]].map(([role, detail]) => <div key={role} className="grid grid-cols-1 gap-2 py-5 first:pt-0 last:pb-0 sm:grid-cols-[140px_1fr] sm:gap-4"><dt className="text-sm font-semibold">{role}</dt><dd className="text-sm leading-relaxed text-[#57534e]">{detail}</dd></div>)}
          </dl>
        </Reveal>
      </section>

      <section className="mk-cta-band" aria-labelledby="marketing-cta-title">
        <Reveal className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between"><h2 id="marketing-cta-title" className="mk-cta-title max-w-[20ch] font-semibold tracking-[-0.05em]">Start your next load in StoneDesk.</h2><MagneticCTA onClick={start}>{startLabel}</MagneticCTA></Reveal>
      </section>
    </main>

    <footer className="border-t border-[#e7e5e4]"><div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-5 px-5 py-8 sm:px-8 md:flex-row md:items-center lg:px-10"><div><p className="text-lg font-semibold tracking-[-0.045em]" translate="no">StoneDesk</p><p className="mt-2 text-xs text-[#57534e]">{'Small-business pilot · Feet, square feet & INR'}</p></div><div className="flex flex-wrap gap-2 sm:gap-5">{[['privacy', 'Privacy'], ['terms', 'Terms'], ['support', 'Support']].map(([key, label]) => <button type="button" key={key} onClick={() => openInfo(key)} className="mk-nav-link min-h-11 rounded-full px-3 text-sm text-[#57534e]">{label}</button>)}</div></div></footer>

    <dialog ref={info} className="mk-dialog" onClick={closeOnBackdrop} aria-labelledby="marketing-info-title" aria-describedby="marketing-info-body">
      <div className="p-6 sm:p-8"><h2 id="marketing-info-title" className="text-2xl font-semibold tracking-tight">{topics[topic].title}</h2><div id="marketing-info-body" className="mt-5 space-y-4 text-sm leading-relaxed text-[#57534e]">{topics[topic].paragraphs.map((paragraph, index) => <p key={`${topic}-${index}`}>{paragraph}</p>)}</div><div className="mt-6 flex justify-end"><button type="button" autoFocus onClick={() => info.current?.close()} className="mk-secondary min-h-11 rounded-full border border-[#fcd5cb] px-5 text-sm font-semibold text-[#FB471F]">Close</button></div></div>
    </dialog>
    <dialog ref={bill} className="mk-dialog mk-bill-dialog" onClick={closeOnBackdrop} aria-labelledby="marketing-sample-title">
      <div className="p-4 sm:p-6"><div className="mb-4 flex items-center justify-between gap-4"><h2 id="marketing-sample-title" className="text-lg font-semibold">Sample bill preview</h2><button type="button" autoFocus onClick={() => bill.current?.close()} aria-label="Close sample preview" className="mk-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#fcd5cb]"><Icon name="close" className="h-4 w-4" /></button></div><SampleA4Invoice variant="full" prefix="landing-dialog" /></div>
    </dialog>
  </div>;
}
