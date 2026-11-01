const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAnalytics, buildPaymentAnalytics, windows, ANALYTICS_PERIODS } = require('../utils/dispatchAnalytics');

test('only supported dashboard analytics periods are accepted', () => {
  assert.deepEqual([...ANALYTICS_PERIODS], ['3', '7', '30', 'all']);
});

// 2026-10-09 10:00 IST
const now = new Date('2026-10-09T04:30:00.000Z');
const summary = (net, area = 100, pieces = 10) => ({ netBillableAmount: net, totalDispatchVolumeSqFt: area, totalPieces: pieces });
const record = (date, status, net, destination = 'Chennai', extra = {}) => ({ date: new Date(date), status, summary: summary(net), logistics: { buyerDestination: destination }, ...extra });

test('window is 30 Kolkata days plus the 30 before it', () => {
  const range = windows(now);
  assert.equal(range.from, '2026-09-10');
  assert.equal(range.to, '2026-10-09');
  assert.equal(range.previousFrom, '2026-08-11');
  assert.equal(range.previousTo, '2026-09-09');
});

test('3-day window uses Kolkata calendar dates and the matching previous period', () => {
  const range = windows(now, 3);
  assert.equal(range.from, '2026-10-07');
  assert.equal(range.to, '2026-10-09');
  assert.equal(range.previousFrom, '2026-10-04');
  assert.equal(range.previousTo, '2026-10-06');
  const result = buildAnalytics([
    record('2026-10-06T18:29:59.999Z', 'Dispatched', 1000),
    record('2026-10-06T18:30:00.000Z', 'Dispatched', 500),
    record('2026-10-09', 'Delivered', 2000)
  ], now, '3');
  assert.equal(result.current.billed, 2500);
  assert.equal(result.previous.billed, 1000);
  assert.equal(result.trend.length, 3);
  assert.equal(result.period.granularity, 'day');
});

test('7-day and 30-day windows create the selected number of daily buckets', () => {
  for (const days of [7, 30]) {
    const result = buildAnalytics([], now, String(days));
    assert.equal(result.period.days, days);
    assert.equal(result.trend.length, days);
    assert.equal(result.trend.at(-1).date, '2026-10-09');
  }
});

test('Kolkata midnight boundaries decide the period', () => {
  const result = buildAnalytics([
    record('2026-09-09T18:29:59.999Z', 'Dispatched', 1000), // 23:59:59 IST on 09 Sep: previous period
    record('2026-09-09T18:30:00.000Z', 'Dispatched', 500),  // 00:00 IST on 10 Sep: current period
    record('2026-08-10T18:29:00.000Z', 'Dispatched', 9999)  // before the comparison window
  ], now);
  assert.equal(result.current.billed, 500);
  assert.equal(result.previous.billed, 1000);
});

test('drafts count as drafts but never as billed; both finalized states bill once', () => {
  const result = buildAnalytics([
    record('2026-10-01', 'Draft', 700),
    record('2026-10-02', 'Dispatched', 1000),
    record('2026-10-03', 'Delivered', 3000, 'Madurai')
  ], now);
  assert.deepEqual(result.statusCounts, { Draft: 1, Dispatched: 1, Delivered: 1 });
  assert.equal(result.current.finalizedLoads, 2);
  assert.equal(result.current.billed, 4000);
  assert.equal(result.current.averageBilled, 2000);
  assert.equal(result.current.areaSqFt, 200);
  assert.equal(result.current.pieces, 20);
});

test('daily series has 30 days and destinations rank by billed value', () => {
  const result = buildAnalytics([
    record('2026-10-02', 'Dispatched', 1000, 'Chennai'),
    record('2026-10-02', 'Dispatched', 500, 'chennai'),
    record('2026-10-05', 'Delivered', 1200, 'Madurai')
  ], now);
  assert.equal(result.trend.length, 30);
  assert.equal(result.trend[0].date, '2026-09-10');
  assert.equal(result.trend[29].date, '2026-10-09');
  assert.equal(result.trend.find(day => day.date === '2026-10-02').billed, 1500);
  assert.equal(result.topDestinations[0].name, 'Chennai');
  assert.equal(result.topDestinations[0].loads, 2);
  assert.equal(result.topDestinations[1].name, 'Madurai');
});

