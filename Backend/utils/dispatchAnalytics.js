// Dashboard analytics over dispatch records. Dates are business dates (Dispatch.date)
// bucketed by Asia/Kolkata calendar day. India has no daylight saving, so a fixed offset is exact.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const TIMEZONE = 'Asia/Kolkata';
const FINALIZED = new Set(['Dispatched', 'Delivered']);

const istDay = date => new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const dayStart = day => new Date(Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MS);
const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
const { round2: money } = require('./dispatchCalculations');

function windows(now = new Date()) {
  const to = istDay(now);
  const from = addDays(to, -(WINDOW_DAYS - 1));
  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, -(WINDOW_DAYS - 1));
  return { from, to, previousFrom, previousTo, start: dayStart(previousFrom), end: dayStart(addDays(to, 1)) };
}

function figure(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function emptyTotals() { return { finalizedLoads: 0, billed: 0, areaSqFt: 0, pieces: 0, averageBilled: 0 }; }

function buildAnalytics(records, now = new Date()) {
  const range = windows(now);
  const statusCounts = { Draft: 0, Dispatched: 0, Delivered: 0 };
  const current = emptyTotals(), previous = emptyTotals();
  const daily = new Map();
  for (let i = 0; i < WINDOW_DAYS; i += 1) daily.set(addDays(range.from, i), { date: addDays(range.from, i), billed: 0, loads: 0 });
  const destinations = new Map();
  let unreadable = 0;

  for (const record of records) {
    const day = istDay(new Date(record.date));
    const inCurrent = day >= range.from && day <= range.to;
    const inPrevious = day >= range.previousFrom && day <= range.previousTo;
    if (!inCurrent && !inPrevious) continue;
    if (inCurrent && statusCounts[record.status] !== undefined) statusCounts[record.status] += 1;
    if (!FINALIZED.has(record.status)) continue;
    const summary = record.summary || {};
    const billed = figure(summary.netBillableAmount);
    const area = figure(summary.totalDispatchVolumeSqFt);
    const pieces = figure(summary.totalPieces);
    if (billed === null || area === null || pieces === null) { unreadable += 1; continue; }
    const bucket = inCurrent ? current : previous;
    bucket.finalizedLoads += 1; bucket.billed += billed; bucket.areaSqFt += area; bucket.pieces += pieces;
    if (!inCurrent) continue;
    const point = daily.get(day);
    point.billed += billed; point.loads += 1;
    const name = String(record.logistics?.buyerDestination || '').trim();
    if (name) {
      const key = name.toLowerCase();
      const entry = destinations.get(key) || { name, billed: 0, loads: 0 };
      entry.billed += billed; entry.loads += 1;
      destinations.set(key, entry);
    }
  }

  for (const bucket of [current, previous]) {
    bucket.billed = money(bucket.billed); bucket.areaSqFt = money(bucket.areaSqFt);
    bucket.averageBilled = bucket.finalizedLoads ? money(bucket.billed / bucket.finalizedLoads) : 0;
  }
  return {
    period: { from: range.from, to: range.to, days: WINDOW_DAYS, timezone: TIMEZONE, dateBasis: 'dispatchDate' },
    comparison: { from: range.previousFrom, to: range.previousTo },
    statusCounts,
    current,
    previous,
    daily: [...daily.values()].map(point => ({ ...point, billed: money(point.billed) })),
    topDestinations: [...destinations.values()].map(item => ({ ...item, billed: money(item.billed) }))
      .sort((a, b) => b.billed - a.billed || a.name.localeCompare(b.name)).slice(0, 3),
    unreadable
  };
}

module.exports = { buildAnalytics, windows, istDay, WINDOW_DAYS, TIMEZONE };
