import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTruckNumber, truckPlateError } from '../src/utils/truckPlate.js';

// mulberry32: small seeded PRNG so property runs are reproducible. Returns floats in [0, 1).
export const mulberry32 = seed => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Runs `check(input)` against `runs` generated inputs. On failure, rethrows with the seed and failing input.
export function forAll(generate, check, { seed = Date.now() >>> 0, runs = 100 } = {}) {
  const random = mulberry32(seed);
  for (let i = 0; i < runs; i++) {
    const input = generate(random);
    try { check(input); } catch (error) {
      error.message = `${error.message}\nseed=${seed} iteration=${i} input=${JSON.stringify(input)}`;
      throw error;
    }
  }
}

test('formats standard and Bharat series plates', () => {
  assert.equal(formatTruckNumber('tn01ab1234'), 'TN 01 AB 1234');
  assert.equal(formatTruckNumber('22bh1234aa'), '22 BH 1234 AA');
});

test('truckPlateError reports invalid plates and allows blank input', () => {
  assert.equal(truckPlateError('abc', []), 'invalid');
  assert.equal(truckPlateError('', []), '');
  assert.equal(truckPlateError('   ', []), '');
});
