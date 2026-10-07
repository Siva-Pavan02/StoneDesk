import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { makeRow, payload, readDraft, previewRows } from '../src/utils/pilotDraft.js';
import { buyerPdf, buyerExcel, driverPdf } from '../src/utils/pilotExports.js';
const row = { stoneType: 'Stone', finish: 'Polished', lengthFt: 3, widthFt: 2, quantity: 19, category: 'Regular', sqFt: 114, lineTotal: 4617 };
const record = { status: 'Dispatched', dispatchSlipNumber: 'GS-PILOT', date: '2026-10-06', partyName: 'Buyer', supervisor: 'Siva', logistics: { truckNumber: 'AP01', buyerDestination: 'Kadapa' }, businessSnapshot: { businessName: 'Frozen Business', address: 'Kadapa', phone: '123' }, inventory: [{ stoneType: 'Stone', finish: 'Polished', ratePerSqFt: 40.5, totalSqFt: 114, lineTotal: 4617, measurementRows: [row] }], summary: { totalPieces: 19, totalDispatchVolumeSqFt: 114, baseMaterialTotal: 4617, loadingAndRoyaltyFees: 0, netBillableAmount: 4617 } };
test('fraction entry and grouping quantity rows', () => {
  const product = { stoneType: 'Stone', finish: 'Polished' };
  const result = makeRow({ length: '3½', width: '1½', quantity: '10', rate: '40.5', category: 'TOP' }, product);
  assert.equal(previewRows([result])[0].sqFt, 52.5);
  const data = payload({ clientRequestId: 'request-123', partyName: 'Buyer', truckNumber: 'AP01', date: '2026-10-06', buyerDestination: 'Kadapa', supervisor: 'Siva', fee: '0', rows: [result, { ...result, category: 'Regular' }] });
  assert.equal(data.inventory.length, 1);
  assert.equal(data.inventory[0].measurementRows.length, 2);
  assert.throws(() => makeRow({ length: '3', width: '2', quantity: '1.5', rate: '40' }, product), /whole quantity/);
  assert.throws(() => makeRow({ length: '3..5', width: '2', quantity: '1', rate: '40' }, product), /positive lengths/);
});
test('draft recovery tolerates corrupt and unavailable storage', () => {
  assert.equal(readDraft({ getItem: () => '{broken' }), null);
  for (const rows of [[null], [{lengthFt:3}], [42]]) assert.equal(readDraft({ getItem: () => JSON.stringify({clientRequestId:'corrupt',rows}) }), null);
  assert.equal(readDraft({ getItem: () => { throw new Error('Unavailable'); } }), null);
  assert.deepEqual(readDraft({ getItem: () => JSON.stringify({ clientRequestId: 'request-123', rows: [{ ...row, ratePerSqFt: 40.5 }], entry: { length: '4½' } }) }).entry, { length: '4½' });
});
test('Excel preserves numeric values and frozen business identity', async () => {
  const output = buyerExcel(record);
  const book = XLSX.read(await output.blob.arrayBuffer(), { type: 'array' });
  const sheet = book.Sheets['Buyer Invoice'];
  assert.equal(sheet.A1.v, 'Frozen Business');
  assert.equal(sheet.G9.t, 'n'); assert.equal(sheet.G9.v, 114);
  assert.equal(sheet.I9.t, 'n'); assert.equal(sheet.I9.v, 4617);
  const pdf = buyerPdf(record);
  assert.match(await pdf.blob.text(), /Frozen Business/);
  assert.throws(() => buyerExcel({ ...record, status: 'Draft' }), /unfinalized/);
});
test('driver slip never reads financial values', async () => {
  const privateGroup = { ...record.inventory[0] };
  Object.defineProperty(privateGroup, 'ratePerSqFt', { get: () => { throw new Error('Price accessed'); } });
  Object.defineProperty(privateGroup, 'lineTotal', { get: () => { throw new Error('Amount accessed'); } });
  const doc = driverPdf({ ...record, inventory: [privateGroup], summary: undefined });
  const text = await doc.blob.text();
  assert.match(text, /Frozen Business/);
  assert.doesNotMatch(text, /4617|4,617|Net payable|Rate/);
});
test('long bills paginate without dropping measurement rows', async () => {
  const big = { ...record, inventory: [{ ...record.inventory[0], totalSqFt: 13680, lineTotal: 554040, measurementRows: Array.from({ length: 120 }, () => ({ ...row })) }], summary: { totalPieces: 2280, totalDispatchVolumeSqFt: 13680, baseMaterialTotal: 554040, loadingAndRoyaltyFees: 0, netBillableAmount: 554040 } };
  const text = await buyerPdf(big).blob.text();
  assert.ok((text.match(/\/Type \/Page\b/g) || []).length > 2);
  assert.equal((text.match(/\(114\)/g) || []).length, 120);
  assert.match(text, /13,680|13680/);
});

test('ledger includes TOP groups, fractions and original stored money without recalculation', async () => {
  const frozen = { ...record, inventory: [{ ...record.inventory[0], lineTotal: 5000, measurementRows: [row, { ...row, category: 'TOP', lengthFt: 3.5, widthFt: 1.5, quantity: 25, sqFt: 131.25, lineTotal: 383 }] }], summary: { totalPieces: 44, totalDispatchVolumeSqFt: 245.25, baseMaterialTotal: 5000, loadingAndRoyaltyFees: 5, netBillableAmount: 5005 } };
  const text = await buyerPdf(frozen).blob.text();
  assert.match(text, /TOP subtotal/); assert.match(text, /No. of pcs/);
  assert.match(text, /5,005.00/); assert.match(text, /5,000.00/);
  assert.match(text, /Running total area/);
});
