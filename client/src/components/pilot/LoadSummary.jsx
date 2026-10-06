import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { Card, Label } from './Controls.jsx';
import { subtotals } from '../../utils/billData.js';
import { money } from '../../utils/pilotDraft.js';
export default function LoadSummary({ rows, summary, groups }) {
  const { pick } = useLanguage();
  return <Card className="gap-4">
    <h2 className="text-lg font-bold">{pick('Load summary', 'లోడ్ మొత్తం')}</h2>
    {(groups || subtotals(rows)).map((g, i) => <div key={i} className="border-b border-gray-200 pb-3">
      <div className="flex justify-between gap-3"><strong className="break-words">{g.stoneType} · {g.finish} · {pick(g.category, g.category === 'TOP' ? 'టాప్' : 'సాధారణ')}</strong><strong className="shrink-0">{money(g.lineTotal)}</strong></div>
      <p className="text-sm text-gray-700 mt-1">{g.quantity} {pick('pieces', 'ముక్కలు')} · {g.sqFt.toFixed(2)} {pick('sq ft', 'చ.అ.')} · {money(g.ratePerSqFt)} / {pick('sq ft', 'చ.అ.')}</p>
    </div>)}
    <div className="flex justify-between gap-3"><Label en="Total pieces" te="మొత్తం ముక్కలు" /><strong>{summary.totalPieces ?? rows.reduce((sum, r) => sum + r.quantity, 0)}</strong></div>
    <div className="flex justify-between gap-3"><Label en="Total square feet" te="మొత్తం చదరపు అడుగులు" /><strong>{summary.totalDispatchVolumeSqFt.toFixed(2)}</strong></div>
    <div className="flex justify-between gap-3"><Label en="Material amount" te="మెటీరియల్ మొత్తం" /><strong>{money(summary.baseMaterialTotal)}</strong></div>
    <div className="flex justify-between gap-3"><Label en="Loading / royalty" te="లోడింగ్ / రాయల్టీ" /><strong>{money(summary.loadingAndRoyaltyFees)}</strong></div>
    <div className="border-t-2 border-gray-300 pt-4 flex justify-between gap-3"><Label en="Net payable" te="చెల్లించవలసిన మొత్తం" /><strong className="text-xl text-teal-900">{money(summary.netBillableAmount)}</strong></div>
  </Card>;
}
