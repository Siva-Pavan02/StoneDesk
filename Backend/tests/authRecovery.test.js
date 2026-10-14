// DB-free preservation tests for auth-recovery helpers. Run with:
//   node --test tests/authRecovery.test.js
// Must not require ./database (that needs .env.test and a PostgreSQL database).
const test = require('node:test');
const assert = require('node:assert/strict');
const { authFlags, requiresCurrentPassword, buildResetUrl } = require('../utils/authFlags');

test('authFlags: hasGoogle follows supabaseUserId', () => {
  const cases = [
    [{ supabaseUserId: 'sb-1' }, true],
    [{ supabaseUserId: null }, false],
    [{ supabaseUserId: '' }, false],
    [{}, false]
  ];
  for (const [user, hasGoogle] of cases) {
    assert.equal(authFlags(user).hasGoogle, hasGoogle, JSON.stringify(user));
  }
});

test('authFlags: hasPassword is false only for passwordLogin === false', () => {
  const cases = [
    [{ passwordLogin: false }, false],
    [{ passwordLogin: true }, true],
    [{ passwordLogin: undefined }, true],
    [{}, true]
  ];
  for (const [user, hasPassword] of cases) {
    assert.equal(authFlags(user).hasPassword, hasPassword, JSON.stringify(user));
  }
});

test('authFlags: null and undefined user', () => {
  assert.deepEqual(authFlags(null), { hasGoogle: false, hasPassword: true });
  assert.deepEqual(authFlags(undefined), { hasGoogle: false, hasPassword: true });
});

test('requiresCurrentPassword: false only for Google + passwordLogin false (exhaustive)', () => {
  const googleValues = [['unset', undefined], ['set', 'sb-1']];
  const passwordValues = [true, false, undefined, null, 'false'];
  for (const [label, supabaseUserId] of googleValues) {
    for (const passwordLogin of passwordValues) {
      const user = { passwordLogin };
      if (supabaseUserId !== undefined) user.supabaseUserId = supabaseUserId;
      const expected = !(label === 'set' && passwordLogin === false);
      assert.equal(requiresCurrentPassword(user), expected, `${label} × ${String(passwordLogin)}`);
    }
  }
});

test('requiresCurrentPassword: fails closed for null and undefined user', () => {
  assert.equal(requiresCurrentPassword(null), true);
  assert.equal(requiresCurrentPassword(undefined), true);
});

test('buildResetUrl: trailing slashes collapse and values are encoded', () => {
  const token = 'ab'.repeat(32);
  const email = 'a+b@x.test';
  const expected = `https://app.test/#reset-password?token=${token}&email=a%2Bb%40x.test`;
  for (const origin of ['https://app.test', 'https://app.test/', 'https://app.test///']) {
    assert.equal(buildResetUrl(origin, token, email), expected, origin);
  }
});

test('buildResetUrl: token is encoded and the query round-trips through URLSearchParams', () => {
  const cases = [
    ['ab'.repeat(32), 'a+b@x.test'],
    ['t o&k=en+/?#', 'user@example.test'],
    ['plain', 'x y+z@x.test']
  ];
  for (const [token, email] of cases) {
    const url = buildResetUrl('https://app.test', token, email);
    assert.ok(url.includes(`token=${encodeURIComponent(token)}&`), url);
    const query = url.slice(url.indexOf('?') + 1);
    const params = new URLSearchParams(query);
    assert.equal(params.get('token'), token);
    assert.equal(params.get('email'), email);
  }
});
