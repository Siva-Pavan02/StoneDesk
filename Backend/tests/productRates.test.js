const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateRateUnit,
  normalizeProductRate,
  normalizeStoneRates,
  publicSettings,
} = require('../utils/productRates');

test('validateRateUnit defaults omitted/undefined value to SQ_FT', () => {
  assert.equal(validateRateUnit(undefined), 'SQ_FT');
});

test('validateRateUnit accepts valid SQ_FT and UNIT', () => {
  assert.equal(validateRateUnit('SQ_FT'), 'SQ_FT');
  assert.equal(validateRateUnit('UNIT'), 'UNIT');
});

test('validateRateUnit rejects invalid values with status 400', () => {
  const invalidCases = ['PIECE', 'SINK', 'LINEAR', 'KG', null, '', 123, true, {}, []];
  for (const value of invalidCases) {
    assert.throws(
      () => validateRateUnit(value),
      err => err.status === 400 && err.message === 'Invalid rate unit',
      `Expected ${JSON.stringify(value)} to be rejected with status 400`
    );
  }
});

test('normalizeProductRate defaults missing rateUnit to SQ_FT', () => {
  const legacy = { id: 'p1', stoneType: 'Granite', finish: 'Polished', defaultRate: 40 };
  const normalized = normalizeProductRate(legacy);
  assert.equal(normalized.rateUnit, 'SQ_FT');
  assert.equal(normalized.stoneType, 'Granite');
  assert.equal(normalized.defaultRate, 40);
});

test('normalizeProductRate preserves explicit UNIT and SQ_FT', () => {
  assert.equal(normalizeProductRate({ rateUnit: 'UNIT' }).rateUnit, 'UNIT');
  assert.equal(normalizeProductRate({ rateUnit: 'SQ_FT' }).rateUnit, 'SQ_FT');
});

test('normalizeStoneRates normalizes arrays and handles empty or non-arrays safely', () => {
  assert.deepEqual(normalizeStoneRates(null), []);
  assert.deepEqual(normalizeStoneRates(undefined), []);
  assert.deepEqual(normalizeStoneRates([]), []);

  const rates = [
    { id: '1', stoneType: 'Granite', finish: 'Polished', defaultRate: 50 },
    { id: '2', stoneType: 'Sink', finish: 'Single Bowl', defaultRate: 500, rateUnit: 'UNIT' },
  ];
  const normalized = normalizeStoneRates(rates);
  assert.equal(normalized[0].rateUnit, 'SQ_FT');
  assert.equal(normalized[1].rateUnit, 'UNIT');
});

test('publicSettings normalizes stoneRates on the settings response object', () => {
  const settings = {
    id: 'org1',
    businessName: 'Stone Corp',
    stoneRates: [
      { id: '1', stoneType: 'Granite', finish: 'Polished', defaultRate: 50 },
    ],
  };
  const serialized = publicSettings(settings);
  assert.equal(serialized.stoneRates[0].rateUnit, 'SQ_FT');
  assert.equal(serialized.businessName, 'Stone Corp');
});
