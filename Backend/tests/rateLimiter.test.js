const test = require('node:test');
const assert = require('node:assert/strict');

test('copied Upstash credentials are trimmed before client initialization', async () => {
  let received, passed = false;
  class Redis { constructor(options) { received = options; } }
  class Ratelimit {
    static slidingWindow() { return {}; }
    async limit() { return { success: true, limit: 20, remaining: 19, reset: Date.now() }; }
  }
  const context = {
    module: { exports: {} },
    require: name => name === '@upstash/redis' ? { Redis } : { Ratelimit },
    process: { env: { UPSTASH_REDIS_REST_URL: ' https://example.upstash.io\n', UPSTASH_REDIS_REST_TOKEN: ' token\r\n' } },
    console: { error() { assert.fail('Unexpected fallback'); }, warn() {} }
  };
  require('node:vm').runInNewContext(require('node:fs').readFileSync(require.resolve('../utils/rateLimiter'), 'utf8'), context);
  context.module.exports.authLimit({ ip: '192.0.2.1', path: '/google/exchange' }, { set() {} }, () => { passed = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(received.url, 'https://example.upstash.io');
  assert.equal(received.token, 'token');
  assert.equal(passed, true);
});

test('invalid Upstash configuration retains rate limits instead of throwing a 500', t => {
  const original = { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, log: console.error };
  t.after(() => {
    for (const [key, value] of [['UPSTASH_REDIS_REST_URL', original.url], ['UPSTASH_REDIS_REST_TOKEN', original.token]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    console.error = original.log;
  });
  process.env.UPSTASH_REDIS_REST_URL = 'not-a-valid-redis-url';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-private-token';
  const messages = [];
  console.error = message => messages.push(message);
  const { authLimit } = require('../utils/rateLimiter');
  let passed = 0, status;
  const res = { set() {}, status(code) { status = code; return this; }, json() {} };
  for (let i = 0; i < 21; i++) authLimit({ ip: '192.0.2.45', path: '/google/exchange' }, res, () => passed++);
  assert.equal(passed, 20);
  assert.equal(status, 429);
  assert.ok(messages.length);
  assert.ok(messages.every(message => !message.includes('test-private-token')));
});
