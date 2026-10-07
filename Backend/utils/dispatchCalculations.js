function round2(val) {
  return Math.round(val * 100) / 100;
}

function isValidDimension(val) {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 && String(val).trim() !== '';
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

exports.calculateGroupSqFt = function(pieces) {
  return round2(pieces.reduce((sum, p) => sum + (p.sqFt || 0), 0));
}

exports.calculateLineTotal = function(totalSqFt, ratePerSqFt) {
  const r = Number(ratePerSqFt);
  if (!Number.isFinite(r) || r < 0) {
    throw new Error('Invalid rate');
  }
  return round2(Number(totalSqFt) * r);
}

exports.calculateDispatchTotals = function(stoneGroups, loadingAndRoyaltyFees = 0) {
  const fees = Number(loadingAndRoyaltyFees) || 0;
  let totalDispatchVolumeSqFt = 0;
  let baseMaterialTotal = 0;

  for (const group of stoneGroups) {
    totalDispatchVolumeSqFt += Number(group.totalSqFt || 0);
    baseMaterialTotal += exports.calculateLineTotal(group.totalSqFt || 0, group.ratePerSqFt || 0);
  }

  return {
    totalDispatchVolumeSqFt: round2(totalDispatchVolumeSqFt),
    baseMaterialTotal: round2(baseMaterialTotal),
    loadingAndRoyaltyFees: round2(fees),
    netBillableAmount: round2(baseMaterialTotal + fees)
  };
}
