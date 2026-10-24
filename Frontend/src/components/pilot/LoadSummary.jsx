import React from 'react';
import { Card, Label } from './Controls.jsx';
import { rowGroups, rowOverview, subtotals } from '../../utils/billData.js';
import { productRateSuffix } from '../../utils/productForm.js';
import { money } from '../../utils/pilotDraft.js';
import { fixed2, rawAmount, round2 } from '../../utils/loadMath.js';
export default function LoadSummary({ rows, summary, groups, showGroups = true, variant = 'load' }) {
  const topAmount = round2(rows.filter(r => r.category === 'TOP').reduce((sum, r) => sum + rawAmount(r), 0));
  if (variant === 'invoice') {
    const groups = rowGroups(rows), overview = rowOverview(groups);
    return <section className="invoice-totals" aria-label="Invoice totals">
      <div className="invoice-order-summary">
        <h3>Order summary</h3>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Order summary"><table className="invoice-summary-table">
          <thead><tr><th scope="col">#</th><th scope="col" className="numeric">Pieces</th><th scope="col" className="numeric">Regular sq ft</th><th scope="col" className="numeric">Top sq ft</th><th scope="col" className="numeric">Total sq ft</th></tr></thead>
          <tbody>{groups.map(g => <tr key={g.rowNo}><th scope="row">{g.rowNo}</th><td className="numeric">{g.total.quantity}</td><td className="numeric">{fixed2(g.regular.sqFt)}</td><td className="numeric">{fixed2(g.top.sqFt)}</td><td className="numeric">{fixed2(g.total.sqFt)}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row">Grand total</th><td className="numeric">{overview.pieces}</td><td className="numeric">{fixed2(overview.regularSqFt)}</td><td className="numeric">{fixed2(overview.topSqFt)}</td><td className="numeric">{fixed2(overview.totalSqFt)}</td></tr></tfoot>
        </table></div>
      </div>
      <div className="invoice-payment-summary">
        <h3>Payment summary</h3>
        <dl className="invoice-amounts"><div><dt>Material amount</dt><dd>{money(round2(summary.baseMaterialTotal - topAmount))}</dd></div><div><dt>Top material amount</dt><dd>{money(topAmount)}</dd></div><div><dt>Loading / royalty</dt><dd>{money(summary.loadingAndRoyaltyFees)}</dd></div><div className="invoice-net-payable"><dt>Net payable</dt><dd>{money(summary.netBillableAmount)}</dd></div></dl>
      </div>
    </section>;
  }
  return <Card className="load-summary gap-4">
    <h2 className="text-lg font-bold">Load summary</h2>
    {showGroups && (groups || subtotals(rows)).map((g, i) => <div key={i} className="border-b border-outline-variant pb-3">
      <div className="flex justify-between gap-3"><strong className="break-words">{g.stoneType}{g.finish ? ` · ${g.finish}` : ''}{g.category === 'TOP' ? ` · Top` : ''}</strong><strong className="shrink-0">{money(g.lineTotal)}</strong></div>
      <p className="text-sm text-on-surface mt-1">{g.quantity} {g.rateUnit === 'UNIT' ? 'units' : 'pieces'}{g.rateUnit === 'UNIT' ? '' : ` · ${fixed2(g.sqFt)} sq ft`} · {money(g.ratePerSqFt)} {productRateSuffix(g)}</p>
    </div>)}
    <div className="flex justify-between gap-3"><Label label="Total pieces" /><strong>{summary.totalPieces ?? rows.reduce((sum, r) => sum + r.quantity, 0)}</strong></div>
    <div className="flex justify-between gap-3"><Label label="Total square feet" /><strong>{fixed2(summary.totalDispatchVolumeSqFt)}</strong></div>
    <div className="flex justify-between gap-3"><Label label="Material amount" /><strong>{money(summary.baseMaterialTotal)}</strong></div>
    <div className="flex justify-between gap-3"><Label label="Loading / royalty" /><strong>{money(summary.loadingAndRoyaltyFees)}</strong></div>
    <div className="load-summary-total flex justify-between gap-3"><Label label="Net payable" /><strong className="text-xl text-primary">{money(summary.netBillableAmount)}</strong></div>
  </Card>;
}
