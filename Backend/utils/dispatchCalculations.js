const { Prisma } = require('@prisma/client');
const { toDecimal } = require('./invoiceMoney');

// Half-up rounding to 2 decimals for display-only area and legacy callers.
function round2(val) {
  return Number(toDecimal(val).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2)) || 0;
}
exports.round2 = round2;

function isValidDimension(val) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 && String(val).trim() !== '';
}

exports.calculatePiece = function(lengthFt, widthFt) {
  if (!isValidDimension(lengthFt) || !isValidDimension(widthFt)) {
    throw new Error('Invalid dimensions');
  }
  const l = Number(lengthFt);
  const w = Number(widthFt);
  return {
    lengthFt: l,
    widthFt: w,
    sqFt: round2(l * w)
  };
}

// Version 2 has one paise-level net rule; the historical stored total remains authoritative.
function netTotal(value) {
  return round2(value);
}
exports.netTotal = netTotal;
