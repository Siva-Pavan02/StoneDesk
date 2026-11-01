// Dashboard analytics over dispatch records. Dates are business dates (Dispatch.date)
// bucketed by Asia/Kolkata calendar day. India has no daylight saving, so a fixed offset is exact.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const TIMEZONE = 'Asia/Kolkata';
const FINALIZED = new Set(['Dispatched', 'Delivered']);
const ANALYTICS_PERIODS = new Set(['3', '7', '30', 'all']);

const istDay = date => new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const dayStart = day => new Date(Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MS);
const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
const { round2: money } = require('./dispatchCalculations');
const { derivePaymentSummary } = require('./paymentSummary');

function windows(now = new Date(), days = WINDOW_DAYS) {
  const to = istDay(now);
  const from = days === null ? null : addDays(to, -(days - 1));
  const previousTo = from ? addDays(from, -1) : null;
  const previousFrom = previousTo ? addDays(previousTo, -(days - 1)) : null;
  return {
    from, to, previousFrom, previousTo,
    currentStart: from ? dayStart(from) : null,
    start: previousFrom ? dayStart(previousFrom) : null,
    end: dayStart(addDays(to, 1))
  };
}

function figure(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function emptyTotals() { return { finalizedLoads: 0, billed: 0, areaSqFt: 0, pieces: 0, averageBilled: 0 }; }

function buildAnalytics(records, now = new Date(), period = '30') {
  const days = period === 'all' ? null : Number(period);
  const range = windows(now, days);
  const statusCounts = { Draft: 0, Dispatched: 0, Delivered: 0 };
  const current = emptyTotals(), previous = emptyTotals();
  const trend = new Map();
  if (days !== null) for (let i = 0; i < days; i += 1) {
    const date = addDays(range.from, i);
    trend.set(date, { date, billed: 0, loads: 0 });
  } else {
    const firstDay = records.reduce((first, record) => {
      const date = istDay(new Date(record.date));
      return date <= range.to && (!first || date < first) ? date : first;
    }, null);
    if (firstDay) {
      for (let date = `${firstDay.slice(0, 7)}-01`, last = `${range.to.slice(0, 7)}-01`; date <= last;) {
        trend.set(date, { date, billed: 0, loads: 0 });
        const next = new Date(`${date}T00:00:00Z`);
        next.setUTCMonth(next.getUTCMonth() + 1);
        date = next.toISOString().slice(0, 10);
      }
    }
  }
  const destinations = new Map();
  let unreadable = 0;

  for (const record of records) {
    const day = istDay(new Date(record.date));
    const inCurrent = (!range.from || day >= range.from) && day <= range.to;
    const inPrevious = range.previousFrom !== null && day >= range.previousFrom && day <= range.previousTo;
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
    const key = days === null ? `${day.slice(0, 7)}-01` : day;
    const point = trend.get(key) || { date: key, billed: 0, loads: 0 };
    point.billed += billed; point.loads += 1;
    trend.set(key, point);
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
    period: { from: range.from, to: range.to, days, granularity: days === null ? 'month' : 'day', timezone: TIMEZONE, dateBasis: 'dispatchDate' },
    comparison: range.previousFrom ? { from: range.previousFrom, to: range.previousTo } : null,
    statusCounts,
    current,
    previous,
    trend: [...trend.values()].sort((a, b) => a.date.localeCompare(b.date)).map(point => ({ ...point, billed: money(point.billed) })),
    topDestinations: [...destinations.values()].map(item => ({ ...item, billed: money(item.billed) }))
      .sort((a, b) => b.billed - a.billed || a.name.localeCompare(b.name)).slice(0, 3),
    unreadable
  };
}

function buildPaymentAnalytics(records, payments, now = new Date(), period = '30') {
  const days = period === 'all' ? null : Number(period);
  const range = windows(now, days);
  const periodEnd = dayStart(addDays(range.to, 1));
  const previousPeriodStart = range.start;
  const previousEnd = range.currentStart;
  const parties = new Map();
  const current = { received: 0, completedInvoiceTotal: 0, completedInvoices: 0, outstanding: 0, unpaidInvoices: 0, partialInvoices: 0 };
  const previous = { received: 0 };
  const trend = new Map();
  const finalized = records.filter(record => FINALIZED.has(record.status));
  const paymentsByDispatch = new Map();

  if (days !== null) {
    for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
      trend.set(date, { date, received: 0, completedInvoiceTotal: 0, completedInvoices: 0 });
    }
  }

  const trendFor = date => {
    const key = days === null ? `${date.slice(0, 7)}-01` : date;
    if (!trend.has(key)) trend.set(key, { date: key, received: 0, completedInvoiceTotal: 0, completedInvoices: 0 });
    return trend.get(key);
  };

  for (const payment of payments) {
    const list = paymentsByDispatch.get(payment.dispatchId) || [];
    list.push(payment);
    paymentsByDispatch.set(payment.dispatchId, list);
  }
  for (const list of paymentsByDispatch.values()) {
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || String(a.id).localeCompare(String(b.id)));
  }

  const getParty = record => {
    const name = String(record.partyName || '').trim() || 'Unspecified party';
    if (!parties.has(name)) parties.set(name, {
      party: name, received: 0, completedInvoiceTotal: 0, completedInvoices: 0,
      outstanding: 0, unpaidInvoices: 0, partialInvoices: 0
    });
    return parties.get(name);
  };

  for (const record of finalized) {
    const invoiceTotal = figure(record.summary?.netBillableAmount);
    if (invoiceTotal === null) continue;
    const party = getParty(record);
    const invoicePayments = paymentsByDispatch.get(record.id) || [];
    const paymentSummary = derivePaymentSummary(invoiceTotal, invoicePayments);
    party.outstanding += paymentSummary.balance;
    if (invoiceTotal > 0 && paymentSummary.received === 0) party.unpaidInvoices += 1;
    else if (paymentSummary.received > 0 && paymentSummary.balance > 0) party.partialInvoices += 1;
    let receivedBefore = 0;
    let countedCompletion = false;
    for (const payment of invoicePayments) {
      const createdAt = new Date(payment.createdAt);
      if ((!range.currentStart || createdAt >= range.currentStart) && createdAt < periodEnd) {
        party.received += Number(payment.amount);
        trendFor(istDay(createdAt)).received += Number(payment.amount);
      }
      else if (previousPeriodStart && createdAt >= previousPeriodStart && createdAt < previousEnd) previous.received += Number(payment.amount);
      if (!countedCompletion && receivedBefore < invoiceTotal && receivedBefore + Number(payment.amount) >= invoiceTotal) {
        const completedDay = istDay(createdAt);
        if ((!range.from || completedDay >= range.from) && completedDay <= range.to) {
          party.completedInvoiceTotal += invoiceTotal;
          party.completedInvoices += 1;
          const point = trendFor(completedDay);
          point.completedInvoiceTotal += invoiceTotal;
          point.completedInvoices += 1;
        }
        countedCompletion = true;
      }
      receivedBefore += Number(payment.amount);
    }
  }

  for (const party of parties.values()) {
    party.received = money(party.received);
    party.completedInvoiceTotal = money(party.completedInvoiceTotal);
    party.outstanding = money(party.outstanding);
    current.received += party.received;
    current.completedInvoiceTotal += party.completedInvoiceTotal;
    current.completedInvoices += party.completedInvoices;
    current.outstanding += party.outstanding;
    current.unpaidInvoices += party.unpaidInvoices;
    current.partialInvoices += party.partialInvoices;
  }
  for (const key of ['received', 'completedInvoiceTotal', 'outstanding']) current[key] = money(current[key]);
  previous.received = money(previous.received);
  if (days === null && trend.size) {
    const first = new Date(`${[...trend.keys()].sort()[0]}T00:00:00.000Z`);
    const last = new Date(`${range.to.slice(0, 7)}-01T00:00:00.000Z`);
    for (const month = first; month <= last; month.setUTCMonth(month.getUTCMonth() + 1)) {
      const date = `${month.toISOString().slice(0, 7)}-01`;
      if (!trend.has(date)) trend.set(date, { date, received: 0, completedInvoiceTotal: 0, completedInvoices: 0 });
    }
  }

  return {
    period: { from: range.from, to: range.to, days, timezone: TIMEZONE },
    current,
    previous,
    trend: [...trend.values()].sort((a, b) => a.date.localeCompare(b.date)).map(point => ({
      ...point,
      received: money(point.received),
      completedInvoiceTotal: money(point.completedInvoiceTotal)
    })),
    parties: [...parties.values()]
      .filter(party => party.received || party.completedInvoices || party.outstanding)
      .sort((a, b) => b.outstanding - a.outstanding || b.received - a.received || a.party.localeCompare(b.party))
  };
}

module.exports = { buildAnalytics, buildPaymentAnalytics, windows, istDay, WINDOW_DAYS, TIMEZONE, ANALYTICS_PERIODS };
