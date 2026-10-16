// Feature: unified-a4-bill-format, Property 7: Every output draws the same plan.
// For any valid A4Model and either copy, the page plan is consumed unchanged by the HTML preview and
// by the standalone print document: same page count, the same ordered { group id, from, to } fragments
// in the same column of the same page, and the final section on the same last page. The vector PDF is
// drawn from this very markup in the browser (one measured plan per copy), so its parity is checked
// in the browser PDF check instead of here.
// **Validates: Requirements 2.5, 2.1, 2.2, 2.4**
import test from 'node:test';
import assert from 'node:assert/strict';
import { genA4Input, runProperty, syntheticGeometry } from './helpers/a4Generators.js';
import { prepareA4Invoice, projectCopy, sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { planFromMeasurements } from '../src/utils/a4InvoicePagination.js';
import { renderA4Invoice, renderStandaloneA4Invoice } from '../src/utils/a4InvoiceRender.js';

const COPIES = ['buyer', 'driver'];
const CSS = '.a4-body{margin:0}';

// Plan shape compared across outputs: per page, per column, ordered { id, from, to }, plus final.
const shape = pages => pages.map(page => ({
  columns: page.columns.map(column => column.map(({ group, from, to }) => ({ id: String(group.id), from, to }))),
  final: Boolean(page.final),
}));

// ---- HTML read-back ------------------------------------------------------------------------

// Each page is one <article class="paper sample-sheet" data-page="n">, each measurement column a
// <div class="detail-column">, each fragment a <section class="row-block" data-group data-from data-to>.
function htmlShape(html) {
  const pages = html.split('<article ').slice(1);
  return pages.map(page => {
    const columns = page.split('<div class="detail-column">').slice(1).map(column =>
      [...column.matchAll(/data-group="([^"]+)" data-from="(\d+)" data-to="(\d+)"/g)]
        .map(([, id, from, to]) => ({ id, from: Number(from), to: Number(to) })));
    // A page with no measurement rows renders no columns at all; the plan still has three.
    while (columns.length < 3) columns.push([]);
    return { columns, final: page.includes('class="final-section"') };
  });
}

function checkParity(model, copy) {
  const copyModel = projectCopy(model, copy);
  const geometry = syntheticGeometry(copyModel, copy);
  const plan = planFromMeasurements(copyModel, geometry.units, geometry);
  const expected = shape(plan);

  // Deterministic: the same measurements produce the same plan.
  assert.deepEqual(shape(planFromMeasurements(copyModel, geometry.units, geometry)), expected, `${copy}: the planner is not deterministic`);

  // HTML preview.
  const html = renderA4Invoice(copyModel, plan, copy);
  const fromHtml = htmlShape(html);
  assert.deepEqual(fromHtml, expected, `${copy}: HTML preview structure differs from the plan`);

  // Print document: the same invoice markup inside the standalone page.
  const standalone = renderStandaloneA4Invoice(copyModel, plan, CSS, copy);
  assert.ok(standalone.includes(html), `${copy}: print document does not embed the preview markup`);
  assert.deepEqual(htmlShape(standalone), fromHtml, `${copy}: print structure differs from the preview`);

  // Page numbering and counts come from the same plan.
  assert.equal(Number(html.match(/data-page-count="(\d+)"/)[1]), plan.length, `${copy}: data-page-count`);
  assert.deepEqual([...html.matchAll(/data-page="(\d+)"/g)].map(match => Number(match[1])),
    plan.map((page, index) => index + 1), `${copy}: page numbers`);
  return plan;
}

// Moderate inputs keep the loop fast; tall groups bias toward splits and multi-page plans.
function genProductionInput(rng) {
  const tall = rng.bool(0.5);
  const input = tall ? genA4Input(rng, { minGroups: 1, maxGroups: 6, minEntries: 15, maxEntries: 90 }) : genA4Input(rng, { maxGroups: 30 });
  return { ...input, mode: 'production', status: rng.pick(['Draft', 'Dispatched', 'Delivered']) };
}

test('Feature: unified-a4-bill-format, Property 7: Every output draws the same plan', async () => {
  let multiPage = 0, split = 0;
  const runs = await runProperty('Property 7: preview/print plan parity', genProductionInput, input => {
    const model = prepareA4Invoice(input);
    for (const copy of COPIES) {
      const plan = checkParity(model, copy);
      if (plan.length > 1) multiPage++;
      if (plan.some(page => page.columns.some(column => column.some(fragment => fragment.from > 0)))) split++;
    }
  });
  assert.ok(runs >= 100, `ran ${runs} iterations`);
  assert.ok(multiPage > 0, 'generator never produced a multi-page plan');
  assert.ok(split > 0, 'generator never produced a split group');
});

test('Feature: unified-a4-bill-format, Property 7: the fixed sample plan is identical in the preview and the print document', () => {
  const model = prepareA4Invoice(sampleA4Invoice());
  for (const copy of COPIES) {
    const plan = checkParity(model, copy);
    assert.ok(plan.length >= 2, `${copy}: the 24-group sample spans several pages`);
  }
});
