import { useRef, useState } from 'react';
import LanguageToggle from '../LanguageToggle.jsx';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button, Card } from './Controls.jsx';
import Icon from './Icon.jsx';

export default function LandingPage({ onStart, onLogin, user, onWorkspace }) {
  const { pick } = useLanguage();
  const info = useRef(null);
  const [topic, setTopic] = useState('privacy');
  const topics = {
    privacy: [pick('Your data', 'మీ సమాచారం'), pick('Business details, loads and accounts are stored on this business’s server. An unfinished load is also kept on this device for recovery. Your administrator controls staff access.', 'వ్యాపార వివరాలు, లోడ్లు మరియు ఖాతాలు వ్యాపార సర్వర్‌లో ఉంటాయి. పూర్తి కాని లోడ్ ఈ పరికరంలో కూడా సేవ్ అవుతుంది. సిబ్బంది యాక్సెస్‌ను అడ్మిన్ నియంత్రిస్తారు.')],
    terms: [pick('Pilot terms', 'పైలట్ నిబంధనలు'), pick('Review dimensions, prices and charges before finalizing. Finalized financial values are locked. This pilot records material bills; it does not calculate GST or track payments.', 'ఖరారు చేసే ముందు కొలతలు, ధరలు మరియు ఛార్జీలు తనిఖీ చేయండి. ఖరారు చేసిన బిల్లు మొత్తాలు మారవు. ఈ పైలట్ GST లేదా చెల్లింపులను లెక్కించదు.')],
    contact: [pick('Contact', 'సంప్రదించండి'), pick('For access, account approval or business questions, contact the administrator of your yard. No public support contact has been configured yet.', 'యాక్సెస్, ఖాతా ఆమోదం లేదా వ్యాపార ప్రశ్నల కోసం మీ యార్డ్ అడ్మిన్‌ను సంప్రదించండి. పబ్లిక్ సపోర్ట్ వివరాలు ఇంకా జోడించలేదు.')]
  };
  return <div className="pilot min-h-dvh bg-gray-50 text-gray-900">
    <header className="border-b border-gray-200 bg-white"><div className="mx-auto flex max-w-lg items-center gap-2 px-5 py-3"><span className="brand-mark" aria-hidden="true"><Icon name="loads" /></span><strong className="flex-1 text-lg tracking-tight">GraniteSync</strong><LanguageToggle /><button className="text-button" onClick={user ? onWorkspace : onLogin}>{user ? pick('Open app', 'యాప్ తెరవండి') : pick('Log in', 'లాగిన్')}</button></div></header>
    <main className="mx-auto max-w-lg px-5">
      <section className="py-10">
        <p className="eyebrow mb-4">{pick('FOR STONE & TILE BUSINESSES', 'రాయి మరియు టైల్ వ్యాపారాల కోసం')}</p>
        <h1 className="text-[clamp(2.25rem,8vw,3rem)] leading-[1.12] font-bold tracking-tight">{pick('Every load.', 'ప్రతి లోడ్.')}<br /><span className="text-teal-800">{pick('Accounted for.', 'కచ్చితమైన లెక్క.')}</span></h1>
        <p className="mt-5 text-lg leading-relaxed text-gray-700">{pick('Measure at the yard. Follow the lorry. Send a clear bill—straight from your phone.', 'యార్డ్‌లో కొలవండి. లారీని ట్రాక్ చేయండి. మీ ఫోన్ నుంచే స్పష్టమైన బిల్లు పంపండి.')}</p>
        <Button primary className="mt-7 w-full justify-between" en={user ? 'Open workspace' : 'Get Started'} te={user ? 'వర్క్‌స్పేస్ తెరవండి' : 'ప్రారంభించండి'} onClick={user ? onWorkspace : onStart}><Icon name="arrow" /></Button>
        <p className="mt-3 text-sm text-gray-700">{pick('One business. Your team. English or Telugu.', 'ఒక వ్యాపారం. మీ బృందం. ఇంగ్లీష్ లేదా తెలుగు.')}</p>
        <Card className="mt-8 gap-4 receipt-preview">
          <div className="flex items-center justify-between border-b border-gray-300 pb-3"><strong>{pick('Your business', 'మీ వ్యాపారం')}</strong><span className="text-xs text-gray-600">{pick('EXAMPLE LOAD', 'నమూనా లోడ్')}</span></div>
          <div className="flex items-center justify-between"><span className="font-semibold">3 × 2 {pick('ft', 'అడుగులు')}</span><span>{pick('19 pieces', '19 ముక్కలు')}</span></div>
          <div className="flex items-baseline justify-between"><span className="text-sm text-gray-700">{pick('Calculated area', 'లెక్కించిన విస్తీర్ణం')}</span><strong className="text-3xl tabular-nums">114 <small className="text-sm font-medium">{pick('sq ft', 'చ.అ.')}</small></strong></div>
          <div className="flex items-center gap-2 border-t border-gray-300 pt-3 text-sm text-teal-800"><Icon name="check" />{pick('Ready for PDF & Excel', 'PDF మరియు Excel కోసం సిద్ధం')}</div>
        </Card>
      </section>
      <section className="border-t border-gray-200 py-8"><p className="eyebrow">{pick('A CLEAR PATH FROM YARD TO BILL', 'యార్డ్ నుండి బిల్లు వరకు')}</p>
        {[[ '01', 'loads', 'Log the load', 'లోడ్ నమోదు చేయండి', 'Sizes, fractions, quantities and TOP pieces in one place.', 'సైజులు, భిన్నాలు, ముక్కలు మరియు టాప్ వివరాలు ఒకేచోట.' ], [ '02', 'truck', 'Keep dispatch moving', 'డిస్పాచ్ నిర్వహించండి', 'Find drafts, see lorries in transit and mark arrivals.', 'డ్రాఫ్ట్‌లు, ప్రయాణంలో ఉన్న లారీలు మరియు డెలివరీలను చూడండి.' ], [ '03', 'bill', 'Finish with a clear bill', 'స్పష్టమైన బిల్లు పంపండి', 'Your logo, grouped measurements and saved totals. Share a PDF or export Excel.', 'మీ లోగో, గ్రూప్ కొలతలు మరియు సేవ్ చేసిన మొత్తాలు. PDF లేదా Excel షేర్ చేయండి.' ]].map(([number, icon, en, te, detailEn, detailTe]) => <div key={number} className="flex gap-4 border-b border-gray-200 py-6 last:border-0"><span className="pt-1 font-mono text-sm text-gray-600">{number}</span><div className="flex-1"><h2 className="mb-2 flex items-center gap-2 text-xl font-bold"><Icon name={icon} />{pick(en, te)}</h2><p className="leading-relaxed text-gray-700">{pick(detailEn, detailTe)}</p></div></div>)}
      </section>
      <Card className="mb-8 gap-4"><Icon name="lock" /><h2 className="text-xl font-bold">{pick('Built around your records', 'మీ రికార్డుల కోసం')}</h2><p className="text-gray-700 leading-relaxed">{pick('Staff access is approved by your administrator. Final bills keep their original branding, rates and totals.', 'సిబ్బంది యాక్సెస్‌ను అడ్మిన్ ఆమోదిస్తారు. ఖరారు చేసిన బిల్లులలో అసలు వ్యాపార వివరాలు, ధరలు మరియు మొత్తాలు అలాగే ఉంటాయి.')}</p><Button en={user ? 'Back to workspace' : 'Sign Up'} te={user ? 'వర్క్‌స్పేస్‌కు వెళ్ళండి' : 'ఖాతా సృష్టించండి'} onClick={user ? onWorkspace : onStart} /></Card>
    </main>
    <footer className="mx-auto max-w-lg border-t border-gray-200 px-5 py-6"><strong>GraniteSync</strong><div className="mt-2 flex flex-wrap gap-4">{[['privacy', 'Privacy', 'గోప్యత'], ['terms', 'Terms', 'నిబంధనలు'], ['contact', 'Contact', 'సంప్రదించండి']].map(([key, en, te]) => <button key={key} className="text-button underline underline-offset-4" onClick={() => { setTopic(key); info.current.showModal(); }}>{pick(en, te)}</button>)}</div><p className="text-sm text-gray-600">{pick('Small-business pilot · Feet, square feet & INR', 'చిన్న వ్యాపార పైలట్ · అడుగులు, చ.అ. మరియు INR')}</p></footer>
    <dialog ref={info} className="app-dialog" aria-labelledby="info-title"><div className="space-y-4 p-6"><h2 id="info-title" className="text-xl font-bold">{topics[topic][0]}</h2><p className="leading-relaxed">{topics[topic][1]}</p><Button className="w-full" en="Close" te="మూసివేయండి" onClick={() => info.current.close()} /></div></dialog>
  </div>;
}
