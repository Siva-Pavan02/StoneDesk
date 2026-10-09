/**
 * dispatchCalculations.js
 *
 * Rounding strategy: shared half-up round2 from loadMath.js.
 */
import { round2 } from './loadMath.js';

function isValidDimension(val) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 && String(val).trim() !== '';
}

export function calculatePiece(lengthFt, widthFt) {
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

export function calculateGroupSqFt(pieces) {
  return round2(pieces.reduce((sum, p) => sum + (p.sqFt || 0), 0));
}

export function calculateLineTotal(totalSqFt, ratePerSqFt) {
  const r = Number(ratePerSqFt);
  if (!Number.isFinite(r) || r < 0) {
    throw new Error('Invalid rate');
  }
  return round2(Number(totalSqFt) * r);
}

export function calculateDispatchTotals(stoneGroups, loadingAndRoyaltyFees = 0) {
  const fees = Number(loadingAndRoyaltyFees) || 0;
  let totalDispatchVolumeSqFt = 0;
  let baseMaterialTotal = 0;

  for (const group of stoneGroups) {
    totalDispatchVolumeSqFt += Number(group.totalSqFt || 0);
    baseMaterialTotal += calculateLineTotal(group.totalSqFt || 0, group.ratePerSqFt || 0);
  }

  return {
    totalDispatchVolumeSqFt: round2(totalDispatchVolumeSqFt),
    baseMaterialTotal: round2(baseMaterialTotal),
    loadingAndRoyaltyFees: round2(fees),
    netBillableAmount: round2(baseMaterialTotal + fees)
  };
}
