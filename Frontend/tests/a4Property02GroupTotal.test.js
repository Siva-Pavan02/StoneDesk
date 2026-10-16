// Feature: unified-a4-bill-format, Property 2: Row group Total amount reconciles to Regular plus Top.
// For any group, Total amount equals (Decimal) Regular amount + Top amount, and equals the sum of the
// group's unrounded entry amounts rounded once to 2 dp half-up. Total pieces is the integer sum of
// quantities and Total area is the sum of unrounded entry areas.
// **Validates: Requirements 4.7**
import test from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { genA4Input, runProperty } from './helpers/a4Generators.js';
import { prepareA4Invoice } from '../src/utils/a4InvoiceModel.js';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

test('Feature: unified-a4-bill-format, Property 2: Row group Total amount reconciles to Regular plus Top', async () => {
  await runProperty('Property 2: group Total amount', rng => genA4Input(rng), input => {
    const model = prepareA4Invoice(input);
    const inputById = new Map(input.groups.map(group => [Number(group.id), group]));
    assert.equal(model.groups.length, input.groups.length);

    for (const group of model.groups) {
      const source = inputById.get(group.id);
      assert.ok(source, `group ${group.id} exists in the input`);

      // Independent oracle computed from the raw input entries.
      let pieces = 0, area = new D(0), rawAmount = new D(0);
      for (const entry of source.entries) {
        const entryArea = new D(entry.lengthFt).times(entry.widthFt).times(entry.quantity);
        pieces += entry.quantity;
        area = area.plus(entryArea);
        rawAmount = rawAmount.plus(new D(entry.ratePerSqFt).times(entryArea));
      }
      const expectedAmount = rawAmount.toDecimalPlaces(2, D.ROUND_HALF_UP);

      const total = new D(group.total.amount);
      assert.ok(total.equals(new D(group.regular.amount).plus(group.top.amount)),
        `group ${group.id}: Total ${group.total.amount} != Regular ${group.regular.amount} + Top ${group.top.amount}`);
      assert.ok(total.equals(expectedAmount),
        `group ${group.id}: Total ${group.total.amount} != round-once ${expectedAmount.toFixed(2)}`);
      assert.equal(group.total.amount, expectedAmount.toFixed(2), `group ${group.id}: Total amount has 2 dp`);

      assert.ok(Number.isInteger(group.total.pieces), `group ${group.id}: Total pieces is an integer`);
      assert.equal(group.total.pieces, pieces, `group ${group.id}: Total pieces`);
      assert.equal(group.total.pieces, group.regular.pieces + group.top.pieces, `group ${group.id}: pieces split`);
      assert.ok(new D(group.total.area).equals(area), `group ${group.id}: Total area ${group.total.area} != ${area}`);
    }
  });
});
