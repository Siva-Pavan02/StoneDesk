// Half-up rounding to 2 decimals. toPrecision(15) removes binary noise first, so
// 1.005 rounds to 1.01 and the result does not depend on summation order.
function round2(val) {
  const cents = Math.round(Number((Math.abs(val) * 100).toPrecision(15)));
  return (val < 0 ? -cents : cents) / 100 || 0;
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
