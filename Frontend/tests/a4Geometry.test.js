import test from 'node:test';
import assert from 'node:assert/strict';
import {
  A4, balancedRange, capacitiesFrom, fillColumns, fragmentRows, pagesFromPlan, planFromMeasurements, planPages,
  splitOversizedUnits, validateA4Pages, wholeGroupUnits,
} from '../src/utils/a4InvoicePagination.js';
import { prepareA4Invoice, projectCopy, sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { LANDING_SAMPLE_GEOMETRY, SAMPLE_24_GEOMETRY, recordedSamplePages } from '../src/utils/a4InvoiceSampleGeometry.js';
import { LANDING_SAMPLE_INPUT } from '../src/utils/landingSampleInvoice.js';

const ids = plan => plan.map(page => page.columns);
const equal = (count, h = 100) => Array(count).fill(h);
const entries = types => types.map((type, i) => ({ id: `e${i}`, type }));
const group = (id, types) => ({ id, entries: entries(types) });
const model = groups => ({ groups });

test('A4 constants follow the reference: 12 mm margins, 186 × 272.5 mm content box', () => {
  assert.deepEqual({ ...A4 }, { widthMm: 210, heightMm: 297, marginMm: 12, contentWidthMm: 186, pageHeightMm: 272.5, safetyPx: 2 });
});

test('fillColumns fills column 1, then 2, then 3, then 4 with the gap between groups', () => {
  const result = fillColumns(equal(7), 0, 7, 300, 10);
  assert.deepEqual(result.columns, [[0, 1], [2, 3], [4, 5], [6]]);
  assert.deepEqual(result.used, [210, 210, 210, 100]);
  assert.equal(result.end, 7);
  // +0.01 tolerance
  assert.equal(fillColumns([100, 100], 0, 2, 209.995, 10).columns[0].length, 2);
  assert.equal(fillColumns([100, 100], 0, 2, 209.98, 10).columns[0].length, 1);
  assert.deepEqual(fillColumns(equal(3), 1, 3, 0, 8), { columns: [[], [], [], []], used: [0, 0, 0, 0], end: 1 });
});

test('balancedRange balances the columns and returns null when the range does not fit', () => {
  const sizes = range => range.columns.map(column => column.length);
  assert.equal(balancedRange(equal(10), 0, 10, 300, 8), null);
  assert.deepEqual(sizes(balancedRange(equal(7), 0, 7, 1000, 8)), [2, 2, 2, 1]);
  assert.deepEqual(sizes(balancedRange(equal(5), 0, 5, 1000, 8)), [2, 2, 1, 0]);
  assert.deepEqual(sizes(balancedRange(equal(12), 0, 12, 1000, 8)), [3, 3, 3, 3]);
  assert.deepEqual(balancedRange(equal(3), 2, 2, 500, 8), fillColumns(equal(3), 2, 2, 500, 8));
});

test('planPages rejects invalid input with the reference messages', () => {
  assert.throws(() => planPages('x', 100, 50, 8), /Invalid group measurements/);
  assert.throws(() => planPages([10, NaN], 100, 50, 8), /Invalid group measurements/);
  assert.throws(() => planPages([10, 0], 100, 50, 8), /Invalid group measurements/);
  assert.throws(() => planPages([10], 0, 50, 8), /Invalid page measurements/);
  assert.throws(() => planPages([10], 100, -1, 8), /Invalid page measurements/);
  assert.throws(() => planPages([10], 100, 50, -1), /Invalid page measurements/);
  assert.throws(() => planPages([150], 100, 50, 8), /A measurement group is taller than a usable column/);
});

test('24 equal groups reproduce the reference distribution 4/4/4, 3/3/1, 2/2/1', () => {
  const plan = planPages(equal(24, 176), 889, 650, 8);
  assert.deepEqual(ids(plan), [
    [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]],
    [[16, 17], [18, 19], [20, 21], [22, 23]],
  ]);
  assert.deepEqual(plan.map(page => page.final), [false, true]);
});

test('24 equal groups at the app metrics (6 px gap) pack 5/5/5 then 3/3/3', () => {
  const plan = planPages(equal(24, 176), 912, 724, 6);
  assert.deepEqual(ids(plan), [
    [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19]],
    [[20], [21], [22], [23]],
  ]);
  assert.deepEqual(plan.map(page => page.final), [false, true]);
});

