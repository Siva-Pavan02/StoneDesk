const { Prisma } = require('@prisma/client');
const { invoiceTotalDecimal } = require('./invoiceMoney');

function validTime(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Latest provable transition to paid for a currently paid, positive invoice. */
function paidCompletion(record, payments) {
  const currentTotal = invoiceTotalDecimal(record.summary);
  if (!currentTotal.greaterThan(0)) return { event: null, excluded: false };
  const receivedNow = payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
  if (receivedNow.lessThan(currentTotal)) return { event: null, excluded: false };
  const revisions = Array.isArray(record.revisions) ? record.revisions : [];
  const initial = revisions.length ? revisions[0]?.priorTotal ?? revisions[0]?.summary?.netBillableAmount : currentTotal;
  let total;
  try { total = revisions.length ? invoiceTotalDecimal(initial) : currentTotal; }
  catch { return { event: null, excluded: true }; }
  const events = [];
  for (let index = 0; index < revisions.length; index += 1) {
    const revision = revisions[index];
    const at = validTime(revision?.revisedAt);
    const resulting = revision?.resultingTotal ?? revisions[index + 1]?.summary?.netBillableAmount ?? record.summary?.netBillableAmount;
    if (!at || resulting == null) return { event: null, excluded: true };
    try {
      events.push({ at, type: 0, order: index, total: invoiceTotalDecimal(resulting) });
    } catch { return { event: null, excluded: true }; }
  }
  for (const payment of payments) {
    const at = validTime(payment.createdAt);
    if (!at) return { event: null, excluded: true };
    events.push({ at, type: 1, order: String(payment.id), amount: new Prisma.Decimal(payment.amount) });
  }
  events.sort((a, b) => a.at - b.at || a.type - b.type ||
    (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  let received = new Prisma.Decimal(0);
  let lastPaidAt = null;
  for (const event of events) {
    const before = total.greaterThan(0) && received.greaterThanOrEqualTo(total);
    if (event.type === 0) total = event.total;
    else received = received.plus(event.amount);
    const after = total.greaterThan(0) && received.greaterThanOrEqualTo(total);
    if (!before && after) lastPaidAt = event.at;
  }
  if (!lastPaidAt || !total.equals(currentTotal) || !received.equals(receivedNow)) {
    return { event: null, excluded: true };
  }
  const invoiceDate = validTime(record.date);
  if (!invoiceDate) return { event: null, excluded: true };
  return { event: new Date(Math.max(lastPaidAt.getTime(), invoiceDate.getTime())), excluded: false };
}

module.exports = { paidCompletion };
