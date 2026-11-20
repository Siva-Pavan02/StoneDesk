import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INVOICE_FONT_FACES } from '../src/utils/a4InvoiceFonts.js';
import { buildPaymentStatementPdf, paymentStatementFilename } from '../src/utils/paymentStatementPdf.js';

const statement = {
  asOf: '2026-11-20T18:30:00.000Z',
  timeZone: 'Asia/Kolkata',
  invoice: {
    id: '00000000-0000-4000-8000-000000000001',
    number: 'GS/2026/42',
    date: '2026-11-20T00:00:00.000Z',
    partyName: 'Audit Granite',
    revisionNumber: 2,
    calculationVersion: 2,
    total: '1466.75',
  },
  payments: [
    { id: 'pay-1', amount: '500.10', note: 'Bank transfer', createdAt: '2026-11-20T10:00:00.000Z', createdBy: 'Auditor' },
    { id: 'pay-2', amount: '966.65', note: null, createdAt: '2026-11-20T11:00:00.000Z', createdBy: 'Auditor' },
  ],
  received: '1466.75',
  balance: '0.00',
  excess: '0.00',
  status: 'PAID',
};

const fontFaces = INVOICE_FONT_FACES.map(face => ({
  ...face,
  base64: readFileSync(new URL(`../public/fonts/${face.file}`, import.meta.url)).toString('base64'),
}));

test('statement filename uses sanitized invoice number and IST as-of time', () => {
  assert.equal(paymentStatementFilename(statement), 'Payment-Statement-GS-2026-42-20261121-0000-IST.pdf');
});

test('statement PDF contains authoritative totals, payments, version, and IST as-of time', async () => {
  const pdf = buildPaymentStatementPdf(statement, fontFaces);
  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const file = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false, isEvalSupported: false }).promise;
  const pages = [];
  for (let i = 1; i <= file.numPages; i += 1) {
    const page = await file.getPage(i);
    pages.push((await page.getTextContent()).items.map(item => item.str).join(' '));
  }
  const content = pages.join(' ');
  for (const value of ['Payment Statement', 'GS/2026/42', 'Audit Granite', 'Revision 2', '₹1,466.75', '₹500.10', '₹966.65', 'Bank transfer', '21 Nov 2026', 'Paid']) {
    assert.ok(content.includes(value), `${value} is present in the PDF`);
  }
});

test('statement PDF rejects inconsistent totals and malformed amount strings', () => {
  assert.throws(() => buildPaymentStatementPdf({ ...statement, received: '1466.74' }, fontFaces), /payments do not match/i);
  assert.throws(() => buildPaymentStatementPdf({ ...statement, balance: '0.001' }, fontFaces), /Invalid statement/i);
});