test('all-time analytics includes the full history and groups the trend by month', () => {
  const result = buildAnalytics([
    record('2026-08-01', 'Dispatched', 1000, 'Chennai'),
    record('2026-08-02', 'Draft', 500, 'Chennai'),
    record('2026-10-01', 'Delivered', 3000, 'Madurai')
  ], now, 'all');
  assert.equal(result.current.finalizedLoads, 2);
  assert.equal(result.current.billed, 4000);
  assert.equal(result.statusCounts.Draft, 1);
  assert.deepEqual(result.previous, { finalizedLoads: 0, billed: 0, areaSqFt: 0, pieces: 0, averageBilled: 0 });
  assert.equal(result.comparison, null);
  assert.equal(result.period.granularity, 'month');
  assert.deepEqual(result.trend.map(point => point.date), ['2026-08-01', '2026-09-01', '2026-10-01']);
  assert.equal(result.trend[1].loads, 0);
});

test('malformed summaries are reported and never counted', () => {
  const result = buildAnalytics([
    { date: new Date('2026-10-02'), status: 'Dispatched', summary: { netBillableAmount: '1000' }, logistics: {} },
    { date: new Date('2026-10-03'), status: 'Dispatched', summary: null, logistics: {} },
    record('2026-10-04', 'Dispatched', 250)
  ], now);
  assert.equal(result.unreadable, 2);
  assert.equal(result.current.finalizedLoads, 1);
  assert.equal(result.current.billed, 250);
});

test('empty data returns zeroed totals', () => {
  const result = buildAnalytics([], now);
  assert.equal(result.current.billed, 0);
  assert.equal(result.current.averageBilled, 0);
  assert.deepEqual(result.topDestinations, []);
  assert.equal(result.unreadable, 0);
});

test('payment analytics groups recent collections and full payments by party with all-time balances', () => {
  const records = [
    { ...record('2026-08-01', 'Dispatched', 500), id: 'old-unpaid', partyName: 'Granite Co' },
    { ...record('2026-10-01', 'Dispatched', 1000), id: 'unpaid', partyName: 'Granite Co' },
    { ...record('2026-10-02', 'Delivered', 1000), id: 'partial', partyName: 'Granite Co' },
    { ...record('2026-10-03', 'Dispatched', 250), id: 'paid-recent', partyName: 'Granite Co' },
    { ...record('2026-10-04', 'Delivered', 900), id: 'paid-old', partyName: 'Marble Co' },
    { ...record('2026-10-05', 'Draft', 700), id: 'draft', partyName: 'Draft Co' }
  ];
  const payments = [
    { id: 'p-old', dispatchId: 'partial', amount: 200, createdAt: '2026-09-09T18:29:59.999Z' },
    { id: 'p-partial', dispatchId: 'partial', amount: 200, createdAt: '2026-09-09T18:30:00.000Z' },
    { id: 'p-first', dispatchId: 'paid-recent', amount: 100, createdAt: '2026-09-20T10:00:00.000Z' },
    { id: 'p-final', dispatchId: 'paid-recent', amount: 150, createdAt: '2026-10-01T10:00:00.000Z' },
    { id: 'p-old-paid', dispatchId: 'paid-old', amount: 900, createdAt: '2026-08-10T10:00:00.000Z' },
    { id: 'p-draft', dispatchId: 'draft', amount: 50, createdAt: '2026-10-01T10:00:00.000Z' }
  ];

  const result = buildPaymentAnalytics(records, payments, now);
  assert.deepEqual(result.current, {
    received: 450,
    completedInvoiceTotal: 250,
    completedInvoices: 1,
    outstanding: 2100,
    unpaidInvoices: 2,
    partialInvoices: 1
  });
  assert.equal(result.previous.received, 200);
  assert.equal(result.trend.reduce((sum, point) => sum + point.received, 0), result.current.received);
  assert.equal(result.trend.reduce((sum, point) => sum + point.completedInvoiceTotal, 0), result.current.completedInvoiceTotal);
  assert.deepEqual(result.trend.filter(point => point.completedInvoices).map(point => ({
    date: point.date,
    completedInvoiceTotal: point.completedInvoiceTotal,
    completedInvoices: point.completedInvoices
  })), [{ date: '2026-10-01', completedInvoiceTotal: 250, completedInvoices: 1 }]);
  assert.deepEqual(result.parties.find(party => party.party === 'Granite Co'), {
    party: 'Granite Co',
    received: 450,
    completedInvoiceTotal: 250,
    completedInvoices: 1,
    outstanding: 2100,
    unpaidInvoices: 2,
    partialInvoices: 1
  });
  assert.equal(result.parties.some(party => party.party === 'Marble Co'), false);
  assert.equal(result.parties.some(party => party.party === 'Draft Co'), false);
});

