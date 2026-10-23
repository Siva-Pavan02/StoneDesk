import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { summarize } from '../src/utils/loadMath.js';
import { productSummary } from '../src/utils/productSummary.js';
import { productFormErrors } from '../src/utils/productForm.js';
import { loadingTotals } from '../src/utils/loadingListTotals.js';
const require = createRequire(import.meta.url);
const { processInventory, totals } = require('../../Backend/utils/pilotCalculations.js');
const unit = (rate, quantity) => ({ stoneType: 'Basin', finish: '', rateUnit: 'UNIT', ratePerSqFt: rate, measurementRows: [{ quantity, category: 'Regular', rowNo: 1 }] });
test('mixed source rows retain frontend/backend totals and distinct unit prices', () => {
  const source = [unit(2500, 5), unit(2500, 2), unit(3000, 1), { stoneType: 'Granite', finish: 'Polished', ratePerSqFt: 40, measurementRows: [{ lengthFt: 3.5, widthFt: 2, quantity: 3, category: 'TOP', rowNo: 2 }] }];
  const inventory = processInventory(source);
  const summary = totals(inventory, 0);
  assert.equal(summary.totalDispatchVolumeSqFt, 21);
  assert.equal(summary.baseMaterialTotal, 21340);
  const rows = inventory.flatMap(g => g.measurementRows.map(r => ({ ...r, stoneType: g.stoneType, finish: g.finish, ratePerSqFt: g.ratePerSqFt })));
  assert.deepEqual(summarize(rows, 0), summary);
  assert.deepEqual(productSummary({ inventory }).slice(0, 2).map(p => [p.quantity, p.ratePerSqFt]), [[7, 2500], [1, 3000]]);
  assert.equal(productFormErrors({ stoneType: 'Basin', finish: '', rateUnit: 'UNIT', defaultRate: '1' }).finish, undefined);
});
test('backend rejects ambiguous units and preserves legacy stone rows', () => {
  for (const value of ['bad', null, 12]) assert.throws(() => processInventory([{ ...unit(10, 2), rateUnit: value }]), { status: 400 });
  assert.throws(() => processInventory([{ ...unit(10, 2), measurementRows: [{ quantity: 2, rateUnit: 'SQ_FT', lengthFt: 2, widthFt: 3 }] }]), { status: 400 });
  assert.throws(() => processInventory([{ ...unit(10, 2), measurementRows: [], pieces: [{ lengthFt: 2, widthFt: 3 }] }]), { status: 400 });
  const [legacy] = processInventory([{ stoneType: 'Granite', finish: 'Raw', ratePerSqFt: 10, pieces: [{ lengthFt: 2, widthFt: 3 }] }]);
  assert.equal(legacy.lineTotal, 60);
  assert.equal(legacy.totalSqFt, 6);
});
test('unit loading requirements persist without dimensions and retain pending/excess', async () => {
  const prismaPath = require.resolve('../../Backend/utils/prisma.js');
  const previous = require.cache[prismaPath];
  let saved;
  require.cache[prismaPath] = { exports: { loadingList: { create: async ({ data }) => (saved = data) } } };
  const controllerPath = require.resolve('../../Backend/controllers/loadingListController.js');
  delete require.cache[controllerPath];
  try {
    const controller = require(controllerPath);
    const requirements = [{ rateUnit: 'UNIT', requiredQuantity: 5, loadedQuantity: 3 }, { rateUnit: 'UNIT', requiredQuantity: 2, loadedQuantity: 4 }];
    let failure;
    await controller.createLoadingList({ body: { supervisor: 'Manager', buyerDestination: 'Yard', stoneType: 'Basin', finish: 'Raw', requirements }, user: { organizationId: 'test-org' } }, { status() { return this; }, json() {} }, e => { failure = e; });
    assert.equal(failure, undefined);
    assert.equal(saved.requirements[0].lengthFt, undefined);
    assert.deepEqual(loadingTotals(saved.requirements), { required: 7, loaded: 7, pending: 2, excess: 2 });
  } finally { delete require.cache[controllerPath]; if (previous) require.cache[prismaPath] = previous; else delete require.cache[prismaPath]; }
});

test('historical mixed-unit groups keep quantities in their correct summary units', () => {
  const products = productSummary({ inventory: [{ stoneType: 'Product', finish: 'Raw', ratePerSqFt: 10, measurementRows: [{ quantity: 2 }, { quantity: 3, rateUnit: 'UNIT' }] }] });
  assert.deepEqual(products.map(p => [p.quantity, p.rateUnit || 'SQ_FT']), [[2, 'SQ_FT'], [3, 'UNIT']]);
  assert.throws(() => processInventory([{ ...unit(10, 2), measurementRows: [{ quantity: 2, rateUnit: null }] }]), { status: 400 });
});
