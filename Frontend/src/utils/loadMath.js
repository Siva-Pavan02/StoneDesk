// Shared load arithmetic. Must stay identical to Backend/utils/pilotCalculations.js.
// Rounding policy: areas and amounts are summed unrounded and rounded once at the end;
// per-row values are rounded for display only.

// Half-up to 2 decimals. toPrecision(15) removes binary noise first (1.005 -> 1.01).
export function round2(value) {
  const cents = Math.round(Number((Math.abs(value) * 100).toPrecision(15)));
  return (value < 0 ? -cents : cents) / 100 || 0;
}
export const fixed2 = value => round2(Number(value) || 0).toFixed(2);
export const rawArea = row => row.lengthFt * row.widthFt * (row.quantity ?? 1);
export const rawAmount = row => rawArea(row) * (row.ratePerSqFt || 0);

// Returns the same summary the server computes for these rows.
export function summarize(rows, fee) {
  let sqFt = 0, amount = 0, totalPieces = 0;
  for (const row of rows) { sqFt += rawArea(row); amount += rawAmount(row); totalPieces += row.quantity ?? 1; }
  const baseMaterialTotal = round2(amount), loadingAndRoyaltyFees = round2(Number(fee) || 0);
  return { totalPieces, totalDispatchVolumeSqFt: round2(sqFt), baseMaterialTotal, loadingAndRoyaltyFees, netBillableAmount: round2(baseMaterialTotal + loadingAndRoyaltyFees) };
}
