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
    // Net payable is rounded once to 2dp half-up before it is printed or spoken.
    const expectedNet2 = expectedNet.toDecimalPlaces(2, D.ROUND_HALF_UP);
    assert.equal(model.totals.materialTotal, expectedMaterial.toFixed(2), 'materialTotal matches round-once oracle');
    assert.equal(model.loadingRoyalty, new D(input.loadingRoyalty).toFixed(2), 'loadingRoyalty is carried unchanged');
    assert.equal(model.totals.netPayable, expectedNet2.toFixed(2), 'netPayable is the 2dp oracle');

    // Amount in words is derived from the same 2dp net payable, so printed total and words agree.
    assert.equal(model.amountWords, amountInWords(model.totals.netPayable));
    assert.equal(model.amountWords, amountInWords(expectedNet2));
  });
});

test('A third-decimal raw net payable prints and is spoken at 2 decimal places that agree', () => {
  // rate 10.001 x 1 x 1 x 1 => raw charge 10.001; netTotal leaves it unchanged (not a .75 case),
  // so calculatedNet carries a third decimal and must be rounded once to 2dp before both outputs.
  const model = prepareA4Invoice({ mode: 'production', currency: 'INR', invoiceNumber: 'NET-3DP',
    invoiceDate: '2026-10-11', status: 'Dispatched', seller: { name: 'Yard' }, party: 'Buyer',
    lorryNumber: 'AP-01', destination: 'City', supervisor: 'Mgr', loadingRoyalty: '0',
    groups: [{ id: 1, entries: [{ id: '1-1', type: 'regular', lengthFt: '1', widthFt: '1', quantity: 1, ratePerSqFt: '10.001' }] }] });

  const rawNet = new D(netTotal(new D('10.001').toNumber()));
  assert.ok(rawNet.decimalPlaces() > 2, 'the raw net payable carries a third decimal');
  const expected = rawNet.toDecimalPlaces(2, D.ROUND_HALF_UP);
  assert.equal(model.totals.netPayable, expected.toFixed(2), 'printed total is 2dp');
  assert.equal(model.totals.netPayable, '10.00');
  assert.match(model.totals.netPayable, /^\d+\.\d{2}$/, 'exactly two decimals printed');
  assert.equal(model.amountWords, amountInWords(expected), 'words derived from the same 2dp net');
  assert.equal(model.amountWords, amountInWords(model.totals.netPayable), 'printed total and words agree');
});
