const test = require('node:test');
const assert = require('node:assert/strict');
const { processInventory, totals } = require('../utils/pilotCalculations');
const Dispatch = require('../models/Dispatch');
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
  const record = new Dispatch({ dispatchSlipNumber: 'TEST', supervisor: 'Siva', partyName: 'Buyer', logistics: { truckNumber: 'AP01', buyerDestination: 'Kadapa' }, inventory, summary, businessSnapshot: { businessName: 'Original' } });
  await record.validate();
  assert.equal(record.toObject().inventory[0].totalSqFt, 166.5);
  assert.equal(record.toObject().inventory[0].measurementRows[0].quantity, 19);
});
test('invalid dimensions, quantity, rate, fees and overflow are rejected', () => {
  for (const changes of [{ lengthFt: 0 }, { widthFt: -1 }, { lengthFt: Infinity }, { quantity: 0 }, { quantity: 1.5 }, { quantity: '19' }, { category: 'Other' }]) {
    assert.throws(() => processInventory([{ ...group, measurementRows: [{ ...group.measurementRows[0], ...changes }] }]), e => e.status === 400);
  }
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
