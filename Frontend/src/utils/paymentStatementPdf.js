import Decimal from 'decimal.js';
import { jsPDF } from 'jspdf';
import { loadInvoicePdfFonts } from './a4InvoicePdfFonts.js';

export function paymentStatementFilename(statement) {
  const sanitize = value => String(value || '')
    .replace(/[^\p{L}\p{M}\p{N}-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const partyName = sanitize(statement?.invoice?.partyName) || 'Payment';
  const invoiceNumber = sanitize(statement?.invoice?.number) || 'Invoice';
  const invoiceId = sanitize(statement?.invoice?.id).slice(-8);
  const timestamp = new Date(statement?.asOf);
  if (!Number.isFinite(timestamp.getTime())) throw new Error('Invalid statement time');
  const ist = new Date(timestamp.getTime() + 330 * 60_000).toISOString();
  const date = ist.slice(0, 10);
  const [year, month, day] = date.split('-');
  const time = ist.slice(11, 23).replace(/\D/g, '');
  return `${partyName}-${invoiceNumber}${invoiceId ? `-${invoiceId}` : ''}-Payment-Statement-${day}-${month}-${year}-${time}.pdf`;
}

const MONEY = /^(0|[1-9]\d*)\.\d{2}$/;
const LEFT = 17;
const RIGHT = 193;
const BOTTOM = 278;

function amount(value) {
  if (typeof value !== 'string' || !MONEY.test(value)) throw new Error('Invalid statement amount');
  return new Decimal(value);
}

function money(value) {
  const [integer, cents] = value.toFixed(2).split('.');
  return `₹${new Intl.NumberFormat('en-IN').format(BigInt(integer))}.${cents}`;
}

function dateLabel(value, withTime = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid statement date');
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
  }).format(date);
}

function validate(statement) {
  if (!statement || statement.timeZone !== 'Asia/Kolkata' || !statement.invoice || !Array.isArray(statement.payments)) {
    throw new Error('Invalid statement data');
  }
  dateLabel(statement.asOf, true);
  dateLabel(statement.invoice.date);
  const total = amount(statement.invoice.total);
  const received = amount(statement.received);
  const balance = amount(statement.balance);
  const excess = amount(statement.excess);
  const paid = statement.payments.reduce((sum, payment) => {
    dateLabel(payment.createdAt, true);
    return sum.plus(amount(payment.amount));
  }, new Decimal(0));
  if (!paid.equals(received)) throw new Error('Statement payments do not match received total');
  const expectedBalance = Decimal.max(total.minus(received), 0);
  const expectedExcess = Decimal.max(received.minus(total), 0);
  if (!expectedBalance.equals(balance) || !expectedExcess.equals(excess)) throw new Error('Statement balance does not match payments');
  const expectedStatus = total.isZero() || received.greaterThanOrEqualTo(total)
    ? 'PAID' : received.isZero() ? 'PAYMENT_DUE' : 'PARTIALLY_PAID';
  if (statement.status !== expectedStatus) throw new Error('Statement payment status does not match totals');
  if (!Number.isSafeInteger(statement.invoice.revisionNumber) || statement.invoice.revisionNumber < 1) {
    throw new Error('Invalid statement revision');
  }
  return { total, received, balance, excess };
}

/** Build a vector statement PDF from one authoritative API snapshot. */
export function buildPaymentStatementPdf(statement, fontFaces) {
  const { total, received, balance, excess } = validate(statement);
  if (!Array.isArray(fontFaces) || !fontFaces.length) throw new Error('Statement fonts are unavailable');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  for (const face of fontFaces) {
    pdf.addFileToVFS(face.file, face.base64);
    pdf.addFont(face.file, 'InvoiceSans', face.style);
  }
  pdf.setFont('InvoiceSans', 'normal');
  pdf.setTextColor(29, 45, 63);
  let y = 23;
  const rule = () => { pdf.setDrawColor(215, 221, 228); pdf.line(LEFT, y, RIGHT, y); y += 7; };
  const ensure = height => {
    if (y + height <= BOTTOM) return;
    pdf.addPage();
    y = 22;
  };
  const line = (label, value) => {
    ensure(9);
    pdf.setFont('InvoiceSans', 'normal');
    pdf.setFontSize(9);
    pdf.text(String(label), LEFT, y);
    pdf.setFont('InvoiceSans', 'semibold');
    pdf.text(String(value), RIGHT, y, { align: 'right' });
    y += 7;
  };

  pdf.setFont('InvoiceSans', 'bold');
  pdf.setFontSize(18);
  pdf.text('Payment Statement', LEFT, y);
  y += 10;
  pdf.setFontSize(9);
  pdf.setFont('InvoiceSans', 'normal');
  pdf.text(`As of ${dateLabel(statement.asOf, true)} IST`, LEFT, y);
  y += 8;
  rule();
  line('Invoice', statement.invoice.number || statement.invoice.id);
  line('Party', statement.invoice.partyName || 'Unspecified party');
  line('Invoice date', dateLabel(statement.invoice.date));
  line('Revision', `Revision ${statement.invoice.revisionNumber}`);
  line('Calculation version', String(statement.invoice.calculationVersion || 1));
  y += 2;
  rule();
  line('Invoice total', money(total));
  line('Received', money(received));
  line('Balance due', money(balance));
  if (excess.greaterThan(0)) line('Excess received', money(excess));
  line('Status', statement.status === 'PAID' ? 'Paid' : statement.status === 'PARTIALLY_PAID' ? 'Partially paid' : 'Payment due');
  y += 3;
  rule();
  pdf.setFont('InvoiceSans', 'bold');
  pdf.setFontSize(11);
  pdf.text('Payment history', LEFT, y);
  y += 9;
  if (!statement.payments.length) {
    pdf.setFont('InvoiceSans', 'normal');
    pdf.setFontSize(9);
    pdf.text('No payments recorded.', LEFT, y);
  }
  for (const payment of statement.payments) {
    const note = payment.note || 'No note';
    const noteLines = pdf.splitTextToSize(note, 105);
    const height = Math.max(15, noteLines.length * 5 + 8);
    ensure(height);
    pdf.setFontSize(9);
    pdf.setFont('InvoiceSans', 'semibold');
    pdf.text(money(amount(payment.amount)), RIGHT, y, { align: 'right' });
    pdf.setFont('InvoiceSans', 'normal');
    pdf.text(`${dateLabel(payment.createdAt, true)} IST`, LEFT, y);
    y += 5;
    pdf.text(noteLines, LEFT, y);
    y += noteLines.length * 5 + 2;
    if (payment.createdBy) {
      pdf.setFontSize(8);
      pdf.text(`Recorded by ${payment.createdBy}`, LEFT, y);
      y += 4;
    }
    y += 3;
    rule();
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFont('InvoiceSans', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(95, 106, 119);
    pdf.text(`Page ${page} of ${pages}`, RIGHT, 289, { align: 'right' });
  }
  return pdf;
}

export async function paymentStatementPdf(statement, { fonts } = {}) {
  const faces = fonts || await loadInvoicePdfFonts();
  const pdf = buildPaymentStatementPdf(statement, faces);
  return { blob: pdf.output('blob'), filename: paymentStatementFilename(statement), pages: pdf.getNumberOfPages() };
}
