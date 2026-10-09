const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAnalytics, windows } = require('../utils/dispatchAnalytics');

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
  assert.equal(result.daily.length, 30);
  assert.equal(result.daily[0].date, '2026-09-10');
  assert.equal(result.daily[29].date, '2026-10-09');
  assert.equal(result.daily.find(day => day.date === '2026-10-02').billed, 1500);
  assert.equal(result.topDestinations[0].name, 'Chennai');
  assert.equal(result.topDestinations[0].loads, 2);
  assert.equal(result.topDestinations[1].name, 'Madurai');
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
