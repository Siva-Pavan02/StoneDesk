import test from 'node:test';
import assert from 'node:assert/strict';
import { AREA_ROUNDING_NOTE } from '../src/utils/a4InvoiceModel.js';
import { LANDING_SAMPLE_INPUT, landingSampleHtml, landingSampleModel, landingSamplePage } from '../src/utils/landingSampleInvoice.js';

test('landing sample keeps the published sample totals', () => {
  const model = landingSampleModel();
  assert.equal(model.mode, 'sample');
  assert.deepEqual(model.warnings, []);
  assert.equal(model.totals.pieces, 43);
  assert.equal(model.totals.area, '268.5');
  assert.equal(model.totals.regularAmount, '13440.00');
  assert.equal(model.totals.topAmount, '3744.00');
  assert.equal(model.totals.materialTotal, '17184.00');
  assert.equal(model.loadingRoyalty, '1200.00');
  assert.equal(model.totals.netPayable, '18384.00');
  assert.ok(Object.isFrozen(LANDING_SAMPLE_INPUT.groups[0].entries[0]));
});

const count = (html, pattern) => html.match(pattern)?.length ?? 0;

test('the recorded landing geometry keeps one final page with a group per column', () => {
  const page = landingSamplePage(landingSampleModel());
  assert.equal(page.final, true);
  assert.deepEqual(page.columns.map(column => column.map(fragment => [fragment.group.id, fragment.from, fragment.to])),
    [[[1, 0, 3]], [[2, 0, 3]], [[3, 0, 3]]]);
});

test('landing sample renders the reference A4 buyer copy in sample mode (Req 11.1, 11.3)', () => {
  const html = landingSampleHtml('landing-test');
  assert.equal(count(html, /class="row-block"/g), 3);
  for (const part of ['invoice-summary', 'class="closing"', 'bank-fields', 'Not valid for payment', 'Sample only',
    'Preview placeholders only', 'Order summary', 'Payment summary', 'Amount in words']) {
    assert.ok(html.includes(part), part);
  }
  assert.ok(!html.includes('<main'));
  assert.ok(!/<th[^>]*>\s*Rate/i.test(html));

  // Header once on this single page, with the fictional-data marking and the Manager fact.
  assert.equal(count(html, /<header class="invoice-header">/g), 1);
  assert.equal(count(html, /class="business-name"/g), 1);
  assert.match(html, /<p class="invoice-reference">No\. SAMPLE-001 · Fictional data — not for payment<\/p>/);
  assert.match(html, /<dt>Manager<\/dt><dd>SAMPLE OPERATOR<\/dd>/);

  // Reg total / Top total rows carry pieces and area; measurement rows carry no money.
  assert.equal(count(html, /<tr class="sub" data-subtotal="regular">/g), 3);
  assert.equal(count(html, /<tr class="sub" data-subtotal="top">/g), 3);
  assert.match(html, /<tr class="sub" data-subtotal="regular"><th colspan="5" scope="row">Reg total<\/th><td class="qty">10<\/td><td class="num">70\.00<\/td><\/tr>/);
  assert.match(html, /<tr class="sub" data-subtotal="top"><th colspan="5" scope="row">Top total<\/th><td class="qty">5<\/td><td class="num">22\.50<\/td><\/tr>/);
  assert.doesNotMatch(html, /group-total|data-total-row|data-money="group"|Regular subtotal|Top subtotal/);
  const tables = [...html.matchAll(/<table class="row-table">[\s\S]*?<\/table>/g)].map(match => match[0]);
  assert.equal(tables.length, 3);
  for (const table of tables) assert.ok(!table.includes('₹'), 'measurement tables carry no amount');

  // Frozen totals and a single combined material charge in the payment summary.
  assert.match(html, /<dd data-total="pieces">43<\/dd>/);
  assert.match(html, /<dd data-total="area">268\.50<\/dd>/);
  assert.equal(count(html, /<dt>Material total<\/dt>/g), 2);
  assert.match(html, /<dt>Material total<\/dt><dd data-total="material">₹17,184\.00<\/dd>/);
  assert.match(html, /<dt>Material total<\/dt><dd data-amount="material">₹17,184\.00<\/dd>/);
  assert.match(html, /<dt>Loading \/ royalty<\/dt><dd data-amount="loading">₹1,200\.00<\/dd>/);
  assert.match(html, /<dt>Net payable<\/dt><dd data-total="net">₹18,384\.00<\/dd>/);
  assert.doesNotMatch(html, /Top material amount|data-amount="top"|Material amount/);

  // Every rupee amount sits in an element the A4 stylesheet sets bold.
  for (const match of html.matchAll(/<(?:dd|td)([^>]*)>(?:<span class="sr-only">[^<]*<\/span>)?₹/g)) {
    assert.match(match[1], /data-money=|data-amount=|data-total=/, match[0]);
  }

  // Bracketed bank placeholders in a single dl, in input order.
  assert.equal(count(html, /<dl class="bank-fields"/g), 1);
  const placeholders = [...html.matchAll(/<dd>(\[[^\]<]+\])<\/dd>/g)].map(match => match[1]);
  assert.deepEqual(placeholders, ['[Account holder name]', '[Bank name]', '[Account number]', '[IFSC code]', '[Branch — optional]', '[UPI ID — optional]']);

  // Single page: no footer strip, no continuation note, no area rounding note.
  assert.doesNotMatch(html, /page-foot|>\s*Page 1 of 1|Continued on the next page|unrounded|rounding/i);
  assert.ok(!html.includes(AREA_ROUNDING_NOTE));
});

test('only the dialog variant stacks: sample-pages is added on request', () => {
  assert.match(landingSampleHtml('landing-frame'), /^<div class="a4-invoice" data-sample="landing">/);
  assert.match(landingSampleHtml('landing-dialog', { responsive: true }), /^<div class="a4-invoice sample-pages" data-sample="landing">/);
});

test('different prefixes never share element ids', () => {
  const ids = html => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]));
  const first = ids(landingSampleHtml('landing-showcase'));
  const second = ids(landingSampleHtml('landing-dialog'));
  assert.ok(first.size > 0);
  assert.deepEqual([...first].filter(id => second.has(id)), []);
});
