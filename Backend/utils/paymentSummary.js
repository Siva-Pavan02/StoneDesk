const { Prisma } = require('@prisma/client');
const { invoiceTotalDecimal } = require('./invoiceMoney');

function derivePaymentSummary(rawInvoiceTotal, rawPayments = []) {
  const invoiceTotal = invoiceTotalDecimal(rawInvoiceTotal);
  const received = rawPayments.reduce(
    (acc, p) => acc.add(p?.amount !== undefined ? new Prisma.Decimal(String(p.amount)) : 0),
    new Prisma.Decimal(0)
  );

  const balance = invoiceTotal.greaterThan(received)
    ? invoiceTotal.sub(received)
    : new Prisma.Decimal(0);
  const excess = received.greaterThan(invoiceTotal)
    ? received.sub(invoiceTotal)
    : new Prisma.Decimal(0);

  let status = 'PAYMENT_DUE';
  if (received.greaterThan(0) && balance.greaterThan(0)) {
    status = 'PARTIALLY_PAID';
  } else if (received.greaterThanOrEqualTo(invoiceTotal) && invoiceTotal.greaterThan(0)) {
    status = 'PAID';
  } else if (invoiceTotal.isZero() && balance.isZero()) {
    status = 'PAID';
  }

  return {
    invoiceTotal: Number(invoiceTotal.toFixed(2)),
    received: Number(received.toFixed(2)),
    balance: Number(balance.toFixed(2)),
    excess: Number(excess.toFixed(2)),
    status
  };
}

module.exports = { derivePaymentSummary };