test('planPages: single final page, summary-only final page, 3+ pages; used never exceeds capacity', () => {
  const one = planPages(equal(4), 889, 650, 8);
  assert.equal(one.length, 1);
  assert.equal(one[0].final, true);
  const alone = planPages([500, 500], 889, 100, 8);
  assert.deepEqual(ids(alone), [[[0], [1], [], []], [[], [], [], []]]);
  assert.deepEqual(alone.map(page => page.final), [false, true]);
  const long = planPages(Array.from({ length: 90 }, (_, i) => 60 + (i * 37) % 120), 889, 600, 8);
  assert.ok(long.length >= 3);
  assert.deepEqual(long.flatMap(page => page.columns.flat()), Array.from({ length: 90 }, (_, i) => i));
  long.forEach(page => page.used.forEach(used => assert.ok(used <= (page.final ? 600 : 889) + 0.01)));
});

test('capacitiesFrom uses the reference formula', () => {
  assert.deepEqual(capacitiesFrom({ pageHeight: 1000, headerHeight: 100, noticeHeight: 20, finalHeight: 200 }), { normalCapacity: 878, finalCapacity: 698 });
  assert.deepEqual(capacitiesFrom({ pageHeight: 1000, headerHeight: 100, noticeHeight: 20, finalHeight: 200, safety: 0 }), { normalCapacity: 880, finalCapacity: 700 });
});

test('fragmentRows places Reg total after the last Regular entry and Top total after the last entry', () => {
  const kinds = rows => rows.map(row => row.kind === 'entry' ? row.index : row.of);
  const mixed = group(1, ['regular', 'regular', 'top', 'top']);
  assert.deepEqual(kinds(fragmentRows(mixed, 0, 4)), [0, 1, 'regular', 2, 3, 'top']);
  assert.deepEqual(kinds(fragmentRows(mixed, 0, 1)), [0]);
  assert.deepEqual(kinds(fragmentRows(mixed, 1, 3)), [1, 'regular', 2]);
  assert.deepEqual(kinds(fragmentRows(group(2, ['top', 'top']), 0, 2)), [0, 1, 'top']);
  assert.deepEqual(kinds(fragmentRows(group(3, ['regular', 'regular']), 0, 2)), [0, 1, 'regular']);
  assert.throws(() => fragmentRows(mixed, 2, 2));
  assert.throws(() => fragmentRows(mixed, 0, 5));
});

test('splitOversizedUnits splits only oversized units, keeps subtotals with their entry and throws when one entry cannot fit', () => {
  const big = group(1, ['regular', 'regular', 'regular', 'top', 'top']);
  const small = group(2, ['regular']);
  const units = [{ group: big, from: 0, to: 5 }, { group: small, from: 0, to: 1 }];
  const layout = { head: 30, rows: fragmentRows(big, 0, 5).map(row => ({ height: 20, ...(row.kind === 'entry' ? { kind: 'entry', index: row.index } : { kind: 'sub', of: row.of }) })) };
  // 30 + 7 rows × 20 = 170 > capacity 100: at most 3 rows (subtotals included) per fragment.
  // [0, 3) would be 4 rows (entries 0-2 + Reg total) = 110, so the cut is 0-1 | 2, Reg total, 3 | 4, Top total.
  const parts = splitOversizedUnits(units, [170, 50], [layout, null], 100);
  assert.deepEqual(parts.map(({ group: g, from, to }) => [g.id, from, to]), [[1, 0, 2], [1, 2, 4], [1, 4, 5], [2, 0, 1]]);
  for (const part of parts.slice(0, 2)) assert.ok(30 + fragmentRows(big, part.from, part.to).length * 20 <= 100);
  assert.throws(() => splitOversizedUnits(units, [170, 50], [{ head: 90, rows: layout.rows }, null], 100), /taller than a usable column/);
});

