// Feature: unified-a4-bill-format, Property 3: Material total equals Regular plus Top amount
// For any valid A4Model, totals.materialTotal equals (Decimal) totals.regularAmount + totals.topAmount.
// **Validates: Requirements 5.5**
import test from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { genA4Input, runProperty } from './helpers/a4Generators.js';
import { prepareA4Invoice } from '../src/utils/a4InvoiceModel.js';

const MONEY = /^-?\d+\.\d{2}$/;

test('Feature: unified-a4-bill-format, Property 3: Material total equals Regular plus Top amount', async () => {
  const runs = await runProperty('Property 3: Material total equals Regular plus Top amount',
    rng => genA4Input(rng),
    input => {
      const { totals } = prepareA4Invoice(input);
      for (const key of ['materialTotal', 'regularAmount', 'topAmount']) {
        assert.match(totals[key], MONEY, `${key} must be a two-decimal amount, got ${totals[key]}`);
      }
      const sum = new Decimal(totals.regularAmount).plus(totals.topAmount);
      assert.ok(new Decimal(totals.materialTotal).equals(sum),
        `materialTotal ${totals.materialTotal} !== regularAmount ${totals.regularAmount} + topAmount ${totals.topAmount} (${sum.toFixed(2)})`);
    });
  assert.ok(runs >= 100);
});
