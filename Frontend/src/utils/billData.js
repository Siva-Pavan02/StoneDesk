import { round2, rawArea, rawAmount } from './loadMath.js';

export function assertBill(dispatch, kind = 'invoice') {
  if (!dispatch) throw new Error('Missing Dispatch record');
  if (kind !== 'transit slip' && !dispatch.summary) throw new Error('Missing financial summary in Dispatch');
  if (kind === 'transit slip' && !dispatch.inventory?.length) throw new Error('Missing inventory');
  if (!['Dispatched', 'Delivered'].includes(dispatch.status)) throw new Error(`Cannot generate ${kind} for an unfinalized Dispatch. Please finalize the dispatch first.`);
}
// Totals sum unrounded areas/amounts (from dimensions) and round once, matching the server summary.
// Regular is derived as total - top so Regular + Top always equals the total shown.
function totalOf(lines) {
  return { quantity: lines.reduce((n, l) => n + l.quantity, 0), sqFt: round2(lines.reduce((n, l) => n + rawArea(l), 0)), amount: round2(lines.reduce((n, l) => n + rawAmount(l), 0)) };
}
function split(lines) {
  const total = totalOf(lines), top = totalOf(lines.filter(l => l.category === 'TOP'));
  return { total, top, regular: { quantity: total.quantity - top.quantity, sqFt: round2(total.sqFt - top.sqFt), amount: round2(total.amount - top.amount) } };
}
export function billRows(dispatch, financial = true) {
  return (dispatch.inventory || []).flatMap((group, groupIndex) => {
    const rows = group.measurementRows?.length ? group.measurementRows : (group.pieces || []).map(p => ({ ...p, quantity: 1, category: 'Regular' }));
    // Records saved before row numbers existed used the old group position as the row.
    return rows.map(row => ({ rowNo: row.rowNo ?? groupIndex + 1, stoneType: group.stoneType, finish: group.finish, lengthFt: row.lengthFt, widthFt: row.widthFt,
      quantity: row.quantity, category: row.category || 'Regular', sqFt: row.sqFt,
      ...(financial ? { ratePerSqFt: group.ratePerSqFt, lineTotal: row.lineTotal } : {}) }));
  });
}
// Groups bill lines by their entered row number. Row numbers are kept as entered (never renumbered);
// inside a row the regular lines come first, then the top lines, each in entry order.
export function rowGroups(rows) {
  const map = new Map();
  for (const line of rows) {
    if (!map.has(line.rowNo)) map.set(line.rowNo, []);
    map.get(line.rowNo).push(line);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([rowNo, lines]) => {
    const regularLines = lines.filter(l => l.category !== 'TOP'), topLines = lines.filter(l => l.category === 'TOP');
    return { rowNo, lines: [...regularLines, ...topLines], regularLines, topLines, ...split(lines) };
  });
}
export function rowOverview(groups) {
  const { total, top, regular } = split(groups.flatMap(g => g.lines));
  return { pieces: total.quantity, regularSqFt: regular.sqFt, topSqFt: top.sqFt, totalSqFt: total.sqFt, topAmount: top.amount, totalAmount: total.amount };
}
export function subtotals(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = JSON.stringify([r.stoneType, r.finish, r.category, r.ratePerSqFt]);
    if (!groups.has(key)) groups.set(key, { ...r, quantity: 0, sqFt: 0, lineTotal: 0 });
    const g = groups.get(key);
    g.quantity += r.quantity; g.sqFt += rawArea(r); g.lineTotal += rawAmount(r);
  }
  return [...groups.values()].map(g => ({ ...g, sqFt: round2(g.sqFt), lineTotal: round2(g.lineTotal) }));
}
