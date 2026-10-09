const test = require('node:test');
const assert = require('node:assert/strict');
const { processInventory, totals } = require('../utils/pilotCalculations');
const { round2, calculatePiece } = require('../utils/dispatchCalculations');

const row = (lengthFt, widthFt, quantity, category = 'Regular') => ({ lengthFt, widthFt, quantity, category });
const group = (ratePerSqFt, measurementRows, stoneType = 'Granite') => ({ stoneType, finish: 'Polished', ratePerSqFt, measurementRows });

test('round2 rounds half-up at two decimals, including binary edge cases', () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(1234.005), 1234.01);
  assert.equal(round2(0.0625 * 0.08), 0.01);
  assert.equal(round2(2.675), 2.68);
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(-1.005), -1.01);
  assert.ok(Object.is(round2(-0.001), 0));
});

test('F1: single row 3 x 2 x 12 at 40.5', () => {
  const [g] = processInventory([group(40.5, [row(3, 2, 12)])]);
  assert.equal(g.measurementRows[0].sqFt, 72);
  assert.equal(g.measurementRows[0].lineTotal, 2916);
});

test('F3/F5: two rows with fee, TOP and Regular add up to the base', () => {
  const inventory = processInventory([group(40.5, [row(3, 2, 12, 'TOP')]), group(60, [row(4.5, 2.25, 4)], 'Black')]);
  assert.equal(inventory[1].measurementRows[0].sqFt, 40.5);
  assert.equal(inventory[1].lineTotal, 2430);
  assert.deepEqual(totals(inventory, 2500), { totalPieces: 16, totalDispatchVolumeSqFt: 112.5, baseMaterialTotal: 5346, loadingAndRoyaltyFees: 2500, netBillableAmount: 7846 });
});

test('F4: totals sum raw values and round once', () => {
  const inventory = processInventory([group(10, [row(1.333, 1, 1), row(1.333, 1, 1), row(1.333, 1, 1)])]);
  assert.equal(inventory[0].measurementRows[0].sqFt, 1.33);
  assert.equal(inventory[0].measurementRows[0].lineTotal, 13.33);
  assert.equal(inventory[0].totalSqFt, 4);
  assert.equal(inventory[0].lineTotal, 39.99);
  const summary = totals(inventory, 0);
  assert.equal(summary.totalDispatchVolumeSqFt, 4);
  assert.equal(summary.baseMaterialTotal, 39.99);
  assert.equal(summary.netBillableAmount, 39.99);
});

test('row amount uses the unrounded area', () => {
  // 1.115 x 1 = 1.115 sq ft (shown 1.12); 1.115 x 3 = 3.345 -> 3.35, not 1.12 x 3 = 3.36
  const [g] = processInventory([group(3, [row(1.115, 1, 1)])]);
  assert.equal(g.measurementRows[0].sqFt, 1.12);
  assert.equal(g.measurementRows[0].lineTotal, 3.35);
});

test('legacy pieces: group totals use raw piece areas', () => {
  const [g] = processInventory([{ stoneType: 'Stone', finish: 'Slab', ratePerSqFt: 10, pieces: [{ lengthFt: 1.333, widthFt: 1 }, { lengthFt: 1.333, widthFt: 1 }, { lengthFt: 1.333, widthFt: 1 }] }]);
  assert.equal(g.pieces[0].sqFt, 1.33);
  assert.equal(g.totalSqFt, 4);
  assert.equal(g.lineTotal, 39.99);
  assert.equal(totals([g], 0).totalPieces, 3);
});

test('calculatePiece rejects zero dimensions', () => {
  assert.throws(() => calculatePiece(0, 2));
  assert.throws(() => calculatePiece(2, 0));
  assert.deepEqual(calculatePiece(1.115, 1), { lengthFt: 1.115, widthFt: 1, sqFt: 1.12 });
});

test('property: totals equal round-once sums and net = base + fee', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const quarter = () => Math.ceil(rand() * 40) / 4;
  for (let i = 0; i < 1000; i++) {
    const groups = Array.from({ length: 1 + Math.floor(rand() * 4) }, (_, g) => group(Math.round(rand() * 10000) / 100,
      Array.from({ length: 1 + Math.floor(rand() * 6) }, () => row(quarter(), quarter(), 1 + Math.floor(rand() * 50), rand() < 0.3 ? 'TOP' : 'Regular')), `S${g}`));
    const fee = Math.round(rand() * 500000) / 100;
    const inventory = processInventory(groups), summary = totals(inventory, fee);
    let sqFt = 0, amount = 0, pieces = 0;
    for (const g of groups) for (const r of g.measurementRows) { const a = r.lengthFt * r.widthFt * r.quantity; sqFt += a; amount += a * g.ratePerSqFt; pieces += r.quantity; }
    assert.equal(summary.totalPieces, pieces);
    assert.equal(summary.totalDispatchVolumeSqFt, round2(sqFt));
    assert.equal(summary.baseMaterialTotal, round2(amount));
    assert.equal(summary.netBillableAmount, round2(summary.baseMaterialTotal + fee));
  }
});
