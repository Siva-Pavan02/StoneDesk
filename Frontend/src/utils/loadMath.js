import Decimal from 'decimal.js';

// Preview math mirrors Backend/utils/pilotCalculations.js. Money is rounded per row.
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const MONEY_MAX_PAISA = new D('999999999999');
const decimal = value => new D(String(value));
const money = value => {
  const rounded = decimal(value).toDecimalPlaces(2, D.ROUND_HALF_UP);
  if (!rounded.isFinite() || rounded.isNegative() || rounded.times(100).greaterThan(MONEY_MAX_PAISA)) {
    throw new Error('Calculation exceeds supported range');
  }
  return Number(rounded.toFixed(2));
};

export function round2(value) {
  return Number(decimal(value).toDecimalPlaces(2, D.ROUND_HALF_UP).toFixed(2)) || 0;
}
export const fixed2 = value => round2(Number(value) || 0).toFixed(2);
export const exactArea = row => row.rateUnit === 'UNIT' ? new D(0) : decimal(row.lengthFt).times(row.widthFt).times(row.quantity ?? 1);
export const rawArea = row => exactArea(row).toNumber();
export const exactAmount = row => row.rateUnit === 'UNIT'
  ? decimal(row.quantity ?? 1).times(row.rate ?? row.ratePerSqFt ?? 0)
  : exactArea(row).times(row.rate ?? row.ratePerSqFt ?? 0);
export const rawAmount = row => exactAmount(row).toNumber();
export const rowAmount = row => money(exactAmount(row));

export function summarize(rows, fee) {
  // The draft fee is edited as text. Keep the preview usable while it is blank
  // or incomplete; payload() performs the strict paise validation on save.
  let feeDecimal;
  try { feeDecimal = decimal(fee === '' ? 0 : fee); } catch { feeDecimal = new D(0); }
  if (!feeDecimal.isFinite() || feeDecimal.isNegative()) feeDecimal = new D(0);
  const area = rows.reduce((sum, row) => sum.plus(exactArea(row)), new D(0));
  const base = rows.reduce((sum, row) => sum.plus(rowAmount(row)), new D(0));
  const baseMaterialTotal = money(base);
  const loadingAndRoyaltyFees = money(feeDecimal);
  return {
    totalPieces: rows.reduce((sum, row) => sum + (row.quantity ?? 1), 0),
    totalDispatchVolumeSqFt: round2(area),
    baseMaterialTotal,
    loadingAndRoyaltyFees,
    netBillableAmount: money(base.plus(feeDecimal)),
    calculationVersion: 2,
  };
}

export function netTotal(value) { return money(value); }
