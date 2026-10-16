// Feature: unified-a4-bill-format, Property 8: Exactly one header on every page, the continuation
// note on every page but the last, and no page footer strip.
// For any valid A4Model and either copy, the rendered HTML carries the reference header exactly once
// per page (business name, reference line, facts incl. MANAGER, status pill), the continuation note
// exactly once on every non-final page and never on the final one, the final section only on the last
// page, and no per-page footer line ("Page N of M", "All amounts in INR", "BUYER INVOICE ·",
// "Dimensions in feet") or area rounding note anywhere.
//
// Random inputs are forced to production mode; the sample invoice is checked once separately. The
// generator is biased toward many groups or tall groups so most cases span two or more pages.
// **Validates: Requirements 3.11, 3.5, 3.6, 3.7, 3.9**
import test from 'node:test';
import assert from 'node:assert/strict';
import { genA4Input, runProperty, syntheticGeometry } from './helpers/a4Generators.js';
import { AREA_ROUNDING_NOTE, prepareA4Invoice, projectCopy, sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { planFromMeasurements } from '../src/utils/a4InvoicePagination.js';
import { continuationText, renderA4Invoice } from '../src/utils/a4InvoiceRender.js';

const COPIES = ['buyer', 'driver'];
const count = (text, pattern) => (text.match(pattern) || []).length;
const FOOTER = /Page \d+ of \d+|All amounts in INR|(BUYER|DRIVER) INVOICE \u00b7|Dimensions in feet|page-foot|group-total|data-total-row/;

function checkHtml(model, pages, copy) {
  const html = renderA4Invoice(model, pages, copy, `p8-${copy}`);
  const sheets = html.split('<article ').slice(1);
  assert.equal(sheets.length, pages.length, `${copy}: HTML sheet count`);
  assert.equal(count(html, /<header class="invoice-header">/g), pages.length, `${copy}: one header per page`);
  assert.equal(count(html, /class="final-section"/g), 1, `${copy}: one final section`);
  assert.ok(sheets.at(-1).includes('class="final-section"'), `${copy}: the final section is on the last page`);
  assert.equal(count(html, /class="continuation"/g), pages.length - 1, `${copy}: continuation notes`);
  assert.ok(!html.includes(AREA_ROUNDING_NOTE), `${copy}: no area rounding note`);
  sheets.forEach((sheet, index) => {
    const last = index === sheets.length - 1;
    for (const marker of [/<header class="invoice-header">/g, /class="business-name"/g, /class="invoice-reference"/g,
      /class="invoice-facts"/g, /<span class="status">/g, /<dt>Manager<\/dt>/g]) {
      assert.equal(count(sheet, marker), 1, `${copy}: HTML page ${index + 1}/${sheets.length} ${marker}`);
    }
    assert.equal(count(sheet, /class="continuation"/g), last ? 0 : 1, `${copy}: page ${index + 1} continuation note`);
    if (!last) assert.ok(sheet.includes(continuationText(copy)), `${copy}: page ${index + 1} continuation text`);
    assert.equal(count(sheet, /class="final-section"/g), last ? 1 : 0, `${copy}: page ${index + 1} final section`);
    assert.doesNotMatch(sheet, FOOTER, `${copy}: HTML page ${index + 1} has a footer strip or a group total row`);
  });
}

function checkModel(base) {
  let multiPage = 0;
  for (const copy of COPIES) {
    const model = projectCopy(base, copy);
    const geometry = syntheticGeometry(model, copy);
    const pages = planFromMeasurements(model, geometry.units, geometry);
    if (pages.length > 1) multiPage++;
    checkHtml(model, pages, copy);
  }
  return multiPage;
}

// Bias toward multi-page bills: tall groups or many groups.
function genMultiPageInput(rng) {
  const input = rng.bool(0.5)
    ? genA4Input(rng, { minGroups: 2, maxGroups: 6, minEntries: 20, maxEntries: 70 })
    : genA4Input(rng, { minGroups: 15, maxGroups: 40, minEntries: 4, maxEntries: 12 });
  return { ...input, mode: 'production', status: rng.pick(['Draft', 'Dispatched', 'Delivered']) };
}

test('Feature: unified-a4-bill-format, Property 8: one header on every page, continuation on non-final pages, no footer strip', async () => {
  let multiPage = 0, cases = 0;
  const runs = await runProperty('Property 8: header per page, no footer', genMultiPageInput, input => {
    multiPage += checkModel(prepareA4Invoice(input));
    cases += COPIES.length;
  });
  assert.ok(runs >= 100, `ran ${runs} iterations`);
  assert.ok(multiPage >= cases / 2, `only ${multiPage} of ${cases} copies spanned 2+ pages`);
});

test('Feature: unified-a4-bill-format, Property 8: the sample invoice repeats its header on every page', () => {
  const multiPage = checkModel(prepareA4Invoice(sampleA4Invoice()));
  assert.equal(multiPage, COPIES.length, 'sample spans several pages for both copies');
});
