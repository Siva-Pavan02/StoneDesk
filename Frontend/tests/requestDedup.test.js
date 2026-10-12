import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../src/lib/pilotApi.js';

test('concurrent reads share a request; settled results and mutations never reuse stale reads', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const pending = [];
  globalThis.fetch = () => new Promise(resolve => pending.push(resolve));
  const a = request('/auth/session'), b = request('/auth/session');
  assert.equal(pending.length, 1);
  pending.shift()(Response.json({ user: null }));
  assert.deepEqual(await a, await b);
  const oldRead = request('/auth/session');
  const logout = request('/auth/logout', { method: 'POST', body: {} });
  const fresh = request('/auth/session');
  assert.equal(pending.length, 3);
  pending[0](Response.json({ user: { id: 'old' } }));
  await oldRead;
  assert.equal(request('/auth/session'), fresh);
  pending[1](Response.json({ ok: true }));
  pending[2](Response.json({ user: null }));
  await logout;
  assert.deepEqual(await fresh, { user: null });
});
