export function assertBill(dispatch, kind = 'invoice') {
  if (!dispatch) throw new Error('Missing Dispatch record');
  if (kind !== 'transit slip' && !dispatch.summary) throw new Error('Missing financial summary in Dispatch');
  if (kind === 'transit slip' && !dispatch.inventory?.length) throw new Error('Missing inventory');
  if (!['Dispatched', 'Delivered'].includes(dispatch.status)) throw new Error(`Cannot generate ${kind} for an unfinalized Dispatch. Please finalize the dispatch first.`);
}
export function billRows(dispatch, financial = true) {
  return (dispatch.inventory || []).flatMap(group => {
    const rows = group.measurementRows?.length ? group.measurementRows : (group.pieces || []).map(p => ({ ...p, quantity: 1, category: 'Regular' }));
    return rows.map(row => ({ stoneType: group.stoneType, finish: group.finish, lengthFt: row.lengthFt, widthFt: row.widthFt,
      quantity: row.quantity, category: row.category || 'Regular', sqFt: row.sqFt,
      ...(financial ? { ratePerSqFt: group.ratePerSqFt, lineTotal: row.lineTotal } : {}) }));
  });
}
export function subtotals(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = JSON.stringify([r.stoneType, r.finish, r.category, r.ratePerSqFt]);
    if (!groups.has(key)) groups.set(key, { ...r, quantity: 0, sqFt: 0, lineTotal: 0 });
    const g = groups.get(key);
    g.quantity += r.quantity; g.sqFt += r.sqFt; g.lineTotal += r.lineTotal || 0;
  }
  return [...groups.values()].map(g => ({ ...g, sqFt: Math.round(g.sqFt * 100) / 100, lineTotal: Math.round(g.lineTotal * 100) / 100 }));
}
