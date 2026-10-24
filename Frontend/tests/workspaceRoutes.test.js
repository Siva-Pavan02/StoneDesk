import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRoute,
  NAVIGATION,
  visibleNavigation,
  navigationKey,
  profileSaveTarget,
} from '../src/utils/workspaceRoutes.js';

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

test('old products, trucks, destinations and references hashes redirect to New load', () => {
  for (const hash of ['references', 'products', 'products/trucks', 'products/destinations', 'products?x=1'])
    assert.deepEqual(resolveRoute(hash), { route: 'load', replaced: true }, hash);
});

test('any products/<x> hash resolves to New load', () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-?=&/';
  forAll(rand => {
    const length = Math.floor(rand() * 12);
    let tail = '';
    for (let i = 0; i < length; i++) tail += chars[Math.floor(rand() * chars.length)];
    return `products/${tail}`;
  }, hash => assert.deepEqual(resolveRoute(hash), { route: 'load', replaced: true }));
});

test('other legacy hashes are unchanged and current routes are not replaced', () => {
  assert.deepEqual(resolveRoute('monitor'), { route: 'entries?status=Dispatched', replaced: true });
  assert.deepEqual(resolveRoute('invoices'), { route: 'entries', replaced: true });
  assert.deepEqual(resolveRoute('settings'), { route: 'settings', replaced: false });
  assert.deepEqual(resolveRoute(''), { route: 'home', replaced: false });
});

test('sidebar navigation order and labels', () => {
  assert.deepEqual(NAVIGATION.map(([, , label]) => label), ['Dashboard', 'Loading entries', 'Profile', 'Settings']);
  assert.deepEqual(NAVIGATION.map(([key]) => key), ['home', 'entries', 'profile', 'settings']);
});

test('New load is not a menu item (the header button opens it)', () => {
  assert.ok(!NAVIGATION.some(([key]) => key === 'load'));
  assert.deepEqual(visibleNavigation('Dispatcher').map(([key]) => key), ['home', 'entries', 'settings']);
  assert.deepEqual(visibleNavigation('Yard Manager').map(([key]) => key), ['home', 'entries', 'settings']);
});

test('navigation key for the load screen', () => {
  assert.equal(navigationKey('load'), 'load');
  assert.equal(navigationKey('settings/team'), 'settings');
});

test('business setup without products continues to New load', () => {
  assert.equal(profileSaveTarget({ stoneRates: [] }), 'load');
  assert.equal(profileSaveTarget({ stoneRates: [{ id: 'p1' }] }), null);
});
