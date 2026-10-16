// Feature: unified-a4-bill-format, Property 5: Net payable is the unchanged material-plus-loading sum.
// For any valid A4Model, totals.netPayable equals, to 2 dp, totals.materialTotal + loadingRoyalty, and
// amountWords equals amountInWords(netPayable). Regression: the expected net payable is computed
// independently from the raw input (round-once sum of rate × L × W × qty, half-up, plus loading).
// **Validates: Requirements 5.6, 13.4**
import test from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { genA4Input, runProperty } from './helpers/a4Generators.js';
import { amountInWords, prepareA4Invoice } from '../src/utils/a4InvoiceModel.js';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

test('Feature: unified-a4-bill-format, Property 5: Net payable is the unchanged material-plus-loading sum', async () => {
  await runProperty('Property 5: net payable', rng => genA4Input(rng), input => {
    const model = prepareA4Invoice(input);

    // Model-internal identity: net payable = material total + loading / royalty (2 dp).
    const modelSum = new D(model.totals.materialTotal).plus(model.loadingRoyalty).toFixed(2, D.ROUND_HALF_UP);
    assert.equal(model.totals.netPayable, modelSum, 'netPayable equals materialTotal + loadingRoyalty');

    // Independent oracle from the raw input: exact charges summed, rounded once half-up.
    let rawMaterial = new D(0);
    for (const group of input.groups) {
      for (const entry of group.entries) {
        rawMaterial = rawMaterial.plus(new D(entry.ratePerSqFt).times(entry.lengthFt).times(entry.widthFt).times(entry.quantity));
      }
    }
    const expectedMaterial = rawMaterial.toDecimalPlaces(2, D.ROUND_HALF_UP);
    const expectedNet = expectedMaterial.plus(new D(input.loadingRoyalty));
    assert.equal(model.totals.materialTotal, expectedMaterial.toFixed(2), 'materialTotal matches round-once oracle');
    assert.equal(model.loadingRoyalty, new D(input.loadingRoyalty).toFixed(2), 'loadingRoyalty is carried unchanged');
    assert.equal(model.totals.netPayable, expectedNet.toFixed(2), 'netPayable matches independent oracle');

    // Amount in words is derived from the same net payable.
    assert.equal(model.amountWords, amountInWords(model.totals.netPayable));
    assert.equal(model.amountWords, amountInWords(expectedNet));
  });
});
