import test from 'node:test';
import assert from 'node:assert/strict';
import { decimalToFraction } from '../src/utils/fractionParser.js';

test('decimalToFraction keeps the sign for negative values', () => {
  assert.equal(decimalToFraction(-1.5), '-1½');
  assert.equal(decimalToFraction(-2), '-2');
  // Positive output is unchanged.
  assert.equal(decimalToFraction(1.5), '1½');
  assert.equal(decimalToFraction(0.5), '½');
});
