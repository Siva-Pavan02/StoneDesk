import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal window: replaceState records the call and clears the address bar like a real browser.
function fakeWindow({ hash = '', pathname = '/', search = '' } = {}) {
  const location = { hash, pathname, search };
  return {
    location,
    history: {
      calls: [],
      replaceState(...a) {
        this.calls.push(a);
        location.hash = '';
        location.search = '';
        location.pathname = '/';
      }
    }
  };
}

const TOKEN = 'a1'.repeat(32);
const RESET_HASH = `#reset-password?token=${TOKEN}&email=a%2Bb%40x.test`;

// takeResetLinkFromHash: a reset link arriving via hashchange in an already-loaded tab (Defect 5).
// Fresh module instance so consumeResetLink's once-per-load memo starts empty.
test('takeResetLinkFromHash consumes a reset link that arrives after first load', async () => {
  const { consumeResetLink, takeResetLinkFromHash } = await import('../src/lib/authFlow.js?consume-none');
  const win = fakeWindow({ hash: '#home' });
  assert.equal(consumeResetLink(win), null);
  assert.deepEqual(win.history.calls, []);

  win.location.hash = RESET_HASH;
  // consumeResetLink is memoised once per load, so it cannot see the new hash.
  assert.equal(consumeResetLink(win), null);

  assert.deepEqual(takeResetLinkFromHash(win), { token: TOKEN, email: 'a+b@x.test' });
  assert.deepEqual(win.history.calls, [[null, '', '/']]);

  // StrictMode / repeat safety: the URL is already stripped, so a second call finds nothing.
  assert.equal(takeResetLinkFromHash(win), null);
  assert.deepEqual(win.history.calls, [[null, '', '/']]);
});

// ---------------------------------------------------------------------------
// Preservation (Property 2): pure functions observed on unfixed code.
// ---------------------------------------------------------------------------

test('readResetLink: hash, legacy path and edge cases', async () => {
  const { readResetLink } = await import('../src/lib/authFlow.js');
  const cases = [
    [{ hash: RESET_HASH }, { token: TOKEN, email: 'a+b@x.test' }],
    [{ hash: '#reset-password' }, { token: '', email: '' }],
    [{ hash: '#reset-passwordx' }, null],
    [{ hash: '#home' }, null],
    [{ hash: '' }, null],
    [{}, null],
    [{ hash: '', pathname: '/reset-password', search: `?token=${TOKEN}&email=a%40x.test` }, { token: TOKEN, email: 'a@x.test' }],
    [{ hash: '', pathname: '/reset-password', search: '' }, { token: '', email: '' }],
    [{ hash: `#reset-password?email=a%40x.test` }, { token: '', email: 'a@x.test' }],
    [{ hash: `#reset-password?token=${TOKEN}` }, { token: TOKEN, email: '' }],
    [{ hash: `#reset-password?token=${TOKEN}&email=%20a%40x.test%20` }, { token: TOKEN, email: 'a@x.test' }],
    [{ hash: `#reset-password?token=${TOKEN}&email=a%2Bb%40x.test` }, { token: TOKEN, email: 'a+b@x.test' }]
  ];
  for (const [input, expected] of cases) {
    assert.deepEqual(readResetLink(input), expected, JSON.stringify(input));
  }
});

test('consumeResetLink: reset URL is returned, stripped once and memoised', async () => {
  const { consumeResetLink } = await import('../src/lib/authFlow.js?consume-link');
  const win = fakeWindow({ hash: RESET_HASH });
  const first = consumeResetLink(win);
  assert.deepEqual(first, { token: TOKEN, email: 'a+b@x.test' });
  assert.deepEqual(win.history.calls, [[null, '', '/']]);
  assert.equal(consumeResetLink(win), first);
  assert.deepEqual(win.history.calls, [[null, '', '/']]);
});

test('consumeResetLink: legacy path is returned and stripped', async () => {
  const { consumeResetLink } = await import('../src/lib/authFlow.js?consume-legacy');
  const win = fakeWindow({ pathname: '/reset-password', search: `?token=${TOKEN}&email=a%40x.test` });
  assert.deepEqual(consumeResetLink(win), { token: TOKEN, email: 'a@x.test' });
  assert.deepEqual(win.history.calls, [[null, '', '/']]);
});

