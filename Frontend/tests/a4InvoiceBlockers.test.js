import test from 'node:test';
import assert from 'node:assert/strict';
import { fillFragmentRange, calcFragmentHeight, fragmentRows, planFromMeasurements, wholeGroupUnits } from '../src/utils/a4InvoicePagination.js';

const group = (id, count) => ({ id, entries: Array.from({ length: count }, (_, i) => ({ id: `${id}-${i}`, type: 'regular' })) });
const layout = (unit, height = 10) => ({ head: 10, rows: fragmentRows(unit.group, unit.from, unit.to).map(row => ({ ...row, height })) });
const count = page => page.columns.flat().reduce((sum, f) => sum + f.to - f.from, 0);

test('a final page retains measurements when the unrestricted first page fits every row', () => {
  const model = { groups: [group(1, 24)] }, units = wholeGroupUnits(model);
  const pages = planFromMeasurements(model, units, { normalCapacity: 100, finalCapacity: 50, gap: 0, rowLayouts: units.map(u => layout(u)) });
  assert.equal(pages.length, 2);
  assert.ok(pages.every(p => count(p) > 0));
  assert.equal(pages.reduce((sum, p) => sum + count(p), 0), 24);
});

test('fragment measurements follow group IDs and original rows, including later groups', () => {
  const model = { groups: [group(9, 16), group(42, 4)] };
  const units = [{ group: model.groups[0], from: 0, to: 8 }, { group: model.groups[0], from: 8, to: 16 }, { group: model.groups[1], from: 0, to: 4 }];
  const rows = units.map((u, i) => layout(u, i === 2 ? 25 : 10));
  const pages = planFromMeasurements(model, units, { normalCapacity: 100, finalCapacity: 70, gap: 0, rowLayouts: rows });
  for (const page of pages) for (let i = 0; i < 4; i++) {
    const expected = page.columns[i].reduce((sum, f) => sum + calcFragmentHeight(layout({ group: f.group, from: 0, to: f.group.entries.length }, f.group.id === 42 ? 25 : 10), f.group, f.from, f.to), 0);
    assert.equal(page.used[i], expected);
    assert.ok(expected <= (page.final ? 70 : 100) + .01);
  }
});

test('continuation pages use the reclaimed header capacity', () => {
  const model = { groups: [group(1, 40)] }, units = wholeGroupUnits(model);
  const base = { normalCapacity: 60, finalCapacity: 30, gap: 0, rowLayouts: units.map(u => layout(u)) };
  const cramped = planFromMeasurements(model, units, base);
  const reclaimed = planFromMeasurements(model, units, { ...base, continuationNormalCapacity: 120, continuationFinalCapacity: 100 });
  assert.ok(reclaimed.length < cramped.length);
  assert.equal(reclaimed.length, 2);
  assert.ok(count(reclaimed[1]) > 0);
});

test('strict flow fills the first column even when balancing could avoid a singleton', () => {
  const g = group(1, 8), l = layout({ group: g, from: 0, to: 8 });
  l.rows.find(r => r.index === 7).height = 30;
  const entries = g.entries.map((entry, entryIndex) => ({ group: g, groupIndex: 0, entryIndex, entry }));
  const plan = fillFragmentRange(entries, 0, 8, 100, 0, () => l);
  assert.deepEqual(plan.columns.map(c => c.map(f => [f.from, f.to])), [[[0, 7]], [[7, 8]], [], []]);
  assert.equal(count(plan), 8);
});

for (const copy of ['buyer', 'driver']) {
  test(`${copy}: a fitting serial stays whole and the next serial starts directly below it`, () => {
    const model = { groups: [group(1, 3), group(2, 2)] }, units = wholeGroupUnits(model);
    const pages = planFromMeasurements(model, units, { normalCapacity: 100, finalCapacity: 100, gap: 5, rowLayouts: units.map(u => layout(u)) });
    assert.equal(pages.length, 1);
    assert.deepEqual(pages[0].columns.map(c => c.map(f => [f.group.id, f.from, f.to])), [[[1, 0, 3], [2, 0, 2]], [], [], []]);
    assert.ok(pages[0].columns.flat().every(f => f.from === 0), 'No continuation for fitting serials');
  });

  test(`${copy}: oversized serial fills each column before continuing, keeping its subtotal with its last row`, () => {
    const model = { groups: [group(1, 12), group(2, 2)] }, units = wholeGroupUnits(model);
    const pages = planFromMeasurements(model, units, { normalCapacity: 100, finalCapacity: 100, gap: 5, rowLayouts: units.map(u => layout(u)) });
    assert.deepEqual(pages[0].columns.map(c => c.map(f => [f.group.id, f.from, f.to])), [[[1, 0, 9]], [[1, 9, 12], [2, 0, 2]], [], []]);
    const first = pages[0].columns[0][0];
    assert.ok(calcFragmentHeight(layout(units[0]), first.group, first.from, first.to + 1) > 100);
    const rows = pages[0].columns.flat().filter(f => f.group.id === 1).flatMap(f => fragmentRows(f.group, f.from, f.to));
    assert.equal(rows.filter(r => r.kind === 'sub').length, 1);
    assert.equal(rows.at(-2).index, 11);
    assert.equal(rows.at(-1).kind, 'sub');
  });
}
