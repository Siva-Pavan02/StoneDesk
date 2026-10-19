// Display-only summary of saved inventory; never recomputes bill amounts.
export function productSummary(dispatch) {
  const products = new Map();
  for (const group of dispatch?.inventory || []) {
    const stoneType = group.stoneType || 'Stone';
    const finish = group.finish || '';
    const ratePerSqFt = group.ratePerSqFt == null ? null : Number(group.ratePerSqFt);
    const quantity = group.measurementRows?.length
      ? group.measurementRows.reduce((sum, row) => sum + row.quantity, 0)
      : (group.pieces || []).length;
    const key = JSON.stringify([stoneType, finish, ratePerSqFt]);
    if (products.has(key)) products.get(key).quantity += quantity;
    else products.set(key, { stoneType, finish, quantity, ratePerSqFt });
  }
  return [...products.values()];
}