test('validateA4Pages rejects missing, duplicated, out-of-order fragments and a misplaced final page', () => {
  const groups = [group(1, ['regular', 'top']), group(2, ['regular'])];
  const m = model(groups);
  const f = (g, from, to) => ({ group: groups[g], from, to });
  const ok = [{ columns: [[f(0, 0, 1)], [f(0, 1, 2)], [], []], final: false }, { columns: [[f(1, 0, 1)], [], [], []], final: true }];
  assert.equal(validateA4Pages(m, ok), ok);
  const bad = [
    [{ columns: [[f(0, 0, 2)], [], [], []], final: true }],
    [{ columns: [[f(0, 0, 2), f(1, 0, 1), f(1, 0, 1)], [], [], []], final: true }],
    [{ columns: [[f(1, 0, 1), f(0, 0, 2)], [], [], []], final: true }],
    [{ columns: [[f(0, 0, 1)], [], [], []], final: false }, { columns: [[f(1, 0, 1)], [], [], []], final: true }],
    [{ columns: [[f(0, 0, 2)], [], [], []], final: true }, { columns: [[f(1, 0, 1)], [], [], []], final: false }],
    [{ columns: [[f(0, 0, 2), f(1, 0, 1)], [], []], final: true }],
  ];
  for (const pages of bad) assert.throws(() => validateA4Pages(m, pages), /Group ordering or completeness check failed/);
});

// The recorded Chrome geometry of the two fixed samples must keep reproducing the
// agreed distribution (.agents/tasks/reference-invoice-format FEAT-000): two pages,
// groups 1-20 as 5/5/5/5, then 21-24 as 1/1/1/1 with the final section.
test('recorded sample geometry reproduces the agreed distribution and a single landing page', () => {
  const sample = prepareA4Invoice(sampleA4Invoice());
  for (const copy of ['buyer', 'driver']) {
    const view = projectCopy(sample, copy);
    const pages = recordedSamplePages(view, SAMPLE_24_GEOMETRY, copy);
    assert.equal(pages.length, 2, `${copy}: page count`);
    assert.deepEqual(pages.map(page => page.columns.map(column => column.map(fragment => fragment.group.id))), [
      [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12, 13, 14, 15], [16, 17, 18, 19, 20]],
      [[21], [22], [23], [24]],
    ], `${copy}: distribution`);
    assert.deepEqual(pages.map(page => page.final), [false, true]);
    // Nothing is clipped: every column stays inside the capacity it was planned for.
    const { heights, gap, normalCapacity, finalCapacity } = SAMPLE_24_GEOMETRY[copy];
    pages.forEach(page => page.columns.forEach(column => {
      const used = column.reduce((sum, fragment, index) => sum + heights[fragment.group.id - 1] + (index ? gap : 0), 0);
      assert.ok(used <= (page.final ? finalCapacity : normalCapacity) + 0.01, `${copy}: column height ${used}`);
    }));
  }
  const landing = prepareA4Invoice(structuredClone(LANDING_SAMPLE_INPUT));
  const landingPages = recordedSamplePages(landing, LANDING_SAMPLE_GEOMETRY);
  assert.equal(landingPages.length, 1);
  assert.equal(landingPages[0].final, true);
  assert.deepEqual(landingPages[0].columns.map(column => column.map(fragment => fragment.group.id)), [[1], [2], [3], []]);
  assert.throws(() => recordedSamplePages(landing, LANDING_SAMPLE_GEOMETRY, 'driver'), /No recorded sample geometry/);
});

test('planFromMeasurements round trip on the 24-group sample', () => {
  const sample = prepareA4Invoice(sampleA4Invoice());
  const units = wholeGroupUnits(sample);
  const pages = planFromMeasurements(sample, units, { heights: equal(24, 176), normalCapacity: 889, finalCapacity: 650, gap: 8 });
  assert.deepEqual(pages.map(page => page.columns.map(column => column.map(fragment => fragment.group.id))), [
    [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]],
    [[17, 18], [19, 20], [21, 22], [23, 24]],
  ]);
  assert.ok(pages.flatMap(page => page.columns.flat()).every(fragment => fragment.from === 0 && fragment.to === 7));
  assert.deepEqual(pagesFromPlan(units, [{ columns: [[0], [], [], []], final: true }]), [{ columns: [[units[0]], [], [], []], final: true }]);
  assert.throws(() => planFromMeasurements(sample, units, { heights: equal(23), normalCapacity: 889, finalCapacity: 650, gap: 8 }), /Invalid group measurements/);
});
