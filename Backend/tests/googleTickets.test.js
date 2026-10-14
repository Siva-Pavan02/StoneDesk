// DB-free: Google onboarding tickets and the Supabase session clean-up after exchange.
const test = require('node:test');
const assert = require('node:assert/strict');

function environment(t, values) {
  const saved = Object.fromEntries(Object.keys(values).map(name => [name, process.env[name]]));
  for (const [name, value] of Object.entries(values)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  t.after(() => { for (const [name, value] of Object.entries(saved)) if (value === undefined) delete process.env[name]; else process.env[name] = value; });
}
const local = { NODE_ENV: 'test', VERCEL: undefined, UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined };
const identity = { email: 'member@example.test', supabaseUserId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' };

test('tickets hold only the verified identity, survive reads and end when consumed', async t => {
  environment(t, local);
  const tickets = require('../utils/googleTickets');
  const ticket = await tickets.issue(identity);
  assert.match(ticket, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(await tickets.read(ticket), identity);
  assert.deepEqual(await tickets.read(ticket), identity, 'reading does not consume');
  await tickets.consume(ticket);
  await assert.rejects(tickets.read(ticket), { status: 401 });
  for (const bad of [undefined, '', 'short', 'x'.repeat(43), { ticket }]) await assert.rejects(tickets.read(bad), { status: 401 });
  await tickets.consume('not-a-ticket');
});

test('tickets fail closed in production without distributed storage', async t => {
  environment(t, { ...local, NODE_ENV: 'production' });
  const tickets = require('../utils/googleTickets');
  await assert.rejects(tickets.issue(identity), { status: 503 });
});

test('exchange returns no Supabase token and always ends the Supabase session', async t => {
  environment(t, { SUPABASE_URL: 'https://auth.example.test', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' });
  const googleAuth = require('../utils/googleAuth');
  const realFetch = global.fetch;
  t.after(() => { global.fetch = realFetch; });
  let verified = true;
  const logouts = [];
  global.fetch = async (url, options) => {
    url = String(url);
    assert.ok(url.startsWith('https://auth.example.test/auth/v1/'), url);
    assert.equal(options.headers.apikey, 'sb_publishable_test');
    if (url.endsWith('/token?grant_type=pkce')) return Response.json({ access_token: 'supabase-access-token-123456', refresh_token: 'refresh' });
    if (url.endsWith('/logout?scope=local')) { logouts.push(options.headers.Authorization); return new Response(null, { status: 204 }); }
    return Response.json({ id: identity.supabaseUserId, email: identity.email, email_confirmed_at: '2026-10-01T00:00:00Z',
      identities: [{ provider: 'google', identity_data: { email: identity.email, email_verified: verified } }] });
  };
  const result = await googleAuth.exchange('code', 'v'.repeat(43));
  assert.deepEqual(result, identity);
  assert.deepEqual(logouts, ['Bearer supabase-access-token-123456']);
  verified = false;
  await assert.rejects(googleAuth.exchange('code', 'v'.repeat(43)), { status: 401 });
  assert.equal(logouts.length, 2, 'a rejected identity still ends its Supabase session');
  global.fetch = async url => String(url).includes('/logout') ? Promise.reject(new Error('network down')) : Response.json(String(url).includes('/token') ? { access_token: 'supabase-access-token-123456' } : { id: identity.supabaseUserId, email: identity.email, email_confirmed_at: 'x', identities: [{ provider: 'google', identity_data: { email: identity.email, email_verified: true } }] });
  assert.deepEqual(await googleAuth.exchange('code', 'v'.repeat(43)), identity, 'a failed logout does not block sign-in');
});

test('cleanup selects only old, unlinked, Google-only Auth users', () => {
  const { orphanedAuthUsers } = require('../scripts/cleanupAuthUsers');
  const now = Date.parse('2026-10-14T12:00:00Z'), old = '2026-10-10T00:00:00Z', recent = '2026-10-14T11:00:00Z';
  const user = (id, extra = {}) => ({ id, created_at: old, last_sign_in_at: old, app_metadata: { provider: 'google', providers: ['google'] }, ...extra });
  const users = [
    user('aaaaaaaa-0000-4000-8000-000000000001'),
    user('AAAAAAAA-0000-4000-8000-000000000002'),
    user('aaaaaaaa-0000-4000-8000-000000000003', { created_at: recent, last_sign_in_at: recent }),
    user('aaaaaaaa-0000-4000-8000-000000000004', { last_sign_in_at: recent }),
    user('aaaaaaaa-0000-4000-8000-000000000005', { app_metadata: { provider: 'email', providers: ['email', 'google'] } }),
    user('aaaaaaaa-0000-4000-8000-000000000006', { app_metadata: {} }),
    user('aaaaaaaa-0000-4000-8000-000000000007', { last_sign_in_at: null }),
  ];
  const picked = orphanedAuthUsers(users, ['aaaaaaaa-0000-4000-8000-000000000002'], { now, minAgeHours: 24 }).map(u => u.id);
  assert.deepEqual(picked, ['aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000007']);
});
