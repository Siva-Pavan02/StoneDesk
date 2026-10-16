// Feature: unified-a4-bill-format, Property 4: Material total equals the sum of buyer group Total amounts.
// For any valid A4Model, totals.materialTotal equals (as a Decimal, before display rounding) the
// round-once sum of every buyer-copy group's Total amount: the sum of every group's unrounded entry
// amounts, rounded once to 2 dp half-up.
//
// Why not exact equality with the sum of the printed group Totals: each group.total.amount is itself
// rounded once per group (Req 4.7), while materialTotal rounds the grand sum once (unchanged server
// rule, Req 5.6). Each per-group rounding moves the value by at most 0.005, so
// |materialTotal - Σ group.total.amount| <= 0.005 × groupCount. Exact equality with the sum of the
// rounded group Totals is therefore not guaranteed; the first counterexample found is logged below.
// **Validates: Requirements 5.8**
import test from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { genA4Input, runProperty } from './helpers/a4Generators.js';
import { prepareA4Invoice, projectCopy } from '../src/utils/a4InvoiceModel.js';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const ZERO = new D(0);
const round2 = value => value.toDecimalPlaces(2, D.ROUND_HALF_UP);

test('Feature: unified-a4-bill-format, Property 4: Material total equals the sum of buyer group Total amounts', async () => {
  let roundedSumMismatch = null;

  const runs = await runProperty('Property 4: materialTotal vs group Totals', rng => genA4Input(rng), input => {
    const model = prepareA4Invoice(input);
    const buyer = projectCopy(model, 'buyer');
    const materialTotal = new D(buyer.totals.materialTotal);

    // Round-once sum of every group's unrounded entry amounts on the buyer copy.
    const unroundedGroupSum = buyer.groups.reduce((total, group) =>
      group.entries.reduce((acc, entry) => acc.plus(entry.unroundedAmount), total), ZERO);
    assert.ok(materialTotal.equals(round2(unroundedGroupSum)),
      `materialTotal ${buyer.totals.materialTotal} != round-once group sum ${round2(unroundedGroupSum).toFixed(2)}`);

    // Independent oracle from the raw input (rate × L × W × qty), rounded once.
    const rawSum = input.groups.reduce((total, group) => group.entries.reduce((acc, entry) =>
      acc.plus(new D(entry.ratePerSqFt).times(entry.lengthFt).times(entry.widthFt).times(entry.quantity)), total), ZERO);
    assert.ok(materialTotal.equals(round2(rawSum)),
      `materialTotal ${buyer.totals.materialTotal} != raw input round-once ${round2(rawSum).toFixed(2)}`);

    // The printed group Totals reconcile to materialTotal within per-group rounding tolerance.
    const roundedGroupSum = buyer.groups.reduce((total, group) => total.plus(group.total.amount), ZERO);
    const tolerance = new D('0.005').times(buyer.groups.length);
    const drift = materialTotal.minus(roundedGroupSum).abs();
    assert.ok(drift.lte(tolerance),
      `|materialTotal ${buyer.totals.materialTotal} - Σ group Totals ${roundedGroupSum.toFixed(2)}| = ${drift} > ${tolerance}`);

    if (!roundedGroupSum.equals(materialTotal) && !roundedSumMismatch) {
      roundedSumMismatch = { invoiceNumber: input.invoiceNumber, groups: buyer.groups.length,
        materialTotal: buyer.totals.materialTotal, sumOfGroupTotals: roundedGroupSum.toFixed(2), drift: drift.toString() };
    }
  });

  assert.ok(runs >= 100, `ran ${runs} iterations`);
  if (roundedSumMismatch) {
    console.log('Property 4 note: materialTotal differs from the sum of rounded group Totals (within tolerance):',
      JSON.stringify(roundedSumMismatch));
  }
});
