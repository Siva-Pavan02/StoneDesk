import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildA4InvoiceSample } from '../scripts/a4InvoiceSample.mjs';
import { AREA_ROUNDING_NOTE, prepareA4Invoice, sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { SAMPLE_24_GEOMETRY, recordedSamplePages } from '../src/utils/a4InvoiceSampleGeometry.js';
import { landingSampleHtml, landingSampleModel } from '../src/utils/landingSampleInvoice.js';

const REGENERATE = 'Public_Sample needs regeneration — run npm run invoice:sample';
// The agreed distribution recorded in .agents/tasks/reference-invoice-format FEAT-000:
// two A4 pages, groups 1-15 as 5/5/5 then 16-24 as 3/3/3 with the final section.
const PAGE_COUNT = 2;
const count = (html, pattern) => (html.match(pattern) || []).length;

// Req 11.4: the committed public sample must equal freshly rendered output.
test('committed public sample matches freshly rendered output (Req 11.4)', async () => {
  const css = await readFile(new URL('../src/styles/a4Invoice.css', import.meta.url), 'utf8');
  const committed = await readFile(new URL('../public/sample_invoice_24_rows.html', import.meta.url), 'utf8');
  const { warnings, html } = buildA4InvoiceSample(sampleA4Invoice(), css);
  assert.deepEqual(warnings, [], `Sample model warns: ${warnings.join('; ')}`);
  assert.ok(committed === html, REGENERATE);

  // The recorded geometry and the committed file can never drift apart: the expected
  // page/column distribution comes from the recorded plan, the page count is pinned.
  const pages = recordedSamplePages(prepareA4Invoice(sampleA4Invoice()), SAMPLE_24_GEOMETRY);
  assert.equal(pages.length, PAGE_COUNT, 'the recorded sample plan keeps the agreed page count');
  const planned = pages.map(page => page.columns.map(column => column.map(fragment => fragment.group.id)));
  assert.deepEqual(planned, [[[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12, 13, 14, 15]], [[16, 17, 18], [19, 20, 21], [22, 23, 24]]]);
  const sheets = html.split('<article ').slice(1);
  assert.equal(sheets.length, PAGE_COUNT);
  assert.deepEqual(sheets.map(sheet => sheet.split('<div class="detail-column">').slice(1)
    .map(column => [...column.matchAll(/data-group="([^"]+)"/g)].map(match => Number(match[1])))), planned);
  assert.equal(html.match(/data-page-count="(\d+)"/)[1], String(PAGE_COUNT));
  assert.equal(html.match(/data-group-count="(\d+)"/)[1], '24');

  // Reference format: the header with the Manager fact on every page, the continuation
  // note on every page but the last, the final section only on the last.
  for (const sheet of sheets) {
    assert.equal(count(sheet, /<header class="invoice-header">/g), 1);
    assert.match(sheet, /<dt>Manager<\/dt><dd>SAMPLE<\/dd>/);
  }
  assert.equal(count(html, /class="continuation"/g), PAGE_COUNT - 1);
  assert.match(html, /Continued on the next page\. Order totals and payment summary appear on the final page\./);
  assert.equal(count(html, /class="final-section"/g), 1);
  assert.ok(sheets.at(-1).includes('class="final-section"'));
  // Reg total / Top total rows, one pair per group, and no amount in a measurement row.
  assert.equal(count(html, /data-subtotal="regular"/g), 24);
  assert.equal(count(html, /data-subtotal="top"/g), 24);
  const tables = [...html.matchAll(/<table class="row-table">[\s\S]*?<\/table>/g)].map(match => match[0]);
  assert.equal(tables.length, 24);
  for (const table of tables) assert.ok(!table.includes('₹'), 'measurement tables carry no amount');

  // Regenerated file: language declared; no footer, page strip or rounding note.
  assert.match(html, /<html[^>]*\slang="en[^"]*"/);
  assert.doesNotMatch(html, /class="page-foot"|Page \d+ of \d+|group-total|data-total-row|Material amount/);
  assert.ok(!html.includes(AREA_ROUNDING_NOTE));
});

// Req 11.3: landing sample keeps its frozen totals.
test('landing sample keeps frozen totals (Req 11.3)', () => {
  const { totals, loadingRoyalty, warnings } = landingSampleModel();
  assert.deepEqual(warnings, []);
  assert.equal(totals.pieces, 43);
  assert.equal(Number(totals.area), 268.5);
  assert.equal(totals.regularAmount, '13440.00');
  assert.equal(totals.topAmount, '3744.00');
  assert.equal(totals.materialTotal, '17184.00');
  assert.equal(loadingRoyalty, '1200.00');
  assert.equal(totals.netPayable, '18384.00');

  const html = landingSampleHtml('public-sample-test');
  assert.match(html, /<dd data-total="pieces">43<\/dd>/);
  assert.match(html, /<dd data-amount="material">₹17,184\.00<\/dd>/);
  assert.match(html, /<dd data-amount="loading">₹1,200\.00<\/dd>/);
  assert.match(html, /<dd data-total="net">₹18,384\.00<\/dd>/);
});
