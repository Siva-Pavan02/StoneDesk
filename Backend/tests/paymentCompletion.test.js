const test = require('node:test');
const assert = require('node:assert/strict');
const { paidCompletion } = require('../utils/paymentCompletion');

const base = { date: '2026-10-01T00:00:00.000Z', summary: { netBillableAmount: 100 }, revisions: [] };
const pay = (id, amount, at) => ({ id, amount, createdAt: at });

test('early cash completes on invoice date and future invoices remain dated forward', () => {
  const result = paidCompletion(base, [pay('a', 100, '2026-09-01T00:00:00.000Z')]);
  assert.equal(result.event.toISOString(), base.date);
  assert.equal(result.excluded, false);
});

test('upward revision reopens invoice and latest payment completes it again', () => {
  const record = { ...base, summary: { netBillableAmount: 150 }, revisions: [{
    summary: { netBillableAmount: 100 }, priorTotal: 100, resultingTotal: 150,
    revisedAt: '2026-10-03T00:00:00.000Z',
  }] };
  const result = paidCompletion(record, [
    pay('a', 100, '2026-10-02T00:00:00.000Z'),
    pay('b', 50, '2026-10-04T00:00:00.000Z'),
  ]);
  assert.equal(result.event.toISOString(), '2026-10-04T00:00:00.000Z');
  assert.equal(result.excluded, false);
});

test('downward revision can be the latest completion event', () => {
  const record = { ...base, summary: { netBillableAmount: 80 }, revisions: [{
    summary: { netBillableAmount: 100 }, priorTotal: 100, resultingTotal: 80,
    revisedAt: '2026-10-03T00:00:00.000Z',
  }] };
  assert.equal(paidCompletion(record, [pay('a', 80, '2026-10-02T00:00:00.000Z')]).event.toISOString(), '2026-10-03T00:00:00.000Z');
});

test('legacy revision without a time is reported as excluded', () => {
  const record = { ...base, summary: { netBillableAmount: 80 }, revisions: [{ summary: { netBillableAmount: 100 } }] };
  assert.deepEqual(paidCompletion(record, [pay('a', 80, '2026-10-02T00:00:00.000Z')]), { event: null, excluded: true });
});
