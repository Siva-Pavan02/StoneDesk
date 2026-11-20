const { Prisma } = require('@prisma/client');

const Decimal = Prisma.Decimal;
const MONEY_MAX_PAISA = 999_999_999_999;
const maxPaise = new Decimal(MONEY_MAX_PAISA);

function moneyError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toDecimal(value, label = 'amount') {
  const isDecimal = value instanceof Decimal;
  if ((!isDecimal && typeof value !== 'number' && typeof value !== 'string') || value === '' ||
      (typeof value === 'number' && !Number.isFinite(value))) {
    throw moneyError(`Invalid ${label}`);
  }
  let decimal;
  try { decimal = isDecimal ? value : new Decimal(String(value)); } catch { throw moneyError(`Invalid ${label}`); }
  if (!decimal.isFinite()) throw moneyError(`Invalid ${label}`);
  return decimal;
}

function bounded(decimal, label, status = 400) {
  if (decimal.isNegative() || decimal.times(100).greaterThan(maxPaise)) {
    throw moneyError(`${label} exceeds supported range`, status);
  }
  return decimal;
}

function requirePaise(value, label = 'amount', status = 400) {
  const decimal = bounded(toDecimal(value, label), label, status);
  if (!decimal.times(100).isInteger()) throw moneyError(`${label} must have at most two decimal places`, status);
  return decimal;
}

function moneyNumber(value, label = 'amount') {
  const decimal = bounded(toDecimal(value, label).toDecimalPlaces(2, Decimal.ROUND_HALF_UP), label);
  const paise = decimal.times(100).toNumber();
  if (!Number.isSafeInteger(paise)) throw moneyError(`${label} exceeds supported range`);
  return Number(decimal.toFixed(2));
}

function validateInvoiceMoney(summary, inventory) {
  if (summary?.calculationVersion !== 2) return;
  if (!summary || typeof summary !== 'object') throw moneyError('Invoice amount needs review.', 500);
  const fields = ['baseMaterialTotal', 'loadingAndRoyaltyFees', 'netBillableAmount'];
  const values = Object.fromEntries(fields.map(field => {
    if (typeof summary[field] !== 'number') throw moneyError('Invoice amount needs review.', 500);
    return [field, requirePaise(summary[field], field, 500)];
  }));
  if (!values.baseMaterialTotal.plus(values.loadingAndRoyaltyFees).equals(values.netBillableAmount)) {
    throw moneyError('Invoice amount needs review.', 500);
  }
  if (inventory === undefined) return;
  if (!Array.isArray(inventory)) throw moneyError('Invoice amount needs review.', 500);
  let base = new Decimal(0);
  for (const group of inventory) {
    if (typeof group?.lineTotal !== 'number') throw moneyError('Invoice amount needs review.', 500);
    const groupAmount = requirePaise(group.lineTotal, 'line amount', 500);
    const rows = group.measurementRows?.length ? group.measurementRows : group.pieces;
    if (!Array.isArray(rows)) throw moneyError('Invoice amount needs review.', 500);
    let rowTotal = new Decimal(0);
    for (const row of rows) {
      if (typeof row?.lineTotal !== 'number') throw moneyError('Invoice amount needs review.', 500);
      rowTotal = rowTotal.plus(requirePaise(row.lineTotal, 'row amount', 500));
    }
    if (!rowTotal.equals(groupAmount)) throw moneyError('Invoice amount needs review.', 500);
    base = base.plus(groupAmount);
  }
  if (!base.equals(values.baseMaterialTotal)) throw moneyError('Invoice amount needs review.', 500);
}

function invoiceTotalDecimal(summary) {
  if (summary && typeof summary === 'object') {
    validateInvoiceMoney(summary);
    let raw;
    try { raw = toDecimal(summary.netBillableAmount, 'invoice total'); }
    catch { throw moneyError('Invoice amount needs review.', 500); }
    if (raw.isNegative()) throw moneyError('Invoice amount needs review.', 500);
    return raw.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  let raw;
  try { raw = toDecimal(summary, 'invoice total'); }
  catch { throw moneyError('Invoice amount needs review.', 500); }
  if (raw.isNegative()) throw moneyError('Invoice amount needs review.', 500);
  return raw.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

module.exports = { MONEY_MAX_PAISA, toDecimal, requirePaise, moneyNumber, validateInvoiceMoney, invoiceTotalDecimal };