test('payment analytics counts completion on the Kolkata calendar date', () => {
  const result = buildPaymentAnalytics([
    { ...record('2026-10-01', 'Dispatched', 100), id: 'boundary', partyName: 'Granite Co' }
  ], [
    { id: 'p-before', dispatchId: 'boundary', amount: 50, createdAt: '2026-09-09T18:29:59.999Z' },
    { id: 'p-at', dispatchId: 'boundary', amount: 50, createdAt: '2026-09-09T18:30:00.000Z' }
  ], now);
  assert.equal(result.previous.received, 50);
  assert.equal(result.current.received, 50);
  assert.equal(result.current.completedInvoiceTotal, 100);
  assert.deepEqual(result.trend.find(point => point.date === '2026-09-10'), {
    date: '2026-09-10',
    received: 50,
    completedInvoiceTotal: 100,
    completedInvoices: 1
  });
});

test('payment analytics switches between calendar windows and all-time totals', () => {
  const records = [
    { ...record('2026-08-01', 'Dispatched', 100), id: 'old-paid', partyName: 'Granite Co' },
    { ...record('2026-10-06', 'Dispatched', 300), id: 'partial', partyName: 'Granite Co' },
    { ...record('2026-10-08', 'Delivered', 200), id: 'recent-paid', partyName: 'Granite Co' }
  ];
  const payments = [
    { id: 'old', dispatchId: 'old-paid', amount: 100, createdAt: '2026-08-01T10:00:00.000Z' },
    { id: 'prior', dispatchId: 'partial', amount: 50, createdAt: '2026-10-06T10:00:00.000Z' },
    { id: 'recent', dispatchId: 'recent-paid', amount: 200, createdAt: '2026-10-08T10:00:00.000Z' }
  ];

  const recent = buildPaymentAnalytics(records, payments, now, '3');
  assert.equal(recent.current.received, 200);
  assert.equal(recent.previous.received, 50);
  assert.equal(recent.current.completedInvoiceTotal, 200);
  assert.equal(recent.trend.length, 3);
  assert.equal(recent.trend.reduce((sum, point) => sum + point.completedInvoiceTotal, 0), 200);

  const allTime = buildPaymentAnalytics(records, payments, now, 'all');
  assert.equal(allTime.current.received, 350);
  assert.equal(allTime.current.completedInvoiceTotal, 300);
  assert.equal(allTime.current.completedInvoices, 2);
  assert.equal(allTime.current.outstanding, 250);
  assert.equal(allTime.previous.received, 0);
  assert.equal(allTime.period.days, null);
  assert.deepEqual(allTime.trend.map(point => point.date), ['2026-08-01', '2026-09-01', '2026-10-01']);
  assert.equal(allTime.trend[1].received, 0);
  assert.equal(allTime.trend.reduce((sum, point) => sum + point.received, 0), 350);
  assert.equal(allTime.trend.reduce((sum, point) => sum + point.completedInvoices, 0), 2);
});
