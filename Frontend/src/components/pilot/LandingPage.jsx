import { useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import Icon from './Icon.jsx';
import ProductShowcase, { SampleDownload, SampleInvoice } from './ProductShowcase.jsx';
import { MagneticCTA, Reveal } from './MarketingMotion.jsx';

export default function LandingPage({ onStart, onLogin, user, onWorkspace }) {
  const { pick, language, setLanguage } = useLanguage();
  const info = useRef(null);
  const bill = useRef(null);
  const [topic, setTopic] = useState('privacy');
  const start = user ? onWorkspace : onStart;
  const startLabel = user ? pick('Open workspace', 'వర్క్‌స్పేస్ తెరవండి') : pick('Create workspace', 'వర్క్‌స్పేస్ సృష్టించండి');
  const topics = {
    privacy: {
      title: pick('Your data, explained', 'మీ సమాచారం గురించి'),
      paragraphs: [
        pick('Accounts, business details, measurements and dispatch records are stored on the server running this StoneDesk installation. Your business administrator manages team access.', 'ఖాతాలు, వ్యాపార వివరాలు, కొలతలు మరియు డిస్పాచ్ రికార్డులు ఈ StoneDesk సర్వర్‌లో నిల్వ ఉంటాయి. మీ వ్యాపార అడ్మిన్ బృందం యాక్సెస్‌ను నిర్వహిస్తారు.'),
        pick('An unfinished load can also be kept on this device for recovery. On a shared device, use your own account and sign out when finished.', 'పూర్తి కాని లోడ్ రికవరీ కోసం ఈ పరికరంలో కూడా ఉండవచ్చు. పంచుకునే పరికరంలో మీ ఖాతానే ఉపయోగించి, పని ముగిసిన తర్వాత లాగ్ అవుట్ చేయండి.'),
        pick('The public previews use sample data only. Downloading the sample PDF does not access or create a business record. Ask your administrator about this installation’s retention and deletion policies.', 'ఈ పబ్లిక్ ప్రివ్యూలలో నమూనా సమాచారం మాత్రమే ఉంటుంది. నమూనా PDF డౌన్‌లోడ్ మీ వ్యాపార రికార్డులను తెరవదు లేదా సృష్టించదు. సమాచారం నిల్వ, తొలగింపు విధానాల గురించి అడ్మిన్‌ను అడగండి.'),
      ],
    },
    terms: {
      title: pick('Pilot terms & limitations', 'పైలట్ నిబంధనలు మరియు పరిమితులు'),
      paragraphs: [
        pick('StoneDesk records material measurements and load bills in feet, square feet and INR. Review all dimensions, quantities, rates and loading / royalty charges before finalizing.', 'StoneDesk అడుగులు, చదరపు అడుగులు మరియు INRలో మెటీరియల్ కొలతలు, లోడ్ బిల్లులను నమోదు చేస్తుంది. ఖరారు చేసే ముందు కొలతలు, ముక్కలు, ధరలు, లోడింగ్ / రాయల్టీ ఛార్జీలను తనిఖీ చేయండి.'),
        pick('Finalized bills preserve their original financial values and business snapshot. Dispatch and delivery status can still be updated by authorized team members.', 'ఖరారు చేసిన బిల్లుల అసలు మొత్తాలు, వ్యాపార వివరాలు అలాగే ఉంటాయి. అనుమతి ఉన్న బృంద సభ్యులు డిస్పాచ్, డెలివరీ స్థితిని నవీకరించవచ్చు.'),
        pick('This pilot does not calculate GST, track payments or provide GPS tracking. A material load bill is not presented as a GST tax invoice. Sample records are demonstrations, not transactions.', 'ఈ పైలట్ GST లెక్కించదు, చెల్లింపులు ట్రాక్ చేయదు, GPS ట్రాకింగ్ అందించదు. మెటీరియల్ లోడ్ బిల్లు GST ట్యాక్స్ ఇన్వాయిస్ కాదు. నమూనా రికార్డులు ప్రదర్శన కోసం మాత్రమే.'),
      ],
    },
    support: {
      title: pick('Support & account access', 'సహాయం మరియు ఖాతా యాక్సెస్'),
      paragraphs: [
        pick('For account approval, a business organization ID or questions about a load, contact your yard’s administrator. They manage access in Settings → Team & access.', 'ఖాతా ఆమోదం, సంస్థ ఐడీ లేదా లోడ్ గురించి ప్రశ్నల కోసం మీ యార్డ్ అడ్మిన్‌ను సంప్రదించండి. సెట్టింగ్స్ → బృందం మరియు యాక్సెస్‌లో వారు అనుమతులను నిర్వహిస్తారు.'),
        pick('Admin: business settings, rates and team access. Yard Manager: prepare loads and measurements. Dispatcher: prepare loads, finalize bills and confirm deliveries. Admins can also finalize and confirm deliveries.', 'అడ్మిన్: వ్యాపార సెట్టింగ్స్, ధరలు, బృందం యాక్సెస్. యార్డ్ మేనేజర్: లోడ్లు, కొలతలు సిద్ధం చేస్తారు. డిస్పాచర్: లోడ్లు సిద్ధం చేసి, బిల్లులు ఖరారు చేసి, డెలివరీ నిర్ధారిస్తారు. అడ్మిన్లు కూడా బిల్లులు ఖరారు చేసి డెలివరీ నిర్ధారించవచ్చు.'),
        pick('No public support email, phone number or response-time promise has been configured for this installation.', 'ఈ ఇన్‌స్టాలేషన్‌కు పబ్లిక్ సపోర్ట్ ఇమెయిల్, ఫోన్ నంబర్ లేదా ప్రతిస్పందన సమయ హామీ ఏర్పాటు చేయలేదు.'),
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

  return <div className="marketing min-h-dvh bg-[#f7fbfa] text-[#203d36] selection:bg-[#cce8de]" lang={language}>
    <a className="mk-skip-link" href="#marketing-main" onClick={event => anchor(event, 'marketing-main')}>{pick('Skip to content', 'విషయానికి వెళ్ళండి')}</a>
    <header className="mk-public-header sticky top-3 z-20 mx-auto w-[calc(100%-24px)] max-w-[1160px] sm:top-4 sm:w-[calc(100%-48px)]">
      <nav aria-label={pick('Public navigation', 'పబ్లిక్ నావిగేషన్')} className="mk-nav flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[28px] border border-white px-3 py-2 sm:gap-x-5 sm:rounded-full sm:px-5">
        <a href="#marketing-main" onClick={event => anchor(event, 'marketing-main')} className="flex min-h-11 shrink-0 items-center gap-2.5" aria-label={pick('StoneDesk home', 'StoneDesk హోమ్')}><span className="mk-brand flex h-8 w-8 items-center justify-center rounded-xl bg-[#17645d] text-white" aria-hidden="true"><Icon name="loads" className="h-4 w-4" /></span><span className="text-lg font-semibold tracking-[-0.045em]">StoneDesk</span></a>
        <div className="mk-nav-links flex items-center gap-1 sm:gap-3">
          <a href="#product" onClick={event => anchor(event, 'product')} className="mk-nav-link flex min-h-11 items-center rounded-full px-3 text-sm">{pick('Product', 'ఉత్పత్తి')}</a>
          <a href="#how-it-works" onClick={event => anchor(event, 'how-it-works')} className="mk-nav-link flex min-h-11 items-center rounded-full px-3 text-sm">{pick('How it works', 'ఎలా పనిచేస్తుంది')}</a>
        </div>
        <div className="mk-nav-actions ml-auto flex items-center gap-1 sm:gap-3">
          <div className="mk-language flex shrink-0 items-center rounded-full border border-[#dbe6e1] p-0.5" role="group" aria-label={pick('Language', 'భాష')}>
            {[['en', 'EN', 'English'], ['te', 'TE', 'తెలుగు']].map(([value, short, label]) => <button type="button" key={value} lang={value} aria-label={label} aria-pressed={language === value} onClick={() => setLanguage(value)} className="min-h-10 min-w-10 rounded-full text-xs font-semibold">{short}</button>)}
          </div>
          {!user && <button type="button" onClick={onLogin} className="mk-login min-h-11 rounded-full px-3 text-sm font-medium">{pick('Log in', 'లాగిన్')}</button>}
          <div className="mk-nav-cta"><MagneticCTA compact compactLabel={user ? pick('Workspace', 'వర్క్‌స్పేస్') : pick('Create', 'సృష్టించండి')} onClick={start}>{startLabel}</MagneticCTA></div>
        </div>
      </nav>
    </header>

    <main id="marketing-main" tabIndex={-1} className="mx-auto max-w-[1240px] px-5 outline-none sm:px-8 lg:px-10">
      <section className="mk-hero grid min-w-0 grid-cols-1 items-center gap-10 pb-8 pt-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12 lg:pb-16 lg:pt-20" aria-labelledby="marketing-hero-title">
        <div className="min-w-0">
          <p className="mb-5 flex items-center gap-2 text-xs font-medium tracking-wide text-[#17645d]"><span className="h-1.5 w-1.5 rounded-full bg-[#17645d]" aria-hidden="true" />{pick('FOR STONE & TILE BUSINESSES', 'రాయి మరియు టైల్ వ్యాపారాల కోసం')}</p>
          <h1 id="marketing-hero-title" className="mk-hero-title font-semibold tracking-[-0.055em]">{pick('Every load.', 'ప్రతి లోడ్.')}<br /><span className="text-[#17645d]">{pick('Accounted for.', 'కచ్చితమైన లెక్క.')}</span></h1>
          <p className="mt-6 max-w-[36ch] text-base leading-relaxed text-[#526661] sm:text-lg">{pick('From first measurement to final bill. A clear workspace for your stone business and the people running it.', 'మొదటి కొలత నుండి చివరి బిల్లు వరకు. మీ రాతి వ్యాపారం మరియు బృందం కోసం స్పష్టమైన వర్క్‌స్పేస్.')}</p>
          <div className="mt-8"><MagneticCTA onClick={start}>{startLabel}</MagneticCTA></div>
        </div>
        <Reveal className="mk-hero-product relative min-w-0" delay={0.08}><ProductShowcase animateStatus /></Reveal>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-y border-[#dce6e1] py-5 text-sm text-[#526661]" aria-label={pick('Workspace essentials', 'వర్క్‌స్పేస్ ముఖ్యాంశాలు')}>
        {[[ 'loads', 'Feet, fractions & square feet', 'అడుగులు, భిన్నాలు మరియు చ.అ.' ], [ 'user', 'Role-based team access', 'పాత్ర ఆధారిత బృందం యాక్సెస్' ], [ 'bill', 'PDF & Excel exports', 'PDF మరియు Excel ఎగుమతులు' ]].map(([icon, en, te]) => <span key={icon} className="flex items-center gap-2.5"><Icon name={icon} className="h-4 w-4 text-[#17645d]" />{pick(en, te)}</span>)}
      </div>

      <section id="product" tabIndex={-1} className="mk-section scroll-mt-32 outline-none" aria-labelledby="marketing-product-title">
        <Reveal><h2 id="marketing-product-title" className="mk-section-title max-w-[18ch] font-semibold tracking-[-0.045em]">{pick('Made for the work. Not the paperwork.', 'పనికి తోడు. కాగితాల భారానికి కాదు.')}</h2><p className="mt-4 max-w-[51ch] text-base leading-relaxed text-[#526661]">{pick('Keep measurements, dispatch status and saved bills together.', 'కొలతలు, డిస్పాచ్ స్థితి, సేవ్ చేసిన బిల్లులు ఒకేచోట.')}</p></Reveal>
        <div className="mt-9 divide-y divide-[#dce6e1] border-y border-[#dce6e1] lg:mt-12">
          <Reveal className="grid grid-cols-1 gap-4 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e5f1eb] text-[#17645d]" aria-hidden="true"><Icon name="loads" /></span><h3 className="text-2xl font-semibold tracking-tight">{pick('Measurements that add up.', 'సరిగ్గా కూడే కొలతలు.')}</h3></div><p className="max-w-[52ch] text-sm leading-relaxed text-[#526661]">{pick('Enter fractional feet, quantities and row numbers, with Top pieces kept in the same row. See area and material totals before you finalize.', 'అడుగుల్లో భిన్నాలు, ముక్కలు, వరుస సంఖ్య నమోదు చేయండి; టాప్ ముక్కలు అదే వరుసలో ఉంటాయి. ఖరారు చేసే ముందు విస్తీర్ణం, మెటీరియల్ మొత్తాలు చూడండి.')}</p></Reveal>
          <Reveal className="grid grid-cols-1 gap-4 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12" delay={0.06}><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e5f1eb] text-[#17645d]" aria-hidden="true"><Icon name="truck" /></span><h3 className="text-2xl font-semibold tracking-tight">{pick('Know where each load stands.', 'ప్రతి లోడ్ స్థితి తెలుసుకోండి.')}</h3></div><div className="max-w-[52ch]"><p className="text-sm leading-relaxed text-[#526661]">{pick('Draft, dispatched or delivered. Your team records each step, with lorry and destination details close at hand.', 'డ్రాఫ్ట్, పంపబడింది లేదా డెలివరీ అయింది. లారీ, గమ్యస్థానం వివరాలతో మీ బృందం ప్రతి దశను నమోదు చేస్తుంది.')}</p><p className="mt-3 text-xs text-[#526661]">{pick('Team-updated status, not live GPS tracking.', 'బృందం నవీకరించే స్థితి, లైవ్ GPS ట్రాకింగ్ కాదు.')}</p></div></Reveal>
          <Reveal className="grid grid-cols-1 gap-4 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12" delay={0.12}><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e5f1eb] text-[#17645d]" aria-hidden="true"><Icon name="lock" /></span><h3 className="text-2xl font-semibold tracking-tight">{pick('A final bill stays final.', 'ఖరారు చేసిన బిల్లు అలాగే ఉంటుంది.')}</h3></div><p className="max-w-[52ch] text-sm leading-relaxed text-[#526661]">{pick('Finalized financial values stay locked. Original branding, rates and totals remain with the bill, even when business settings change.', 'ఖరారు చేసిన బిల్లు మొత్తాలు లాక్ అవుతాయి. వ్యాపార సెట్టింగ్స్ మారినా అసలు బ్రాండింగ్, ధరలు, మొత్తాలు బిల్లులో అలాగే ఉంటాయి.')}</p></Reveal>
        </div>
      </section>

      <section id="how-it-works" tabIndex={-1} className="mk-section scroll-mt-32 border-t border-[#dce6e1] outline-none" aria-labelledby="marketing-workflow-title">
        <Reveal><h2 id="marketing-workflow-title" className="mk-section-title font-semibold tracking-[-0.045em]">{pick('One load. A clear next step.', 'ఒక లోడ్. స్పష్టమైన తదుపరి దశ.')}</h2></Reveal>
        <ol className="mt-8 grid grid-cols-1 gap-0 md:grid-cols-[1.05fr_1fr_1.2fr] md:gap-8">
          {[[ '01', 'Measure & prepare', 'కొలిచి సిద్ధం చేయండి', 'Choose a product, add dimensions and quantities, then save a draft for review.', 'రకం ఎంచుకుని కొలతలు, ముక్కలు జోడించండి. తనిఖీ కోసం డ్రాఫ్ట్ సేవ్ చేయండి.' ], [ '02', 'Review & dispatch', 'తనిఖీ చేసి పంపండి', 'An Admin or Dispatcher reviews rates and charges, finalizes the bill and records dispatch.', 'అడ్మిన్ లేదా డిస్పాచర్ ధరలు, ఛార్జీలు తనిఖీ చేసి, బిల్లు ఖరారు చేసి, డిస్పాచ్ నమోదు చేస్తారు.' ], [ '03', 'Export & confirm', 'ఎగుమతి చేసి నిర్ధారించండి', 'Download the buyer PDF, driver slip or Excel bill. An authorized team member confirms delivery.', 'కొనుగోలుదారు PDF, డ్రైవర్ స్లిప్ లేదా Excel బిల్లు డౌన్‌లోడ్ చేయండి. అనుమతి ఉన్న సభ్యుడు డెలివరీ నిర్ధారిస్తారు.' ]].map(([number, en, te, detailEn, detailTe]) => <li key={number} className="mk-workflow-step border-b border-[#dce6e1] py-6 md:border-b-0 md:py-0"><Reveal delay={Number(number) * 0.05}><span className="text-sm font-medium text-[#17645d] tabular-nums">{number}</span><h3 className="mt-4 text-xl font-semibold tracking-tight">{pick(en, te)}</h3><p className="mt-3 max-w-[35ch] text-sm leading-relaxed text-[#526661]">{pick(detailEn, detailTe)}</p></Reveal></li>)}
        </ol>
      </section>

      <section className="mk-section border-t border-[#dce6e1]" aria-labelledby="marketing-bill-title">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <Reveal><h2 id="marketing-bill-title" className="mk-section-title max-w-[14ch] font-semibold tracking-[-0.045em]">{pick('A bill you can actually open.', 'నిజంగా తెరిచి చూడగల బిల్లు.')}</h2><p className="mt-5 max-w-[39ch] text-base leading-relaxed text-[#526661]">{pick('Grouped measurements. Clear charges. A saved total. Try a real PDF generated from this sample, right on your device.', 'గ్రూప్ కొలతలు. స్పష్టమైన ఛార్జీలు. సేవ్ చేసిన మొత్తం. ఈ నమూనాతో మీ పరికరంలో నిజమైన PDF సృష్టించి చూడండి.')}</p>
            <div className="mt-7 flex flex-col items-start gap-4"><button type="button" onClick={() => bill.current?.showModal()} className="mk-text-link inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#17645d]">{pick('Open sample bill', 'నమూనా బిల్లు తెరవండి')}<Icon name="arrow" className="h-4 w-4" /></button><SampleDownload /></div>
            <p className="mt-6 max-w-[43ch] text-xs leading-relaxed text-[#526661]">{pick('Material bills in INR. No GST calculation or payment tracking. All figures shown are sample data.', 'INRలో మెటీరియల్ బిల్లులు. GST లెక్కింపు లేదా చెల్లింపుల ట్రాకింగ్ లేదు. చూపిన మొత్తాలు నమూనా మాత్రమే.')}</p>
          </Reveal>
          <Reveal className="mk-bill-bezel min-w-0 rounded-[28px] border border-[#cfdfd8] p-2.5 sm:p-4" delay={0.06}><SampleInvoice /></Reveal>
        </div>
      </section>

      <section className="mk-section border-t border-[#dce6e1]" aria-labelledby="marketing-team-title">
        <Reveal className="mk-team-surface grid grid-cols-1 gap-8 rounded-[28px] border border-[#d7e7dd] bg-[#edf6f1] p-6 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div><h2 id="marketing-team-title" className="mk-section-title font-semibold tracking-[-0.045em]">{pick('Your team. The right access.', 'మీ బృందం. సరైన అనుమతులు.')}</h2><p className="mt-4 text-sm leading-relaxed text-[#526661]">{pick('A dedicated business workspace, with English and Telugu on the same device. Your administrator approves team access.', 'ప్రత్యేక వ్యాపార వర్క్‌స్పేస్, ఒకే పరికరంలో ఇంగ్లీష్ మరియు తెలుగు. బృందం యాక్సెస్‌ను మీ అడ్మిన్ ఆమోదిస్తారు.')}</p><span className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#c8dbd0] px-4 py-2 text-sm font-medium text-[#17645d]"><span lang="en">English</span><span aria-hidden="true">/</span><span lang="te">తెలుగు</span></span></div>
          <dl className="divide-y divide-[#cfdfd5]">
            {[[ 'Admin', 'అడ్మిన్', 'Business settings, rates, team access, dispatch and delivery.', 'వ్యాపార సెట్టింగ్స్, ధరలు, బృందం యాక్సెస్, డిస్పాచ్ మరియు డెలివరీ.' ], [ 'Yard Manager', 'యార్డ్ మేనేజర్', 'Prepare loads and enter measurements for review.', 'లోడ్లు సిద్ధం చేసి, తనిఖీ కోసం కొలతలు నమోదు చేస్తారు.' ], [ 'Dispatcher', 'డిస్పాచర్', 'Prepare loads, finalize bills and confirm deliveries.', 'లోడ్లు సిద్ధం చేసి, బిల్లులు ఖరారు చేసి, డెలివరీ నిర్ధారిస్తారు.' ]].map(([en, te, detailEn, detailTe]) => <div key={en} className="grid grid-cols-1 gap-2 py-5 first:pt-0 last:pb-0 sm:grid-cols-[140px_1fr] sm:gap-4"><dt className="text-sm font-semibold">{pick(en, te)}</dt><dd className="text-sm leading-relaxed text-[#526661]">{pick(detailEn, detailTe)}</dd></div>)}
          </dl>
        </Reveal>
      </section>

      <section className="mk-section border-t border-[#dce6e1]" aria-labelledby="marketing-start-title"><Reveal className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center"><div><h2 id="marketing-start-title" className="mk-section-title font-semibold tracking-[-0.045em]">{pick('Give your next load a home.', 'మీ తదుపరి లోడ్‌కు ఒక చోటు.')}</h2><p className="mt-3 text-sm text-[#526661]">{pick('Start with your business. Bring your team when you’re ready.', 'మీ వ్యాపారంతో మొదలుపెట్టండి. సిద్ధమైనప్పుడు బృందాన్ని చేర్చండి.')}</p></div><MagneticCTA onClick={start}>{startLabel}</MagneticCTA></Reveal></section>
    </main>

    <footer className="border-t border-[#dce6e1]"><div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-5 px-5 py-8 sm:px-8 md:flex-row md:items-center lg:px-10"><div><p className="text-lg font-semibold tracking-[-0.045em]">StoneDesk</p><p className="mt-2 text-xs text-[#526661]">{pick('Small-business pilot · Feet, square feet & INR', 'చిన్న వ్యాపార పైలట్ · అడుగులు, చదరపు అడుగులు మరియు INR')}</p></div><div className="flex flex-wrap gap-2 sm:gap-5">{[['privacy', 'Privacy', 'గోప్యత'], ['terms', 'Terms', 'నిబంధనలు'], ['support', 'Support', 'సహాయం']].map(([key, en, te]) => <button type="button" key={key} onClick={() => openInfo(key)} className="mk-nav-link min-h-11 rounded-full px-3 text-sm text-[#526661]">{pick(en, te)}</button>)}</div></div></footer>

    <dialog ref={info} className="mk-dialog" aria-labelledby="marketing-info-title" aria-describedby="marketing-info-body">
      <div className="p-6 sm:p-8"><h2 id="marketing-info-title" className="text-2xl font-semibold tracking-tight">{topics[topic].title}</h2><div id="marketing-info-body" className="mt-5 space-y-4 text-sm leading-relaxed text-[#526661]">{topics[topic].paragraphs.map((paragraph, index) => <p key={`${topic}-${index}`}>{paragraph}</p>)}</div><div className="mt-6 flex justify-end"><button type="button" autoFocus onClick={() => info.current?.close()} className="mk-secondary min-h-11 rounded-full border border-[#cadbd5] px-5 text-sm font-semibold text-[#17645d]">{pick('Close', 'మూసివేయండి')}</button></div></div>
    </dialog>
    <dialog ref={bill} className="mk-dialog mk-bill-dialog" aria-labelledby="marketing-sample-title">
      <div className="p-4 sm:p-6"><div className="mb-4 flex items-center justify-between gap-4"><h2 id="marketing-sample-title" className="text-lg font-semibold">{pick('Sample bill preview', 'నమూనా బిల్లు ప్రివ్యూ')}</h2><button type="button" autoFocus onClick={() => bill.current?.close()} aria-label={pick('Close sample preview', 'నమూనా ప్రివ్యూ మూసివేయండి')} className="mk-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#cadbd5]"><Icon name="close" className="h-4 w-4" /></button></div><SampleInvoice /><SampleDownload className="mt-5" /></div>
    </dialog>
  </div>;
}