test('consumeResetLink: non-reset URL returns null without replaceState, memoised per load', async () => {
  const { consumeResetLink } = await import('../src/lib/authFlow.js?consume-nonreset');
  const win = fakeWindow({ hash: '#entries?status=Dispatched' });
  assert.equal(consumeResetLink(win), null);
  assert.deepEqual(win.history.calls, []);
  win.location.hash = RESET_HASH;
  assert.equal(consumeResetLink(win), null);
  assert.deepEqual(win.history.calls, []);
});

test('validResetLink: 64 hex token plus email', async () => {
  const { validResetLink } = await import('../src/lib/authFlow.js');
  const cases = [
    [{ token: 'a'.repeat(64), email: 'a@x.test' }, true],
    [{ token: 'A'.repeat(64), email: 'a@x.test' }, true],
    [{ token: TOKEN.toUpperCase(), email: 'a@x.test' }, true],
    [{ token: 'a'.repeat(63), email: 'a@x.test' }, false],
    [{ token: 'a'.repeat(65), email: 'a@x.test' }, false],
    [{ token: 'g'.repeat(64), email: 'a@x.test' }, false],
    [{ token: 'a'.repeat(64), email: '' }, false],
    [{ token: '', email: '' }, false],
    [null, false],
    [undefined, false]
  ];
  for (const [link, expected] of cases) {
    assert.equal(validResetLink(link), expected, JSON.stringify(link));
  }
});

test('appView: exhaustive precedence table', async () => {
  const { appView } = await import('../src/lib/authFlow.js');
  const users = { none: null, inactive: { active: false }, active: { active: true } };
  let count = 0;
  for (const reset of [null, { token: TOKEN, email: 'a@x.test' }, { done: true }]) {
    for (const checking of [false, true]) {
      for (const [userLabel, user] of Object.entries(users)) {
        for (const welcome of [false, true]) {
          const expected = reset ? 'reset'
            : checking ? 'loading'
              : userLabel === 'none' || welcome ? 'landing'
                : userLabel === 'inactive' ? 'pending'
                  : 'workspace';
          assert.equal(appView({ reset, checking, user, welcome }), expected,
            JSON.stringify({ reset, checking, userLabel, welcome }));
          count++;
        }
      }
    }
  }
  assert.equal(count, 36);
});

test('authView: exhaustive precedence table', async () => {
  const { authView } = await import('../src/lib/authFlow.js');
  const signups = { none: null, needsSignup: { needsSignup: true }, needsLink: { needsLink: true } };
  let count = 0;
  for (const mode of [null, 'login', 'signup']) {
    for (const method of [null, 'email', 'google']) {
      for (const [signupLabel, googleSignup] of Object.entries(signups)) {
        for (const forgot of [false, true]) {
          const expected = !mode ? 'closed'
            : signupLabel === 'needsLink' ? 'link'
              : signupLabel === 'needsSignup' ? 'google-signup'
                : method === 'google' ? 'google'
                  : method === 'email' ? (mode === 'login' && forgot ? 'forgot' : 'email')
                    : 'chooser';
          assert.equal(authView({ mode, method, googleSignup, forgot }), expected,
            JSON.stringify({ mode, method, signupLabel, forgot }));
          count++;
        }
      }
    }
  }
  assert.equal(count, 54);
});

// Passes once takeResetLinkFromHash exists (task 3.5); fails on unfixed code because the export is missing.
test('takeResetLinkFromHash: non-reset hashes return null without replaceState', async () => {
  const { takeResetLinkFromHash } = await import('../src/lib/authFlow.js?take-nonreset');
  const inputs = [
    { hash: '' },
    { hash: '#home' },
    { hash: '#welcome' },
    { hash: '#entries?status=Dispatched' },
    { hash: '#bill/abc' },
    { hash: '#reset-passwordx' },
    { hash: '', pathname: '/reset-password', search: `?token=${TOKEN}&email=a%40x.test` }
  ];
  for (const input of inputs) {
    const win = fakeWindow(input);
    assert.equal(takeResetLinkFromHash(win), null, JSON.stringify(input));
    assert.deepEqual(win.history.calls, [], JSON.stringify(input));
  }
});
