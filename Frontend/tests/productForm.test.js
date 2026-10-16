import test from 'node:test';
import assert from 'node:assert/strict';
import { productFormErrors, productPayload, shouldRefreshEntryRate } from '../src/utils/productForm.js';

test('entry rate is not refreshed when the default rate is unchanged (name / finish edit)', () => {
  assert.equal(shouldRefreshEntryRate('64', 64, 64), false);
  assert.equal(shouldRefreshEntryRate('59', 64, 64), false);
  assert.equal(shouldRefreshEntryRate('64', 64, '64.00'), false);
});

test('entry rate is refreshed when the default changed and the entry still uses the old default', () => {
  assert.equal(shouldRefreshEntryRate('64', 64, 70), true);
  assert.equal(shouldRefreshEntryRate('64.00', 64, 70), true);
  assert.equal(shouldRefreshEntryRate('', 64, 70), true);
});

test('a custom entry rate is kept when the default changes', () => {
  assert.equal(shouldRefreshEntryRate('59', 64, 70), false);
  assert.equal(shouldRefreshEntryRate('70', 64, 70), false);
});

test('an invalid new default never refreshes the entry rate', () => {
  assert.equal(shouldRefreshEntryRate('64', 64, undefined), false);
  assert.equal(shouldRefreshEntryRate('64', 64, 'abc'), false);
});

test('blank form reports every field', () => {
  assert.deepEqual(productFormErrors({ stoneType: ' ', finish: '', defaultRate: '' }, []), {
    stoneType: 'Enter the tile or stone name',
    finish: 'Enter the finish',
    defaultRate: 'Enter a rate of 0 or more',
  });
});

test('rate must be a number of 0 or more', () => {
  const form = { stoneType: 'Granite', finish: 'Polished' };
  assert.equal(productFormErrors({ ...form, defaultRate: '-1' }).defaultRate, 'Enter a rate of 0 or more');
  assert.equal(productFormErrors({ ...form, defaultRate: 'abc' }).defaultRate, 'Enter a rate of 0 or more');
  assert.deepEqual(productFormErrors({ ...form, defaultRate: '0' }), {});
  assert.deepEqual(productFormErrors({ ...form, defaultRate: '45.5' }), {});
});

test('names longer than 120 characters are rejected', () => {
  const long = 'x'.repeat(121);
  const errors = productFormErrors({ stoneType: long, finish: long, defaultRate: '1' });
  assert.equal(errors.stoneType, 'Use 120 characters or fewer');
  assert.equal(errors.finish, 'Use 120 characters or fewer');
  assert.deepEqual(productFormErrors({ stoneType: 'x'.repeat(120), finish: 'y', defaultRate: '1' }), {});
});

test('duplicate product and finish is reported under the name (trimmed exact match)', () => {
  const rates = [{ id: 'p1', stoneType: 'Granite', finish: 'Polished', defaultRate: 40 }];
  assert.equal(productFormErrors({ stoneType: ' Granite ', finish: 'Polished ', defaultRate: '5' }, rates).stoneType, 'This product and finish are already saved.');
  assert.deepEqual(productFormErrors({ stoneType: 'granite', finish: 'Polished', defaultRate: '5' }, rates), {});
  assert.deepEqual(productFormErrors({ stoneType: 'Granite', finish: 'Honed', defaultRate: '5' }, rates), {});
});

test('editing skips the edited product in the duplicate check', () => {
  const rates = [
    { id: 'p1', stoneType: 'Granite', finish: 'Polished', defaultRate: 40 },
    { id: 'p2', stoneType: 'Marble', finish: 'Honed', defaultRate: 60 },
  ];
  assert.deepEqual(productFormErrors({ stoneType: 'Granite', finish: 'Polished', defaultRate: '45' }, rates, 'p1'), {});
  assert.equal(productFormErrors({ stoneType: 'Marble', finish: 'Honed', defaultRate: '45' }, rates, 'p1').stoneType, 'This product and finish are already saved.');
});

test('productPayload trims strings and converts the rate', () => {
  assert.deepEqual(productPayload({ stoneType: ' Granite ', finish: ' Polished', defaultRate: ' 42.50 ' }), { stoneType: 'Granite', finish: 'Polished', defaultRate: 42.5 });
});
