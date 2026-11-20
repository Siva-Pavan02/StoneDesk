const { validateRateUnit } = require('./productRates');
const { calculatePiece, round2 } = require('./dispatchCalculations');
const { toDecimal, requirePaise, moneyNumber, validateInvoiceMoney } = require('./invoiceMoney');

function bad(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}
function areaNumber(value) {
  const decimal = toDecimal(value, 'area');
  if (decimal.abs().greaterThan(Number.MAX_SAFE_INTEGER / 100)) bad('Calculation exceeds supported range');
  return round2(decimal.toNumber());
}
const decimalArea = row => toDecimal(row.lengthFt, 'length').times(toDecimal(row.widthFt, 'width')).times(row.quantity ?? 1);
function sumRows(group, key) {
  const rows = group.measurementRows.length ? group.measurementRows : group.pieces;
  return rows.reduce((sum, row) => sum.plus(key === 'area' ? row.rateUnit === 'UNIT' || group.rateUnit === 'UNIT' ? 0 : row.billableAreaSqFt : row.lineTotal), toDecimal(0));
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
    const declaredUnits = (Array.isArray(group.measurementRows) ? group.measurementRows : []).map(row => validateRateUnit(row?.rateUnit === undefined ? group.rateUnit : row.rateUnit));
    const groupRateUnit = group.rateUnit === undefined && declaredUnits.length && declaredUnits.every(unit => unit === 'UNIT') ? 'UNIT' : validateRateUnit(group.rateUnit);
    if (declaredUnits.some(unit => unit !== groupRateUnit)) bad('Mixed rate units in one product group');
    const finish = groupRateUnit === 'UNIT' && (group.finish === undefined || group.finish === '') ? '' : text(group.finish, 'finish');
    const ratePerSqFt = number(group.ratePerSqFt, 'rate');
    let pieces = [];
    let measurementRows = [];
    if (Array.isArray(group.measurementRows) && group.measurementRows.length) {
      if (group.measurementRows.length > 1000) bad('Too many measurement rows');
      measurementRows = group.measurementRows.map(row => {
        if (!row || typeof row !== 'object') bad('Invalid measurement row');
        const isUnit = row.rateUnit === 'UNIT' || groupRateUnit === 'UNIT';
        const lengthFt = isUnit ? (row.lengthFt !== undefined ? number(row.lengthFt, 'length', true) : undefined) : number(row.lengthFt, 'length', true);
        const widthFt = isUnit ? (row.widthFt !== undefined ? number(row.widthFt, 'width', true) : undefined) : number(row.widthFt, 'width', true);
        if (!Number.isSafeInteger(row.quantity) || row.quantity < 1 || row.quantity > 100000) bad('Quantity must be a whole number from 1 to 100000');
        const category = row.category || 'Regular';
        if (!['Regular', 'TOP'].includes(category)) bad('Invalid row category');
        // Records saved before row numbers existed used the product group position as the row.
        const rowNo = row.rowNo ?? groupIndex + 1;
        if (!Number.isSafeInteger(rowNo) || rowNo < 1 || rowNo > 20) bad('Row number must be a whole number from 1 to 20');
        if (isUnit) {
          const lineTotal = moneyNumber(toDecimal(row.quantity).times(ratePerSqFt), 'row amount');
          return { rowNo, quantity: row.quantity, category, rateUnit: 'UNIT', sqFt: 0, lineTotal };
        }
        const area = toDecimal(lengthFt).times(widthFt).times(row.quantity);
        return { rowNo, lengthFt, widthFt, quantity: row.quantity, category,
          lengthDisplay: String(lengthFt), widthDisplay: String(widthFt),
          billableAreaSqFt: area.toString(), sqFt: areaNumber(area), lineTotal: moneyNumber(area.times(ratePerSqFt), 'row amount') };
      });
    } else {
      if (groupRateUnit === 'UNIT') bad('Unit products require quantity rows');
      if (!Array.isArray(group.pieces) || !group.pieces.length || group.pieces.length > 10000) bad('Empty or oversized pieces');
      pieces = group.pieces.map(p => {
        if (!p || typeof p !== 'object') bad('Invalid piece');
        const lengthFt = number(p.lengthFt, 'length', true);
        const widthFt = number(p.widthFt, 'width', true);
        const area = toDecimal(lengthFt).times(widthFt);
        return { ...calculatePiece(lengthFt, widthFt), lengthDisplay: String(lengthFt), widthDisplay: String(widthFt),
          billableAreaSqFt: area.toString(), lineTotal: moneyNumber(area.times(ratePerSqFt), 'piece amount') };
      });
    }
    const normalized = { ratePerSqFt, pieces, measurementRows, rateUnit: groupRateUnit };
    const result = { stoneType, finish, ratePerSqFt, pieces, measurementRows,
      totalSqFt: areaNumber(sumRows(normalized, 'area')),
      lineTotal: moneyNumber(sumRows(normalized, 'lineTotal'), 'group amount') };
    if (groupRateUnit === 'UNIT') result.rateUnit = 'UNIT';
    return result;
  });
}
function totals(inventory, fee) {
  number(fee, 'loading/royalty charges');
  const feeDecimal = requirePaise(fee, 'loading/royalty charges');
  const totalPieces = inventory.reduce((sum, g) => sum + (g.measurementRows.length ? g.measurementRows.reduce((n, r) => n + r.quantity, 0) : g.pieces.length), 0);
  const totalDispatchVolumeSqFt = areaNumber(inventory.reduce((sum, group) => sum.plus(sumRows(group, 'area')), toDecimal(0)));
  const base = inventory.reduce((sum, group) => sum.plus(group.lineTotal), toDecimal(0));
  const summary = { totalPieces, totalDispatchVolumeSqFt,
    baseMaterialTotal: moneyNumber(base, 'material total'),
    loadingAndRoyaltyFees: moneyNumber(feeDecimal, 'loading/royalty charges'),
    netBillableAmount: moneyNumber(base.plus(feeDecimal), 'invoice total'),
    calculationVersion: 2 };
  validateInvoiceMoney(summary, inventory);
  return summary;
}
module.exports = { bad, number, text, processInventory, totals };
