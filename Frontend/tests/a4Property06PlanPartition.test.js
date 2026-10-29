// Feature: unified-a4-bill-format, Property 6: The page plan partitions every measurement row exactly
// once within the printable area.
// For any valid production A4Model and either copy, the measured planner returns pages whose fragments
// cover each group's entries [0, n) as contiguous, non-overlapping, in-order ranges; groups appear in
// model order; the Reg total / Top total rows appear exactly once per group (on the fragment holding
// the entry they follow); the final section sits on the last page only; and every fragment, and every
// column's summed fragment height plus gaps, fits the capacity of its page.
//
// Heights come from syntheticGeometry (the Node stand-in for the browser measure host), which splits
// oversized groups exactly as a4InvoiceMeasure.js does. Random inputs are forced to production mode;
// the fixed sample is checked separately with its recorded geometry in tests/a4Geometry.test.js.
// **Validates: Requirements 2.5, 7.6, 7.8**
import test from 'node:test';
import assert from 'node:assert/strict';
import { genA4Input, runProperty, syntheticGeometry } from './helpers/a4Generators.js';
import { prepareA4Invoice, projectCopy, sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { calcFragmentHeight, fragmentRows, planFromMeasurements } from '../src/utils/a4InvoicePagination.js';

const TOLERANCE = 0.01;
const COPIES = ['buyer', 'driver'];

function checkPlan(model, copy) {
  const projected = projectCopy(model, copy);
  const geometry = syntheticGeometry(projected, copy);
  const pages = planFromMeasurements(projected, geometry.units, geometry);
  const { gap, normalCapacity, finalCapacity } = geometry;
  const heightOf = new Map(geometry.units.map((unit, index) => [`${unit.group.id}:${unit.from}:${unit.to}`, geometry.heights[index]]));
  assert.ok(Array.isArray(pages) && pages.length >= 1, `${copy}: plan has no pages`);

  // The final section sits on the last page only.
  pages.forEach((page, index) => assert.equal(page.final, index === pages.length - 1,
    `${copy}: page ${index + 1}/${pages.length} final=${page.final}`));

  // Flatten fragments in reading order (page → column → fragment) and check capacities.
  const fragments = [];
  pages.forEach((page, pageIndex) => {
    assert.ok(page.columns.length >= 2 && page.columns.length <= 5, `${copy}: page ${pageIndex + 1} has ${page.columns.length} columns`);
    const capacity = page.final ? finalCapacity : normalCapacity;
    page.columns.forEach((column, columnIndex) => {
      let used = 0;
      column.forEach((fragment, index) => {
        const matching = geometry.units.flatMap((unit, i) => unit.group.id === fragment.group.id ? [geometry.rowLayouts[i]] : []);
        const layout = { head: Math.max(...matching.map(item => item.head)), rows: matching.flatMap(item => item.rows) };
        const height = heightOf.get(`${fragment.group.id}:${fragment.from}:${fragment.to}`) ?? (layout ? calcFragmentHeight(layout, fragment.group, fragment.from, fragment.to) : undefined);
        assert.ok(Number.isFinite(height), `${copy}: group ${fragment.group.id} fragment from ${fragment.from} was not measured`);
        assert.ok(height <= capacity + TOLERANCE,
          `${copy}: fragment group ${fragment.group.id} [${fragment.from},${fragment.to}) height ${height} > page ${pageIndex + 1} capacity ${capacity}`);
        used += height + (index ? gap : 0);
        fragments.push({ ...fragment, pageIndex, columnIndex });
      });
      assert.ok(used <= capacity + TOLERANCE,
        `${copy}: page ${pageIndex + 1} column ${columnIndex + 1} height ${used} > capacity ${capacity}`);
    });
  });

  // Partition: groups in model order, each group's entries covered by contiguous ordered ranges,
  // with each subtotal row rendered exactly once.
  let cursor = 0;
  for (const group of projected.groups) {
    let next = 0;
    const subtotals = { regular: 0, top: 0 };
    while (next < group.entries.length) {
      const fragment = fragments[cursor++];
      assert.ok(fragment, `${copy}: group ${group.id} entries from ${next} are missing from the plan`);
      assert.equal(fragment.group.id, group.id, `${copy}: expected group ${group.id}, found group ${fragment.group.id}`);
      assert.equal(fragment.group, group, `${copy}: fragment for group ${group.id} does not reference the projected group`);
      assert.equal(fragment.from, next, `${copy}: group ${group.id} fragment starts at ${fragment.from}, expected ${next}`);
      assert.ok(fragment.to > fragment.from && fragment.to <= group.entries.length,
        `${copy}: group ${group.id} invalid fragment [${fragment.from},${fragment.to})`);
      for (const row of fragmentRows(group, fragment.from, fragment.to)) if (row.kind === 'sub') subtotals[row.of] += 1;
      next = fragment.to;
    }
    assert.equal(subtotals.regular, group.entries.some(entry => entry.type === 'regular') ? 1 : 0, `${copy}: group ${group.id} Reg total rows`);
    assert.equal(subtotals.top, group.entries.some(entry => entry.type === 'top') ? 1 : 0, `${copy}: group ${group.id} Top total rows`);
  }
  assert.equal(cursor, fragments.length, `${copy}: plan holds ${fragments.length - cursor} extra fragment(s)`);
  return pages;
}

// Mix ordinary invoices with tall groups so splitting across columns and pages is exercised.
function genProductionInput(rng) {
  const tall = rng.bool(0.35);
  const input = tall ? genA4Input(rng, { minGroups: 1, maxGroups: 8, minEntries: 20, maxEntries: 160 }) : genA4Input(rng);
  return { ...input, mode: 'production', status: rng.pick(['Draft', 'Dispatched', 'Delivered']) };
}

test('Feature: unified-a4-bill-format, Property 6: The page plan partitions every measurement row exactly once within the printable area', async () => {
  let splitGroups = 0, multiPage = 0;
  const runs = await runProperty('Property 6: page plan partition', genProductionInput, input => {
    const model = prepareA4Invoice(input);
    for (const copy of COPIES) {
      const pages = checkPlan(model, copy);
      if (pages.length > 1) multiPage++;
      const fragmentsPerGroup = new Map();
      for (const page of pages) for (const column of page.columns) for (const fragment of column) {
        fragmentsPerGroup.set(fragment.group.id, (fragmentsPerGroup.get(fragment.group.id) || 0) + 1);
      }
      for (const count of fragmentsPerGroup.values()) if (count > 1) splitGroups++;
    }
  });
  assert.ok(runs >= 100, `ran ${runs} iterations`);
  assert.ok(splitGroups > 0, 'generator never produced a split group');
  assert.ok(multiPage > 0, 'generator never produced a multi-page plan');
});

test('Feature: unified-a4-bill-format, Property 6: the fixed sample plan partitions rows within the printable area', () => {
  const model = prepareA4Invoice(sampleA4Invoice());
  for (const copy of COPIES) checkPlan(model, copy);
});
