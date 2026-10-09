const { calculatePiece, round2 } = require('./dispatchCalculations');

function bad(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}
function round(value) {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100) bad('Calculation exceeds supported range');
  return round2(value);
}
// Rounding policy: areas and amounts are summed unrounded and rounded once at the end.
// Row values are rounded for display only and are never added up.
const rawArea = row => row.lengthFt * row.widthFt * (row.quantity ?? 1);
function rawTotals(group) {
  const rows = group.measurementRows.length ? group.measurementRows : group.pieces;
  return rows.reduce((sum, row) => {
    const area = rawArea(row);
    return { sqFt: sum.sqFt + area, amount: sum.amount + area * group.ratePerSqFt };
  }, { sqFt: 0, amount: 0 });
}
function number(value, label, positive = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive ? value <= 0 : value < 0)) bad(`Invalid ${label}`);
  return value;
}
function text(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) bad(`Invalid ${label}`);
  return value.trim();
}
function processInventory(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 200) bad('Empty or oversized inventory');
  return raw.map((group, groupIndex) => {
    if (!group || typeof group !== 'object') bad('Invalid inventory group');
    const stoneType = text(group.stoneType, 'product');
    const finish = text(group.finish, 'finish');
    const ratePerSqFt = number(group.ratePerSqFt, 'rate');
    let pieces = [];
    let measurementRows = [];
    if (Array.isArray(group.measurementRows) && group.measurementRows.length) {
      if (group.measurementRows.length > 1000) bad('Too many measurement rows');
      measurementRows = group.measurementRows.map(row => {
        if (!row || typeof row !== 'object') bad('Invalid measurement row');
        const lengthFt = number(row.lengthFt, 'length', true);
        const widthFt = number(row.widthFt, 'width', true);
        if (!Number.isSafeInteger(row.quantity) || row.quantity < 1 || row.quantity > 100000) bad('Quantity must be a whole number from 1 to 100000');
        const category = row.category || 'Regular';
        if (!['Regular', 'TOP'].includes(category)) bad('Invalid row category');
        // Records saved before row numbers existed used the product group position as the row.
        const rowNo = row.rowNo ?? groupIndex + 1;
        if (!Number.isSafeInteger(rowNo) || rowNo < 1 || rowNo > 15) bad('Row number must be a whole number from 1 to 15');
        const area = lengthFt * widthFt * row.quantity;
        return { rowNo, lengthFt, widthFt, quantity: row.quantity, category,
          lengthDisplay: String(lengthFt), widthDisplay: String(widthFt),
          sqFt: round(area), lineTotal: round(area * ratePerSqFt) };
      });
    } else {
      if (!Array.isArray(group.pieces) || !group.pieces.length || group.pieces.length > 10000) bad('Empty or oversized pieces');
      pieces = group.pieces.map(p => {
        if (!p || typeof p !== 'object') bad('Invalid piece');
        const lengthFt = number(p.lengthFt, 'length', true);
        const widthFt = number(p.widthFt, 'width', true);
        return { ...calculatePiece(lengthFt, widthFt), lengthDisplay: String(lengthFt), widthDisplay: String(widthFt) };
      });
    }
    const raw = rawTotals({ ratePerSqFt, pieces, measurementRows });
    return { stoneType, finish, ratePerSqFt, pieces, measurementRows, totalSqFt: round(raw.sqFt), lineTotal: round(raw.amount) };
  });
}
function totals(inventory, fee) {
  number(fee, 'loading/royalty charges');
  const totalPieces = inventory.reduce((sum, g) => sum + (g.measurementRows.length ? g.measurementRows.reduce((n, r) => n + r.quantity, 0) : g.pieces.length), 0);
  const raw = inventory.map(rawTotals);
  const totalDispatchVolumeSqFt = round(raw.reduce((sum, g) => sum + g.sqFt, 0));
  const baseMaterialTotal = round(raw.reduce((sum, g) => sum + g.amount, 0));
  return { totalPieces, totalDispatchVolumeSqFt, baseMaterialTotal, loadingAndRoyaltyFees: round(fee), netBillableAmount: round(baseMaterialTotal + round(fee)) };
}
module.exports = { bad, number, text, processInventory, totals };
