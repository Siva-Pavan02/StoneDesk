import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestionKey, mergeSuggestions, isSavedSuggestion } from '../src/utils/loadSuggestions.js';

test('suggestionKey compacts plates and normalizes destinations', () => {
  assert.equal(suggestionKey('trucks', 'tn 01-ab.1234'), 'TN01AB1234');
  assert.equal(suggestionKey('trucks', 'TN 01 AB 1234'), suggestionKey('trucks', 'tn01ab1234'));
  assert.equal(suggestionKey('destinations', '  Kadapa   Town '), 'kadapa town');
  assert.equal(suggestionKey('destinations', 'KADAPA'), suggestionKey('destinations', 'kadapa'));
});

test('mergeSuggestions puts saved first and keeps the first spelling', () => {
  const merged = mergeSuggestions('trucks', ['TN 01 AB 1234'], ['tn01ab1234', 'KA05CD9999', 'KA 05 CD 9999']);
  assert.deepEqual(merged, ['TN 01 AB 1234', 'KA05CD9999']);
  assert.deepEqual(mergeSuggestions('destinations', ['Kadapa'], [' kadapa ', 'Chennai']), ['Kadapa', 'Chennai']);
});

test('mergeSuggestions skips falsy and non-string values', () => {
  assert.deepEqual(mergeSuggestions('destinations', ['', null, 'Ongole'], [undefined, 42, '  ', 'Nellore']), ['Ongole', 'Nellore']);
  assert.deepEqual(mergeSuggestions('trucks', undefined, undefined), []);
});

test('mergeSuggestions drops hidden keys from both sources', () => {
  const hidden = new Set([suggestionKey('trucks', 'TN 01 AB 1234')]);
  assert.deepEqual(mergeSuggestions('trucks', ['TN 01 AB 1234', 'AP 09 XY 4321'], ['tn01ab1234'], hidden), ['AP 09 XY 4321']);
});

test('mergeSuggestions caps at the limit', () => {
  const saved = Array.from({ length: 50 }, (_, i) => `Town ${i}`);
  assert.equal(mergeSuggestions('destinations', saved, ['Other']).length, 30);
  assert.deepEqual(mergeSuggestions('destinations', saved, [], new Set(), 2), ['Town 0', 'Town 1']);
});

test('isSavedSuggestion matches by key only against the saved list', () => {
  assert.equal(isSavedSuggestion('trucks', ['TN 01 AB 1234'], 'tn01ab1234'), true);
  assert.equal(isSavedSuggestion('trucks', ['TN 01 AB 1234'], 'KA05CD9999'), false);
  assert.equal(isSavedSuggestion('destinations', ['Kadapa'], ' KADAPA '), true);
  assert.equal(isSavedSuggestion('destinations', undefined, 'Kadapa'), false);
  assert.equal(isSavedSuggestion('destinations', [''], ''), false);
});
