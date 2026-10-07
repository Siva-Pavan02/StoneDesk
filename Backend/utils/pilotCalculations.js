const { calculatePiece, calculateLineTotal } = require('./dispatchCalculations');

function bad(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}
function round(value) {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100) bad('Calculation exceeds supported range');
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
  return raw.map(group => {
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
        const sqFt = round(lengthFt * widthFt * row.quantity);
        return { lengthFt, widthFt, quantity: row.quantity, category,
          lengthDisplay: String(lengthFt), widthDisplay: String(widthFt),
          sqFt, lineTotal: round(sqFt * ratePerSqFt) };
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
    const totalSqFt = round((measurementRows.length ? measurementRows : pieces).reduce((sum, row) => sum + row.sqFt, 0));
    const lineTotal = measurementRows.length
      ? round(measurementRows.reduce((sum, row) => sum + row.lineTotal, 0))
      : round(calculateLineTotal(totalSqFt, ratePerSqFt));
    return { stoneType, finish, ratePerSqFt, pieces, measurementRows, totalSqFt, lineTotal };
  });
}
function totals(inventory, fee) {
  number(fee, 'loading/royalty charges');
  const totalPieces = inventory.reduce((sum, g) => sum + (g.measurementRows.length ? g.measurementRows.reduce((n, r) => n + r.quantity, 0) : g.pieces.length), 0);
  const totalDispatchVolumeSqFt = round(inventory.reduce((sum, g) => sum + g.totalSqFt, 0));
  const baseMaterialTotal = round(inventory.reduce((sum, g) => sum + g.lineTotal, 0));
  return { totalPieces, totalDispatchVolumeSqFt, baseMaterialTotal, loadingAndRoyaltyFees: round(fee), netBillableAmount: round(baseMaterialTotal + round(fee)) };
}
module.exports = { bad, number, text, processInventory, totals };
