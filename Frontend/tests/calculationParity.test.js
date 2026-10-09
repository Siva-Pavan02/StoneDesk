import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { round2, fixed2, summarize } from '../src/utils/loadMath.js';
import { previewRows, payload, money } from '../src/utils/pilotDraft.js';
import { billRows, rowGroups, rowOverview, subtotals } from '../src/utils/billData.js';
import { parseFraction, decimalToFraction } from '../src/utils/fractionParser.js';
import { loadingTotals } from '../src/utils/loadingListTotals.js';

const require = createRequire(import.meta.url);
const server = require('../../Backend/utils/pilotCalculations.js');
const serverRound = require('../../Backend/utils/dispatchCalculations.js').round2;

const draftRow = (stoneType, ratePerSqFt, lengthFt, widthFt, quantity, category = 'Regular', rowNo = 1) => ({ stoneType, finish: 'Polished', ratePerSqFt, lengthFt, widthFt, quantity, category, rowNo });
const draft = (rows, fee) => ({ clientRequestId: 'x', partyName: 'P', truckNumber: 'T', date: '2026-01-01', buyerDestination: 'D', supervisor: 'S', fee: String(fee), rows });
function serverRecord(rows, fee) {
  const body = payload(draft(rows, fee));
  const inventory = server.processInventory(body.inventory);
  return { status: 'Dispatched', inventory, summary: server.totals(inventory, body.loadingAndRoyaltyFees) };
}

test('frontend and backend round2 agree on edge values', () => {
  for (const v of [1.005, 1234.005, 2.675, 0.0625 * 0.08, 0.1 + 0.2, 39.995, 1e9 + 0.005, -1.005]) assert.equal(round2(v), serverRound(v));
  assert.equal(fixed2(1.005), '1.01');
  assert.equal(money(1.005), '₹1.01');
});

test('F3: live preview summary equals the saved server summary', () => {
  const rows = [draftRow('Granite', 40.5, 3, 2, 12, 'TOP'), draftRow('Black', 60, parseFraction('4½').numeric, parseFraction('2 1/4').numeric, 4)];
  const expected = { totalPieces: 16, totalDispatchVolumeSqFt: 112.5, baseMaterialTotal: 5346, loadingAndRoyaltyFees: 2500, netBillableAmount: 7846 };
  assert.deepEqual(summarize(rows, 2500), expected);
  assert.deepEqual(serverRecord(rows, 2500).summary, expected);
});

test('F4: preview, server and bill round once at the end', () => {
  const rows = [1, 2, 3].map(() => draftRow('Granite', 10, 1.333, 1, 1));
  const preview = previewRows(rows);
  assert.deepEqual(preview.map(r => r.sqFt), [1.33, 1.33, 1.33]);
  assert.equal(summarize(rows, 0).totalDispatchVolumeSqFt, 4);
  assert.equal(summarize(rows, 0).baseMaterialTotal, 39.99);
  const record = serverRecord(rows, 0);
  assert.equal(record.summary.totalDispatchVolumeSqFt, 4);
  const groups = rowGroups(billRows(record)), overview = rowOverview(groups);
  assert.equal(groups[0].total.sqFt, 4);
  assert.equal(groups[0].total.amount, 39.99);
  assert.equal(overview.totalSqFt, 4);
  assert.equal(overview.totalAmount, record.summary.baseMaterialTotal);
  assert.equal(subtotals(preview)[0].sqFt, 4);
  assert.equal(subtotals(preview)[0].lineTotal, 39.99);
});

test('F5: Regular + TOP equals the total on the bill', () => {
  const rows = [draftRow('Granite', 10, 1.333, 1, 1, 'TOP'), draftRow('Granite', 10, 1.333, 1, 1, 'TOP'), draftRow('Granite', 10, 1.333, 1, 1)];
  const record = serverRecord(rows, 0);
  const groups = rowGroups(billRows(record)), overview = rowOverview(groups);
  for (const g of groups) {
    assert.equal(round2(g.regular.sqFt + g.top.sqFt), g.total.sqFt);
    assert.equal(round2(g.regular.amount + g.top.amount), g.total.amount);
  }
  assert.equal(round2(overview.regularSqFt + overview.topSqFt), overview.totalSqFt);
  assert.equal(overview.totalSqFt, record.summary.totalDispatchVolumeSqFt);
});

test('property: preview, server and bill totals agree for random loads', () => {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dim = () => rand() < 0.5 ? Math.ceil(rand() * 40) / 4 : Math.ceil(rand() * 10000) / 1000;
  for (let i = 0; i < 1000; i++) {
    const rows = Array.from({ length: 1 + Math.floor(rand() * 12) }, () => draftRow(`S${Math.floor(rand() * 3)}`, Math.round(rand() * 10000) / 100, dim(), dim(), 1 + Math.floor(rand() * 40), rand() < 0.3 ? 'TOP' : 'Regular', 1 + Math.floor(rand() * 15)));
    const fee = Math.round(rand() * 500000) / 100;
    const record = serverRecord(rows, fee), preview = summarize(rows, fee);
    assert.deepEqual(preview, record.summary);
    const overview = rowOverview(rowGroups(billRows(record)));
    assert.equal(overview.totalSqFt, record.summary.totalDispatchVolumeSqFt);
    assert.equal(overview.totalAmount, record.summary.baseMaterialTotal);
    assert.equal(overview.pieces, record.summary.totalPieces);
    assert.equal(record.summary.netBillableAmount, round2(record.summary.baseMaterialTotal + fee));
  }
});

test('F6: loading-list pending and excess totals', () => {
  const totals = loadingTotals([{ requiredQuantity: 10, loadedQuantity: 5 }, { requiredQuantity: 10, loadedQuantity: 12 }]);
  assert.deepEqual(totals, { required: 20, loaded: 17, pending: 5, excess: 2 });
});

test('F7/R9: fractions parse correctly and display never changes the value', () => {
  for (const [input, value] of [['4 1/2', 4.5], ['4½', 4.5], ['½', 0.5], ['1/2', 0.5], ['4.5', 4.5]]) assert.equal(parseFraction(input).numeric, value);
  for (const input of ['3/0', 'abc', '-1', '', '1/2/3']) assert.equal(parseFraction(input), null);
  assert.equal(decimalToFraction(4.07), '4.07');
  assert.equal(decimalToFraction(12.37), '12.37');
  assert.equal(decimalToFraction(4.333333), '4⅓');
  assert.equal(parseFraction('4.07').display, '4.07');
});
