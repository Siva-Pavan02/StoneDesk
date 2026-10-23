// Display-only summary of saved inventory; never recomputes bill amounts.
export function productSummary(dispatch) {
  const products = new Map();
  for (const group of dispatch?.inventory || []) {
    const stoneType = group.stoneType || 'Stone';
    const finish = group.finish || '';
    const ratePerSqFt = group.ratePerSqFt == null ? null : Number(group.ratePerSqFt);
    const rows = group.measurementRows?.length ? group.measurementRows : (group.pieces || []).map(() => ({ quantity: 1 }));
    for (const row of rows) {
      const isUnit = (row.rateUnit || group.rateUnit) === 'UNIT';
      const key = JSON.stringify([stoneType, finish, ratePerSqFt, isUnit ? 'UNIT' : '']);
      if (products.has(key)) products.get(key).quantity += row.quantity;
      else {
        const item = { stoneType, finish, quantity: row.quantity, ratePerSqFt };
        if (isUnit) item.rateUnit = 'UNIT';
        products.set(key, item);
      }
    }
  }
  return [...products.values()];
}
