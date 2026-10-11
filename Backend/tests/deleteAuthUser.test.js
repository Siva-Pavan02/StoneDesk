const test = require('node:test');
const assert = require('node:assert/strict');
const deleteAuthUser = require('../utils/deleteAuthUser');

test('Auth deletion is scoped, retryable and fails closed', async t => {
  const originalFetch = global.fetch;
  const oldUrl = process.env.SUPABASE_URL, oldKey = process.env.SUPABASE_SECRET_KEY;
  t.after(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries({ SUPABASE_URL: oldUrl, SUPABASE_SECRET_KEY: oldKey })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  delete process.env.SUPABASE_SECRET_KEY;
  global.fetch = () => { throw new Error('Unexpected network request'); };
  await deleteAuthUser({ supabaseUserId: null });
  const user = { supabaseUserId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' };
  await assert.rejects(deleteAuthUser(user), /secret key/);
  process.env.SUPABASE_URL = 'https://auth.example.test';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  let calls = 0, status = 200, code;
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(String(url), `https://auth.example.test/auth/v1/admin/users/${user.supabaseUserId}`);
    assert.equal(options.method, 'DELETE');
    return Response.json(status === 200 ? { user: { id: user.supabaseUserId } } : { code, message: 'Provider detail' }, { status, headers: { 'x-supabase-api-version': '2024-01-01' } });
  };
  await deleteAuthUser(user);
  assert.equal(calls, 1);
  status = 404; code = 'user_not_found';
  await deleteAuthUser(user);
  status = 403; code = 'not_admin';
  await assert.rejects(deleteAuthUser(user), error => error.status === 503 && !error.message.includes('Provider detail'));
});
