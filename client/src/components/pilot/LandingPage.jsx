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
  return <div className="pilot min-h-dvh bg-gray-50 text-gray-900 selection:bg-teal-200">
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
        <span className="brand-mark shadow-sm" aria-hidden="true"><Icon name="loads" /></span>
        <strong className="flex-1 text-xl font-bold tracking-tight">StoneDesk</strong>
        <LanguageToggle />
        <button className="text-button px-4 font-semibold text-gray-700 hover:text-gray-900 transition-colors" onClick={user ? onWorkspace : onLogin}>
          {user ? pick('Open app', 'యాప్ తెరవండి') : pick('Log in', 'లాగిన్')}
        </button>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-6">
      <section className="py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="max-w-2xl">
          <p className="text-[14px] font-bold tracking-widest text-teal-800 uppercase mb-6">{pick('FOR STONE & TILE BUSINESSES', 'రాయి మరియు టైల్ వ్యాపారాల కోసం')}</p>
          <h1 className="text-[clamp(2.75rem,6vw,4.5rem)] leading-[1.05] font-extrabold tracking-tight text-gray-900">
            {pick('Every load.', 'ప్రతి లోడ్.')}<br />
            <span className="text-teal-800">{pick('Accounted for.', 'కచ్చితమైన లెక్క.')}</span>
          </h1>
          <div className="mt-6 flex items-center gap-3 text-sm font-bold text-gray-400 uppercase tracking-wide">
            <span>{pick('Measure', 'కొలవండి')}</span><span>→</span><span>{pick('Dispatch', 'డిస్పాచ్')}</span><span>→</span><span>{pick('Bill', 'బిల్లు చేయండి')}</span>
          </div>
          <p className="mt-4 text-xl leading-relaxed text-gray-600 font-medium">
            {pick('Measure stone loads, track dispatch, and create PDF/Excel bills in minutes.', 'రాతి లోడ్లను కొలవండి, డిస్పాచ్ ట్రాక్ చేయండి మరియు నిమిషాల్లో PDF/Excel బిల్లులను సృష్టించండి.')}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            <Button primary className="w-full sm:w-auto px-8 py-4 min-h-[44px] text-lg bg-teal-900 text-white shadow-lg shadow-teal-900/20 hover:shadow-teal-900/40 hover:bg-teal-950 transition-all duration-300 rounded-2xl" en={user ? 'Open workspace' : 'Get Started'} te={user ? 'వర్క్‌స్పేస్ తెరవండి' : 'ప్రారంభించండి'} onClick={user ? onWorkspace : onStart} />
            <div className="flex flex-col gap-1">
              <p className="text-[14px] font-semibold text-gray-700">{pick('Team access · English/Telugu · PDF & Excel', 'బృందం యాక్సెస్ · ఇంగ్లీష్/తెలుగు · PDF & Excel')}</p>
              <button className="text-[14px] font-semibold text-teal-700 hover:text-teal-900 text-left transition-colors" onClick={() => { setTopic('contact'); info.current.showModal(); }}>{pick('Need help? Contact us', 'సహాయం కావాలా? సంప్రదించండి')}</button>
            </div>
          </div>
          <p className="mt-10 text-[14px] font-medium text-gray-500 border-t border-gray-200/60 pt-6">
            {pick('Built for stone yards using feet, sq ft, INR, PDF and Excel.', 'అడుగులు, చ.అ., INR, PDF మరియు Excel ఉపయోగించే రాతి యార్డ్‌ల కోసం రూపొందించబడింది.')}
          </p>
        </div>
        
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-teal-100 to-teal-50 rounded-3xl transform rotate-3 scale-105 -z-10 blur-xl opacity-70"></div>
          <div className="relative z-10">
            <Card className="gap-5 receipt-preview shadow-2xl shadow-gray-200/50 lg:rotate-2 hover:rotate-0 transition-transform duration-500 ease-out border-0 bg-white/90 backdrop-blur-sm p-8 rounded-3xl">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <strong className="text-lg text-gray-900">{pick('Your business', 'మీ వ్యాపారం')}</strong>
                <span className="text-[14px] font-bold tracking-wider uppercase bg-teal-50 text-teal-700 px-3 py-1 rounded-md">{pick('EXAMPLE LOAD', 'నమూనా లోడ్')}</span>
              </div>
              <div className="flex items-center justify-between text-lg"><span className="font-semibold text-gray-700">3 × 2 {pick('ft', 'అడుగులు')}</span><span className="text-gray-600">{pick('19 pieces', '19 ముక్కలు')}</span></div>
              <div className="flex items-baseline justify-between mt-2"><span className="text-base font-medium text-gray-500">{pick('Calculated area', 'లెక్కించిన విస్తీర్ణం')}</span><strong className="text-4xl tabular-nums tracking-tight text-gray-900">114 <small className="text-lg font-semibold text-gray-500">{pick('sq ft', 'చ.అ.')}</small></strong></div>
            </Card>
            <div className="absolute -bottom-6 -right-4 md:-right-8 z-20 bg-white p-4 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-4">
              <div className="bg-red-50 text-red-600 p-3 rounded-xl"><Icon name="bill" /></div>
              <div>
                <p className="text-sm font-bold text-gray-900">Invoice_1042.pdf</p>
                <p className="text-[13px] text-gray-500 font-medium">{pick('Generated & Ready', 'సృష్టించబడింది')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="py-20 border-t border-gray-200/60">
        <p className="text-[14px] font-bold tracking-widest text-gray-500 uppercase text-center mb-16">{pick('A CLEAR PATH FROM YARD TO BILL', 'యార్డ్ నుండి బిల్లు వరకు')}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[[ '01', 'loads', 'Measure', 'కొలవండి', 'Sizes, fractions, quantities and TOP pieces in one place.', 'సైజులు, భిన్నాలు, ముక్కలు మరియు టాప్ వివరాలు ఒకేచోట.' ], [ '02', 'truck', 'Track', 'ట్రాక్ చేయండి', 'Find drafts, see lorries in transit and mark arrivals.', 'డ్రాఫ్ట్‌లు, ప్రయాణంలో ఉన్న లారీలు మరియు డెలివరీలను చూడండి.' ], [ '03', 'bill', 'Bill', 'బిల్లు చేయండి', 'Your logo, grouped measurements and saved totals. Share a PDF or export Excel.', 'మీ లోగో, గ్రూప్ కొలతలు మరియు సేవ్ చేసిన మొత్తాలు. PDF లేదా Excel షేర్ చేయండి.' ]].map(([number, icon, en, te, detailEn, detailTe]) => 
            <div key={number} className="flex flex-col gap-5 p-8 rounded-[2rem] bg-white shadow-sm border border-gray-100/80 hover:shadow-xl hover:shadow-gray-200/40 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-2">
                <div className="p-3 bg-teal-50 rounded-2xl text-teal-800 group-hover:bg-teal-600 group-hover:text-white transition-colors duration-300">
                  <Icon name={icon} />
                </div>
                <span className="font-mono text-xl font-bold text-gray-200">{number}</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{pick(en, te)}</h2>
              <p className="leading-relaxed text-gray-600 text-lg">{pick(detailEn, detailTe)}</p>
            </div>
          )}
        </div>
      </section>
      
      <section className="pb-24">
        <Card className="gap-8 items-center text-center p-12 lg:p-16 bg-teal-900 text-white shadow-2xl rounded-[2.5rem] border-0 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-800 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-950 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="p-4 bg-teal-800/50 rounded-full mb-2">
              <Icon name="lock" />
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">{pick('Built around your records', 'మీ రికార్డుల కోసం')}</h2>
            <p className="text-teal-100/90 leading-relaxed max-w-2xl mx-auto text-lg md:text-xl font-medium mb-4">{pick('Admin-approved staff access keeps business records controlled. Final bills keep their original branding, rates and totals.', 'అడ్మిన్ ఆమోదించిన సిబ్బంది యాక్సెస్ వ్యాపార రికార్డులను సురక్షితంగా ఉంచుతుంది. ఖరారు చేసిన బిల్లులలో అసలు వివరాలు అలాగే ఉంటాయి.')}</p>
            <Button className="mt-6 bg-white text-teal-900 hover:bg-gray-100 border-0 px-10 py-4 min-h-[44px] text-lg rounded-2xl shadow-lg hover:scale-105 transition-transform duration-200" en={user ? 'Back to workspace' : 'Get Started'} te={user ? 'వర్క్‌స్పేస్‌కు వెళ్ళండి' : 'ప్రారంభించండి'} onClick={user ? onWorkspace : onStart} />
          </div>
        </Card>
      </section>
    </main>
    
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span className="brand-mark w-10 h-10 rounded-xl" aria-hidden="true"><Icon name="loads" /></span>
          <strong className="text-xl tracking-tight text-gray-900">StoneDesk</strong>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          {[['privacy', 'Privacy', 'గోప్యత'], ['terms', 'Terms', 'నిబంధనలు'], ['contact', 'Contact', 'సంప్రదించండి']].map(([key, en, te]) => 
            <button key={key} className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors" onClick={() => { setTopic(key); info.current.showModal(); }}>{pick(en, te)}</button>
          )}
        </div>
        <p className="text-[14px] font-medium text-gray-500">{pick('Small-business pilot · Feet, square feet & INR', 'చిన్న వ్యాపార పైలట్ · అడుగులు, చ.అ. మరియు INR')}</p>
      </div>
    </footer>
    
    <dialog ref={info} className="app-dialog rounded-[2rem] shadow-2xl border-0 p-0" aria-labelledby="info-title">
      <div className="space-y-6 p-8 bg-white">
        <h2 id="info-title" className="text-2xl font-extrabold text-gray-900">{topics[topic][0]}</h2>
        <p className="leading-relaxed text-gray-600 text-lg">{topics[topic][1]}</p>
        <Button className="w-full py-4 text-lg rounded-xl" en="Close" te="మూసివేయండి" onClick={() => info.current.close()} />
      </div>
    </dialog>
  </div>;
}
