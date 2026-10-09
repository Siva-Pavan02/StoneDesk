import test from 'node:test';
import assert from 'node:assert/strict';

function browser(t, search = '') {
  const original = { window: globalThis.window, sessionStorage: globalThis.sessionStorage, fetch: globalThis.fetch };
  const storage = new Map();
  globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  globalThis.window = { location: { origin: 'http://localhost:5173', search, assign(url) { this.assigned = url; } }, history: { replaceState(_a, _b, path) { this.path = path; } } };
  t.after(() => Object.assign(globalThis, original));
  return storage;
}

test('Google start generates a PKCE challenge and same-origin callback', async t => {
  const storage = browser(t);
  globalThis.fetch = async () => Response.json({ url: 'https://project.supabase.co' });
  const { beginGoogleSignIn } = await import('../src/lib/googleSignIn.js?start');
  await beginGoogleSignIn();
  const pending = JSON.parse(storage.get('stonedesk.google.pending'));
  const target = new URL(window.location.assigned);
  assert.equal(target.origin, 'https://project.supabase.co');
  assert.equal(target.searchParams.get('provider'), 'google');
  assert.equal(target.searchParams.get('code_challenge_method'), 's256');
  assert.notEqual(target.searchParams.get('code_challenge'), pending.verifier);
  assert.equal(new URL(target.searchParams.get('redirect_to')).searchParams.get('google_callback'), pending.state);
});

test('Google callback exchanges once and clears URL and verifier', async t => {
  const storage = browser(t, '?google_callback=expected&code=one-use');
  storage.set('stonedesk.google.pending', JSON.stringify({ state: 'expected', verifier: 'v'.repeat(43), started: Date.now() }));
  let calls = 0;
  globalThis.fetch = async (_url, options) => { calls++; assert.equal(JSON.parse(options.body).code, 'one-use'); return Response.json({ user: { id: 'user' } }); };
  const { finishGoogleSignIn } = await import('../src/lib/googleSignIn.js?callback');
  const [a, b] = await Promise.all([finishGoogleSignIn(), finishGoogleSignIn()]);
  assert.equal(a.user.id, b.user.id);
  assert.equal(calls, 1);
  assert.equal(storage.size, 0);
  assert.equal(window.history.path, '/');
});

test('Google callback rejects mismatched state without calling the server', async t => {
  const storage = browser(t, '?google_callback=attacker&code=code');
  storage.set('stonedesk.google.pending', JSON.stringify({ state: 'expected', verifier: 'v'.repeat(43), started: Date.now() }));
  globalThis.fetch = () => { throw new Error('Must not call'); };
  const { finishGoogleSignIn } = await import('../src/lib/googleSignIn.js?invalid');
  await assert.rejects(finishGoogleSignIn(), /expired/);
  assert.equal(storage.size, 0);
});
