const RATE_UNITS = new Set(['SQ_FT', 'UNIT']);

function validateRateUnit(value) {
  if (value === undefined) return 'SQ_FT';
  if (!RATE_UNITS.has(value)) {
    throw Object.assign(new Error('Invalid rate unit'), { status: 400 });
  }
  return value;
}

function productFinish(value, rateUnit) {
  if (rateUnit === 'UNIT' && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) throw Object.assign(new Error('Invalid finish'), { status: 400 });
  return value.trim();
}

function normalizeProductRate(product) {
  if (!product || typeof product !== 'object') return product;
  return {
    ...product,
    rateUnit: product.rateUnit === undefined
      ? 'SQ_FT'
      : validateRateUnit(product.rateUnit),
  };
}

function normalizeStoneRates(stoneRates) {
  return Array.isArray(stoneRates)
    ? stoneRates.map(normalizeProductRate)
    : [];
}

function publicSettings(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  return {
    ...settings,
    stoneRates: normalizeStoneRates(settings.stoneRates),
  };
}

module.exports = {
  RATE_UNITS,
  productFinish,
  validateRateUnit,
  normalizeProductRate,
  normalizeStoneRates,
  publicSettings,
};
