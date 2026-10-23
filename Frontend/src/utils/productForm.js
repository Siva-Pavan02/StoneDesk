// Validation and payload for the quick add / edit product form in New load. Mirrors the server checks in
// masterSettingsController addStoneRate and updateStoneRate (required strings up to 120 characters,
// rate >= 0, trimmed duplicate check, rateUnit). exceptId: the product being edited, skipped by the duplicate check.
const MAX_LENGTH = 120;
const TOO_LONG = 'Use 120 characters or fewer';

export const RATE_UNITS = Object.freeze({
  SQ_FT: 'SQ_FT',
  UNIT: 'UNIT',
});

export const productRateUnit = product =>
  product?.rateUnit === 'UNIT' ? 'UNIT' : 'SQ_FT';

export const productRateSuffix = product =>
  productRateUnit(product) === 'UNIT' ? '/ unit' : '/ sq ft';

export function productFormErrors(form = {}, stoneRates = [], exceptId) {
  const errors = {};
  const stoneType = String(form.stoneType ?? '').trim();
  const finish = String(form.finish ?? '').trim();
  const rateText = String(form.defaultRate ?? '').trim();
  const rate = Number(rateText);
  const rateUnit = form.rateUnit;
  if (!stoneType) errors.stoneType = 'Enter the tile or stone name';
  else if (stoneType.length > MAX_LENGTH) errors.stoneType = TOO_LONG;
  if (!finish && rateUnit !== 'UNIT') errors.finish = 'Enter the finish';
  else if (finish.length > MAX_LENGTH) errors.finish = TOO_LONG;
  if (!rateText || !Number.isFinite(rate) || rate < 0) errors.defaultRate = 'Enter a rate of 0 or more';
  if (rateUnit !== undefined && rateUnit !== 'SQ_FT' && rateUnit !== 'UNIT') errors.rateUnit = 'Select a valid rate unit';
  if (!errors.stoneType && !errors.finish && (stoneRates || []).some(p => p.id !== exceptId && String(p.stoneType ?? '').trim() === stoneType && String(p.finish ?? '').trim() === finish))
    errors.stoneType = 'This product and finish are already saved.';
  return errors;
}

// After a product edit: should the New load entry that uses it take the new default rate?
// Only when the default actually changed and the entry still holds the old default (or is blank),
// so a hand-typed rate is never overwritten. Compared numerically: the entry rate is a string.
export function shouldRefreshEntryRate(entryRate, previousRate, nextRate) {
  const next = Number(nextRate);
  if (nextRate === null || nextRate === undefined || nextRate === '' || !Number.isFinite(next)) return false;
  if (next === Number(previousRate)) return false;
  const text = String(entryRate ?? '').trim();
  return text === '' || Number(text) === Number(previousRate);
}

export const productPayload = form => ({
  stoneType: String(form.stoneType ?? '').trim(),
  finish: String(form.finish ?? '').trim(),
  defaultRate: Number(String(form.defaultRate ?? '').trim()),
  rateUnit: form.rateUnit === 'UNIT' ? 'UNIT' : 'SQ_FT',
});
