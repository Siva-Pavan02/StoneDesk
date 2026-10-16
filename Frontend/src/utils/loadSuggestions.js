// Truck and destination suggestions for New load: saved lists first, then values from recent loads.
// Keys match Backend/utils/savedReferences.js referenceKey() so the same value never shows twice.
import { compactPlate } from './truckPlate.js';

export function suggestionKey(kind, value) {
  const text = String(value ?? '');
  if (kind === 'trucks') return compactPlate(text.trim());
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

// hidden: Set of keys removed during this New load session, so they do not come back from recent loads.
export function mergeSuggestions(kind, saved = [], recent = [], hidden = new Set(), limit = 30) {
  const seen = new Set();
  const result = [];
  for (const value of [...(saved || []), ...(recent || [])]) {
    if (!value || typeof value !== 'string' || !value.trim()) continue;
    const key = suggestionKey(kind, value);
    if (seen.has(key) || hidden.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

// True when value is in the saved list (only those can be removed through the delete endpoint).
export function isSavedSuggestion(kind, saved = [], value) {
  const key = suggestionKey(kind, value);
  return Boolean(key) && (saved || []).some(item => typeof item === 'string' && suggestionKey(kind, item) === key);
}
