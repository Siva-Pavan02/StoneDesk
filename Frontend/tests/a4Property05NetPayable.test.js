// Net payable applies the .75-only rule after raw charges plus loading.
// Group/material display rounding and amount-in-words formatting stay unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { netTotal } from '../src/utils/loadMath.js';
import { genA4Input, runProperty } from './helpers/a4Generators.js';
import { amountInWords, prepareA4Invoice } from '../src/utils/a4InvoiceModel.js';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

test('Feature: unified-a4-bill-format, Property 5: Net payable applies the net-only business rule', async () => {
  await runProperty('Property 5: net payable', rng => genA4Input(rng), input => {
    const model = prepareA4Invoice(input);

    // Net uses raw charges, independently of the displayed material subtotal.

    // Independent raw-charge oracle, without intermediate monetary rounding.
    let rawMaterial = new D(0);
    for (const group of input.groups) {
      for (const entry of group.entries) {
        rawMaterial = rawMaterial.plus(new D(entry.ratePerSqFt).times(entry.lengthFt).times(entry.widthFt).times(entry.quantity));
      }
    }
    const expectedMaterial = rawMaterial.toDecimalPlaces(2, D.ROUND_HALF_UP);
    const expectedNet = new D(netTotal(rawMaterial.plus(input.loadingRoyalty).toNumber()));
    assert.equal(model.totals.materialTotal, expectedMaterial.toFixed(2), 'materialTotal matches round-once oracle');
    assert.equal(model.loadingRoyalty, new D(input.loadingRoyalty).toFixed(2), 'loadingRoyalty is carried unchanged');
    assert.equal(model.totals.netPayable, expectedNet.toFixed(Math.max(2, expectedNet.decimalPlaces())), 'netPayable matches independent oracle');

    // Amount in words is derived from the same net payable.
    assert.equal(model.amountWords, amountInWords(model.totals.netPayable));
    assert.equal(model.amountWords, amountInWords(expectedNet));
  });
});
