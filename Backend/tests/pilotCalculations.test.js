const test = require('node:test');
const assert = require('node:assert/strict');
const { processInventory, totals } = require('../utils/pilotCalculations');
const group = { stoneType: 'Stone', finish: 'Polished', ratePerSqFt: 40.5,
  measurementRows: [{ lengthFt: 3, widthFt: 2, quantity: 19, category: 'Regular' }, { lengthFt: 3.5, widthFt: 1.5, quantity: 10, category: 'TOP' }] };
test('quantity, fractions, TOP, charges, and static persisted totals', async () => {
  const inventory = processInventory([{ ...group, lineTotal: 1, totalSqFt: 1, measurementRows: group.measurementRows.map(r => ({ ...r, sqFt: 1, lineTotal: 1 })) }]);
  assert.equal(inventory[0].measurementRows[0].sqFt, 114);
  assert.equal(inventory[0].measurementRows[0].lineTotal, 4617);
  assert.equal(inventory[0].measurementRows[1].sqFt, 52.5);
  assert.equal(inventory[0].totalSqFt, 166.5);
  const summary = totals(inventory, 50);
  assert.equal(summary.totalPieces, 29);
  assert.equal(summary.netBillableAmount, 6793.25);
  const persisted = JSON.parse(JSON.stringify({ inventory, summary }));
  assert.equal(persisted.inventory[0].totalSqFt, 166.5);
  assert.equal(persisted.inventory[0].measurementRows[0].quantity, 19);
});
test('invalid dimensions, quantity, rate, fees and overflow are rejected', () => {
  for (const changes of [{ lengthFt: 0 }, { widthFt: -1 }, { lengthFt: Infinity }, { quantity: 0 }, { quantity: 1.5 }, { quantity: '19' }, { category: 'Other' }, { rowNo: 0 }, { rowNo: 21 }, { rowNo: 1.5 }]) {
    assert.throws(() => processInventory([{ ...group, measurementRows: [{ ...group.measurementRows[0], ...changes }] }]), e => e.status === 400);
  }
  assert.equal(processInventory([{ ...group, measurementRows: [{ ...group.measurementRows[0], rowNo: 20 }] }])[0].measurementRows[0].rowNo, 20);
  for (const ratePerSqFt of [-1, NaN, Infinity, '40']) assert.throws(() => processInventory([{ ...group, ratePerSqFt }]), e => e.status === 400);
  assert.throws(() => totals(processInventory([group]), -1), e => e.status === 400);
  assert.throws(() => processInventory([{ ...group, measurementRows: [{ lengthFt: 1e100, widthFt: 1e100, quantity: 1 }] }]), e => e.status === 400);
});
test('legacy piece records remain calculable with display fields', () => {
  const inventory = processInventory([{ stoneType: 'Stone', finish: 'Slab', ratePerSqFt: 100, pieces: [{ lengthFt: 10, widthFt: 5, sqFt: 1 }] }]);
  assert.equal(inventory[0].pieces[0].sqFt, 50);
  assert.equal(inventory[0].pieces[0].lengthDisplay, '10');
  assert.equal(totals(inventory, 8500).netBillableAmount, 13500);
});

test('version 2 rounds each row before summing and keeps exact billable area', () => {
  const inventory = processInventory([{ stoneType: 'Stone', finish: 'Polished', ratePerSqFt: 10,
    measurementRows: [1, 2, 3].map(rowNo => ({ rowNo, lengthFt: 1.3335, widthFt: 1, quantity: 1, category: 'Regular' })) }]);
  assert.deepEqual(inventory[0].measurementRows.map(row => row.lineTotal), [13.34, 13.34, 13.34]);
  assert.deepEqual(inventory[0].measurementRows.map(row => row.billableAreaSqFt), ['1.3335', '1.3335', '1.3335']);
  assert.equal(inventory[0].lineTotal, 40.02);
  assert.equal(totals(inventory, 0).baseMaterialTotal, 40.02);
  assert.equal(totals(inventory, 0).calculationVersion, 2);
});

test('version 2 preserves paise instead of rounding .75 to a rupee', () => {
  const inventory = processInventory([{ stoneType: 'Stone', finish: 'Polished', ratePerSqFt: 40.5,
    measurementRows: [{ lengthFt: 3.25, widthFt: 2.5, quantity: 4, category: 'Regular' }] }]);
  assert.equal(totals(inventory, 150.5).netBillableAmount, 1466.75);
});
