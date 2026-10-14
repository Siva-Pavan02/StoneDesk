import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoute, productsTab, NAVIGATION } from '../src/utils/workspaceRoutes.js';

// Seeded PRNG (mulberry32): returns floats in [0, 1), same sequence for the same seed.
const mulberry32 = seed => () => {
  let t = (seed = (seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Runs `check(input)` on `runs` inputs from `generate(rand)`; on failure reports seed, iteration and input.
const forAll = (generate, check, { runs = 100, seed = Number(process.env.PBT_SEED) || 0x5d0e5 } = {}) => {
  const rand = mulberry32(seed);
  for (let i = 0; i < runs; i++) {
    const input = generate(rand);
    try { check(input); } catch (error) {
      error.message = `seed=${seed} iteration=${i} input=${JSON.stringify(input)}\n${error.message}`;
      throw error;
    }
  }
};

test('seeded PRNG helper is deterministic and in range', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
  forAll(rand => rand(), value => assert.ok(value >= 0 && value < 1));
});

test('legacy references hash resolves to the trucks tab and is replaced', () => {
  assert.deepEqual(resolveRoute('references'), { route: 'products/trucks', replaced: true });
});

test('products view with a query string maps to the Products tab', () => {
  assert.equal(productsTab('products?x=1'), 'products');
});

test('sidebar navigation order and labels', () => {
  assert.deepEqual(NAVIGATION.map(([, , en]) => en), ['Dashboard', 'Loading entries', 'Products & places', 'Profile settings', 'Settings']);
  assert.deepEqual(NAVIGATION.map(([key]) => key), ['home', 'entries', 'products', 'profile', 'settings']);
});
