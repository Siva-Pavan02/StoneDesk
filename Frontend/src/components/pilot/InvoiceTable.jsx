import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { billRows } from '../../utils/billData.js';
import { money } from '../../utils/pilotDraft.js';
import { Button } from './Controls.jsx';

export default function InvoiceTable({ record }) {
  const { pick } = useLanguage();
  const [mode, setMode] = useState('summary'), [page, setPage] = useState(0);
  const items = mode === 'summary' ? record.inventory.map((g, index) => {
    const rows = billRows({ inventory: [g] });
    return { ...g, batch: index + 1, quantity: rows.reduce((n, r) => n + r.quantity, 0), sqFt: g.totalSqFt ?? rows.reduce((n, r) => n + r.sqFt, 0) };
  }) : record.inventory.flatMap((g, index) => billRows({ inventory: [g] }).map(r => ({ ...r, batch: index + 1 })));
  const pageSize = mode === 'summary' ? 10 : 20, pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages - 1);
  return <section className="invoice-section">
    <div className="invoice-section-heading"><div><h2 className="font-bold text-lg">{pick('Measurements & batches', 'కొలతలు మరియు బ్యాచ్‌లు')}</h2><p className="text-sm text-gray-600">{record.inventory.length} {pick('batches', 'బ్యాచ్‌లు')}</p></div><div className="flex flex-wrap gap-2">{[['summary', 'Batch summary', 'బ్యాచ్ సారాంశం'], ['details', 'Measurements', 'కొలతలు']].map(([value, en, te]) => <button key={value} type="button" aria-pressed={mode === value} className={`btn rounded-xl ${mode === value ? 'bg-teal-800 text-white' : 'bg-white border-gray-300'}`} onClick={() => { setMode(value); setPage(0); }}>{pick(en, te)}</button>)}</div></div>
    <p className="text-xs text-gray-600 px-4 pb-2">{pick('Swipe the table sideways to see all columns on smaller screens.', 'చిన్న స్క్రీన్‌లో అన్ని కాలమ్‌ల కోసం పట్టికను పక్కకు స్వైప్ చేయండి.')}</p>
    <div className="table-scroll" tabIndex={0} role="region" aria-label={pick('Invoice measurements', 'బిల్లు కొలతలు')}><table className="business-table">
      <caption className="sr-only">{pick('Stored measurements and amounts', 'సేవ్ చేసిన కొలతలు మరియు మొత్తాలు')}</caption>
      <thead><tr><th>{pick('Batch / material', 'బ్యాచ్ / రాయి')}</th>{mode === 'details' && <th>{pick('Size (ft)', 'సైజు (అడుగులు)')}</th>}<th className="numeric">{pick('Pieces', 'ముక్కలు')}</th><th className="numeric">{pick('Sq ft', 'చ.అ.')}</th><th className="numeric">{pick('Rate ₹', 'ధర ₹')}</th><th className="numeric">{pick('Amount ₹', 'మొత్తం ₹')}</th></tr></thead>
      <tbody>{items.slice(current * pageSize, (current + 1) * pageSize).map((r, i) => <tr key={`${current}-${i}`}><th scope="row"><strong>{r.batch}. {r.stoneType}</strong><span className="block text-xs font-normal text-gray-600">{r.finish}{r.category ? ` · ${r.category}` : ''}</span></th>{mode === 'details' && <td>{r.lengthFt} × {r.widthFt}</td>}<td className="numeric">{r.quantity}</td><td className="numeric">{r.sqFt.toFixed(2)}</td><td className="numeric">{money(r.ratePerSqFt)}</td><td className="numeric font-semibold">{r.lineTotal == null ? pick('See batch', 'బ్యాచ్ చూడండి') : money(r.lineTotal)}</td></tr>)}</tbody>
    </table></div>
    {!items.length && <p className="p-4 text-gray-600">{pick('No measurement rows in this record.', 'ఈ రికార్డులో కొలతలు లేవు.')}</p>}
    <div className="table-pagination"><span role="status" className="text-sm text-gray-600">{pick('Page', 'పేజీ')} {current + 1} / {pages} · {items.length} {pick('rows', 'వరుసలు')}</span><div className="flex gap-2"><Button en="Previous" te="మునుపటి" disabled={current === 0} onClick={() => setPage(current - 1)} /><Button en="Next" te="తర్వాత" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)} /></div></div>
  </section>;
}
