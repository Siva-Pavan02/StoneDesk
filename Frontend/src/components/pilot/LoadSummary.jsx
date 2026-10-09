import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { Card, Label } from './Controls.jsx';
import { rowGroups, rowOverview, subtotals } from '../../utils/billData.js';
import { money } from '../../utils/pilotDraft.js';
import { fixed2, rawAmount, round2 } from '../../utils/loadMath.js';
export default function LoadSummary({ rows, summary, groups, showGroups = true, variant = 'load' }) {
  const { pick } = useLanguage();
  const topAmount = round2(rows.filter(r => r.category === 'TOP').reduce((sum, r) => sum + rawAmount(r), 0));
  if (variant === 'invoice') {
    const groups = rowGroups(rows), overview = rowOverview(groups);
    return <section className="invoice-totals" aria-label={pick('Invoice totals', 'బిల్లు మొత్తాలు')}>
      <div className="invoice-order-summary">
        <h3>{pick('Order summary', 'ఆర్డర్ సారాంశం')}</h3>
        <div className="table-scroll" tabIndex={0} role="region" aria-label={pick('Order summary', 'ఆర్డర్ సారాంశం')}><table className="invoice-summary-table">
          <thead><tr><th scope="col">{pick('Row', 'వరుస')}</th><th scope="col" className="numeric">{pick('Pieces', 'ముక్కలు')}</th><th scope="col" className="numeric">{pick('Regular sq ft', 'సాధారణ చ.అ.')}</th><th scope="col" className="numeric">{pick('Top sq ft', 'టాప్ చ.అ.')}</th><th scope="col" className="numeric">{pick('Total sq ft', 'మొత్తం చ.అ.')}</th></tr></thead>
          <tbody>{groups.map(g => <tr key={g.rowNo}><th scope="row">{pick('Row', 'వరుస')} {g.rowNo}</th><td className="numeric">{g.total.quantity}</td><td className="numeric">{fixed2(g.regular.sqFt)}</td><td className="numeric">{fixed2(g.top.sqFt)}</td><td className="numeric">{fixed2(g.total.sqFt)}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row">{pick('Grand total', 'మొత్తం')}</th><td className="numeric">{overview.pieces}</td><td className="numeric">{fixed2(overview.regularSqFt)}</td><td className="numeric">{fixed2(overview.topSqFt)}</td><td className="numeric">{fixed2(overview.totalSqFt)}</td></tr></tfoot>
        </table></div>
      </div>
      <div className="invoice-payment-summary">
        <h3>{pick('Payment summary', 'చెల్లింపు సారాంశం')}</h3>
        <dl className="invoice-amounts"><div><dt>{pick('Material amount', 'మెటీరియల్ మొత్తం')}</dt><dd>{money(round2(summary.baseMaterialTotal - topAmount))}</dd></div><div><dt>{pick('Top material amount', 'టాప్ మెటీరియల్ మొత్తం')}</dt><dd>{money(topAmount)}</dd></div><div><dt>{pick('Loading / royalty', 'లోడింగ్ / రాయల్టీ')}</dt><dd>{money(summary.loadingAndRoyaltyFees)}</dd></div><div className="invoice-net-payable"><dt>{pick('Net payable', 'చెల్లించవలసిన మొత్తం')}</dt><dd>{money(summary.netBillableAmount)}</dd></div></dl>
      </div>
    </section>;
  }
  return <Card className="load-summary gap-4">
    <h2 className="text-lg font-bold">{pick('Load summary', 'లోడ్ మొత్తం')}</h2>
    {showGroups && (groups || subtotals(rows)).map((g, i) => <div key={i} className="border-b border-gray-200 pb-3">
      <div className="flex justify-between gap-3"><strong className="break-words">{g.stoneType} · {g.finish}{g.category === 'TOP' ? ` · ${pick('Top', 'టాప్')}` : ''}</strong><strong className="shrink-0">{money(g.lineTotal)}</strong></div>
      <p className="text-sm text-gray-700 mt-1">{g.quantity} {pick('pieces', 'ముక్కలు')} · {fixed2(g.sqFt)} {pick('sq ft', 'చ.అ.')} · {money(g.ratePerSqFt)} / {pick('sq ft', 'చ.అ.')}</p>
    </div>)}
    <div className="flex justify-between gap-3"><Label en="Total pieces" te="మొత్తం ముక్కలు" /><strong>{summary.totalPieces ?? rows.reduce((sum, r) => sum + r.quantity, 0)}</strong></div>
    <div className="flex justify-between gap-3"><Label en="Total square feet" te="మొత్తం చదరపు అడుగులు" /><strong>{fixed2(summary.totalDispatchVolumeSqFt)}</strong></div>
    <div className="flex justify-between gap-3"><Label en="Material amount" te="మెటీరియల్ మొత్తం" /><strong>{money(summary.baseMaterialTotal)}</strong></div>
    <div className="flex justify-between gap-3"><Label en="Loading / royalty" te="లోడింగ్ / రాయల్టీ" /><strong>{money(summary.loadingAndRoyaltyFees)}</strong></div>
    <div className="load-summary-total flex justify-between gap-3"><Label en="Net payable" te="చెల్లించవలసిన మొత్తం" /><strong className="text-xl text-teal-900">{money(summary.netBillableAmount)}</strong></div>
  </Card>;
}
