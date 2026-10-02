import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  calculatePiece, 
  calculateGroupSqFt, 
  calculateLineTotal, 
  calculateDispatchTotals 
} from './dispatchCalculations.js';

test('calculatePiece: whole-number dimensions', () => {
  assert.deepEqual(calculatePiece(10, 5), { lengthFt: 10, widthFt: 5, sqFt: 50 });
});

test('calculatePiece: quarter fraction', () => {
  assert.deepEqual(calculatePiece(10.25, 5), { lengthFt: 10.25, widthFt: 5, sqFt: 51.25 });
});

test('calculatePiece: half fraction', () => {
  assert.deepEqual(calculatePiece(10.5, 5), { lengthFt: 10.5, widthFt: 5, sqFt: 52.5 });
});

test('calculatePiece: three-quarter fraction', () => {
  assert.deepEqual(calculatePiece(10.75, 5), { lengthFt: 10.75, widthFt: 5, sqFt: 53.75 });
});

test('calculatePiece: invalid negative dimension', () => {
  assert.throws(() => calculatePiece(-10, 5), /Invalid dimensions/);
});

test('calculatePiece: invalid non-numeric dimension', () => {
  assert.throws(() => calculatePiece('abc', 5), /Invalid dimensions/);
});

test('calculateGroupSqFt: multiple pieces', () => {
  const pieces = [
    { sqFt: 50 },
    { sqFt: 51.25 },
    { sqFt: 52.5 }
  ];
  assert.equal(calculateGroupSqFt(pieces), 153.75);
});

test('calculateLineTotal: line total with precision rounding', () => {
  // 153.75 * 35 = 5381.25
  assert.equal(calculateLineTotal(153.75, 35), 5381.25);
  // floating point artifact test: 1.1 * 1.1 = 1.2100000000000002 -> 1.21
  assert.equal(calculateLineTotal(1.1, 1.1), 1.21);
});

test('calculateLineTotal: invalid negative rate', () => {
  assert.throws(() => calculateLineTotal(100, -5), /Invalid rate/);
});

test('calculateDispatchTotals: multiple stone groups and fees', () => {
  const groups = [
    { totalSqFt: 100, ratePerSqFt: 35 },
    { totalSqFt: 50, ratePerSqFt: 40 }
  ];
  const result = calculateDispatchTotals(groups, 500);
  assert.equal(result.totalDispatchVolumeSqFt, 150);
  // 100*35=3500, 50*40=2000 => baseMaterial = 5500
  assert.equal(result.baseMaterialTotal, 5500);
  assert.equal(result.loadingAndRoyaltyFees, 500);
  assert.equal(result.netBillableAmount, 6000);
});

test('floating-point precision/rounding', () => {
  assert.equal(calculateLineTotal(10.123, 2), 20.25); 
});
