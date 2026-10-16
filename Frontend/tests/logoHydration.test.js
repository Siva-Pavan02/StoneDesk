import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { testLogo } from './invoiceFixtures.js';
import { LOGO_HYDRATION_TIMEOUT_MS, cachedLogoDataUrl, clearLogoCache, hydrateRecordLogo, loadLogoDataUrl, logoReference, withLogoDataUrl } from '../src/utils/logoHydration.js';

// Node has no FileReader; this stub mirrors readAsDataURL closely enough for the util.
class FakeFileReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onload?.();
    }, error => { this.error = error; this.onerror?.(); });
  }
}
const pngBytes = Buffer.from(testLogo.slice(testLogo.indexOf(',') + 1), 'base64');
const SHA = createHash('sha256').update(pngBytes).digest('hex');
const OTHER_SHA = 'b'.repeat(64);
const record = (logo = { sha256: SHA, width: 120, height: 48, bytes: pngBytes.length }, extra = {}) => ({ id: 'load-1', status: 'Dispatched', updatedAt: '2026-11-03T00:00:00.000Z', businessSnapshot: { businessName: 'Yard', logo, ...extra } });
const pngResponse = () => new Response(pngBytes, { status: 200, headers: { 'Content-Type': 'image/png' } });

function setup(t, handler = pngResponse) {
  const original = { fetch: globalThis.fetch, FileReader: globalThis.FileReader };
  const calls = [];
  globalThis.FileReader = FakeFileReader;
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return handler(url, options); };
  clearLogoCache();
  t.after(() => { globalThis.fetch = original.fetch; globalThis.FileReader = original.FileReader; clearLogoCache(); });
  return calls;
}

test('legacy bills with an embedded logo pass through untouched, without a fetch', async t => {
  const calls = setup(t);
  const legacy = record(undefined, { logoDataUrl: testLogo });
  delete legacy.businessSnapshot.logo;
  assert.equal(await hydrateRecordLogo(legacy), legacy);
  const both = record(undefined, { logoDataUrl: testLogo });
  assert.equal(await hydrateRecordLogo(both), both, 'an embedded logo wins over a reference');
  assert.equal(calls.length, 0);
});

test('no logo, a null logo, a missing snapshot and a malformed sha never fetch', async t => {
  const calls = setup(t);
  for (const value of [record(null), { id: 'x', status: 'Dispatched', businessSnapshot: { businessName: 'Yard' } }, { id: 'x', status: 'Dispatched' }, { id: 'x', businessSnapshot: null }, record({ sha256: SHA.toUpperCase() }), record({ sha256: SHA.slice(1) }), record({ sha256: `../${SHA}` }), record({ sha256: 42 }), null]) {
    assert.equal(await hydrateRecordLogo(value), value);
  }
  assert.equal(logoReference(undefined), null);
  assert.equal(logoReference({ logo: { sha256: SHA } }), SHA);
  assert.equal(calls.length, 0);
});

test('a referenced logo is fetched once same-origin with credentials and embedded in a copy', async t => {
  const calls = setup(t);
  const input = record();
  const snapshotBefore = structuredClone(input);
  const output = await hydrateRecordLogo(input);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `/uploads/logos/${SHA}.png`);
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(output.businessSnapshot.logoDataUrl, testLogo);
  assert.deepEqual(output.businessSnapshot.logo, input.businessSnapshot.logo, 'the reference is kept');
  assert.equal(output.businessSnapshot.businessName, 'Yard');
  assert.notEqual(output, input);
  assert.deepEqual(input, snapshotBefore, 'the input record is not mutated');
  assert.equal(cachedLogoDataUrl(SHA), testLogo);
  assert.deepEqual(withLogoDataUrl(input, 'x').businessSnapshot, { ...input.businessSnapshot, logoDataUrl: 'x' });
});

test('concurrent hydrations share one fetch and later bills with the same sha use the cache', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const calls = setup(t, async () => { await gate; return pngResponse(); });
  const first = hydrateRecordLogo(record());
  const second = hydrateRecordLogo({ ...record(), id: 'load-2' });
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls.length, 1);
  assert.equal(a.businessSnapshot.logoDataUrl, testLogo);
  assert.equal(b.businessSnapshot.logoDataUrl, testLogo);
  assert.equal(b.id, 'load-2');
  const third = await hydrateRecordLogo({ ...record(), id: 'load-3' });
  assert.equal(third.businessSnapshot.logoDataUrl, testLogo);
  assert.equal(calls.length, 1, 'no second request for a cached sha');
});

test('a 404 falls back to the placeholder and is retried on the next open', async t => {
  let status = 404;
  const calls = setup(t, () => status === 404 ? Response.json({ error: 'Logo not found' }, { status: 404 }) : pngResponse());
  const input = record();
  assert.equal(await hydrateRecordLogo(input), input);
  assert.equal(input.businessSnapshot.logoDataUrl, undefined);
  assert.equal(cachedLogoDataUrl(SHA), undefined, 'failures are not cached');
  status = 200;
  assert.equal((await hydrateRecordLogo(input)).businessSnapshot.logoDataUrl, testLogo);
  assert.equal(calls.length, 2);
});

test('network errors, non-PNG responses and unreadable bytes return the original record', async t => {
  const responses = [
    () => { throw new TypeError('Failed to fetch'); },
    () => Promise.reject(new TypeError('Network down')),
    () => new Response('<html>login</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    () => new Response(pngBytes, { status: 200 }),
  ];
  let index = 0;
  setup(t, () => responses[index]());
  for (; index < responses.length; index++) {
    const input = record();
    assert.equal(await hydrateRecordLogo(input), input, `case ${index}`);
  }
  globalThis.FileReader = class { readAsDataURL() { this.error = new Error('unreadable'); queueMicrotask(() => this.onerror?.()); } };
  globalThis.fetch = async () => pngResponse();
  const input = record();
  assert.equal(await hydrateRecordLogo(input), input);
  assert.equal(await loadLogoDataUrl(OTHER_SHA), null);
});

test('a fetch that never answers is cut off by the bounded wait', async t => {
  setup(t, () => new Promise(() => {}));
  assert.equal(LOGO_HYDRATION_TIMEOUT_MS, 4000);
  const input = record();
  const started = Date.now();
  assert.equal(await hydrateRecordLogo(input, { timeoutMs: 20 }), input);
  assert.ok(Date.now() - started < 1000);
});
