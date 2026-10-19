import test from 'node:test';
import assert from 'node:assert/strict';
import { productSummary } from '../src/utils/productSummary.js';
import { a4InvoiceFromDispatch, projectCopy } from '../src/utils/a4InvoiceModel.js';
import { renderA4Invoice, renderA4Pages, renderA4MeasureSheet, renderStandaloneA4Invoice } from '../src/utils/a4InvoiceRender.js';
import { wholeGroupUnits } from '../src/utils/a4InvoicePagination.js';
import { planSynthetic } from './helpers/a4Generators.js';

const group = (rate, rows, extra = {}) => ({ stoneType: 'Black Granite', finish: 'Polished', ratePerSqFt: rate,
  measurementRows: rows.map(([quantity, category = 'Regular']) => ({ lengthFt: 3, widthFt: 2, quantity, category })), ...extra });
const inventory = () => [group(40, [[12], [8, 'TOP']]), group(45, [[15]]), group('40.00', [[3]])];

test('products merge by stone, finish and numeric rate, including Regular and TOP quantities', () => {
  const dispatch = { inventory: inventory() }, before = structuredClone(dispatch);
  assert.deepEqual(productSummary(dispatch), [
    { stoneType: 'Black Granite', finish: 'Polished', quantity: 23, ratePerSqFt: 40 },
    { stoneType: 'Black Granite', finish: 'Polished', quantity: 15, ratePerSqFt: 45 },
  ]);
  assert.deepEqual(dispatch, before);
  assert.equal(productSummary({ inventory: [group(40, [[1]]), group(40, [[2]], { finish: 'Unpolished' }), group(40, [[3]], { stoneType: 'Marble' })] }).length, 3);
});

test('legacy pieces count once each and merge with matching measured products', () => {
  assert.deepEqual(productSummary({ inventory: [group(40, [[2, 'TOP']]), group(40, [], { pieces: [{ quantity: 99 }, {}, {}] })] }),
    [{ stoneType: 'Black Granite', finish: 'Polished', quantity: 5, ratePerSqFt: 40 }]);
});

test('Buyer preview, PDF markup, print and measurement share summary; Driver carries no product rates', () => {
  const record = { status: 'Dispatched', date: '2026-10-11', dispatchSlipNumber: 'GS-test', partyName: 'Buyer', supervisor: 'Manager',
    logistics: { truckNumber: 'AP01', buyerDestination: 'Kadapa' }, businessSnapshot: { businessName: 'StoneDesk' },
    inventory: inventory(), summary: { loadingAndRoyaltyFees: 0 } };
  const model = a4InvoiceFromDispatch(record), pages = planSynthetic(model);
  const preview = renderA4Invoice(model, pages);
  const section = html => html.match(/<section class="product-summary"[\s\S]*?<\/section>/)?.[0];
  const expected = section(preview);
  assert.ok(expected);
  assert.match(expected, /Black Granite · Polished/);
  assert.match(expected, /23 pcs/);
  assert.match(expected, /15 pcs/);
  assert.match(expected, /₹40\/sq ft/);
  assert.match(expected, /₹45\/sq ft/);
  assert.equal(section(renderA4Pages(model, pages)), expected, 'PDF uses the same page renderer');
  assert.equal(section(renderStandaloneA4Invoice(model, pages, '.a4-invoice{}')), expected);
  assert.equal(section(renderA4MeasureSheet(model, 'buyer', wholeGroupUnits(model), 'document')), expected, 'pagination measures the extra summary height');
  assert.ok(preview.indexOf('product-summary') > preview.indexOf('detail-columns'));
  assert.ok(preview.indexOf('product-summary') < preview.indexOf('order-overview'));
  const driver = projectCopy(model, 'driver');
  assert.equal(driver.products, undefined);
  assert.doesNotMatch(renderA4Invoice(driver, planSynthetic(driver, 'driver'), 'driver'), /product-summary|₹|\/sq ft/);
  const escaped = a4InvoiceFromDispatch({ ...record, inventory: [group(40, [[1]], { stoneType: '<img src=x>', finish: '<script>' })] });
  const html = section(renderA4Invoice(escaped, planSynthetic(escaped)));
  assert.match(html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(html, /<img|<script/);
});
