const test = require('node:test');
const assert = require('node:assert/strict');

function isolated(env, limit) {
  class Ratelimit { static slidingWindow() {} async limit(key) { return limit(key); } }
  const context = { module: { exports: {} }, require: name => name === 'node:crypto' ? require(name) : name === '@upstash/redis' ? { Redis: class {} } : { Ratelimit }, process: { env }, console: { error() {} } };
  require('node:vm').runInNewContext(require('node:fs').readFileSync(require.resolve('../utils/rateLimiter'), 'utf8'), context);
  return context.module.exports;
}
test('distributed requests across IPs share a hashed normalized account budget', async () => {
  const keys = new Map();
  const limiter = isolated({ UPSTASH_REDIS_REST_URL: 'https://example.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'test' }, key => { const n = (keys.get(key) || 0) + 1; keys.set(key,n); return { success:n<=20,limit:20,remaining:20-n,reset:Date.now() }; });
  let passed=0, blocked=0;
  for(let i=0;i<23;i++) await limiter.authLimit({ip:`192.0.2.${i}`,path:'/login',body:{email:i%2?' Victim@Example.test ':'victim@example.test', googleTicket: 'attacker-controlled-extra-field'}}, {set(){},status(code){assert.equal(code,429);blocked++;return this;},json(){}},()=>passed++);
  assert.equal(passed,20);assert.equal(blocked,3);
  assert.equal([...keys.keys()].filter(k=>k.startsWith('account:')).length,1);
  assert.ok([...keys.keys()].every(k=>!k.includes('victim')&&!k.includes('@')));
});
for (const failure of ['missing', 'timeout', 'error']) test(`production rate limiting fails closed: ${failure}`, async () => {
  const limiter = isolated({ NODE_ENV:'production', ...(failure==='missing'?{}:{UPSTASH_REDIS_REST_URL:'https://example.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test'}) }, () => { if(failure==='error') throw Error('private credentials');return {success:true,reason:'timeout'}; });
  let status, body;
  await limiter.authLimit({ip:'192.0.2.1',path:'/login'}, {set(){},status(code){status=code;return this;},json(value){body=value;}},()=>assert.fail('must not allow'));
  assert.equal(status,503);assert.ok(!body.error.includes('private credentials'));
});

for (const distributed of [false, true]) test(`route aliases share one authentication budget (${distributed ? 'Redis' : 'fallback'})`, async () => {
  const buckets = new Map();
  class Ratelimit {
    static slidingWindow() { return {}; }
    async limit(key) { const n = (buckets.get(key) || 0) + 1; buckets.set(key, n); return { success: n <= 20, limit: 20, remaining: Math.max(0, 20 - n), reset: Date.now() }; }
  }
  const context = { module: { exports: {} }, require: name => name === 'node:crypto' ? require(name) : name === '@upstash/redis' ? { Redis: class {} } : { Ratelimit }, process: { env: distributed ? { UPSTASH_REDIS_REST_URL: 'https://example.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'test' } : { NODE_ENV: 'test' } }, console };
  require('node:vm').runInNewContext(require('node:fs').readFileSync(require.resolve('../utils/rateLimiter'), 'utf8'), context);
  let passed = 0, blocked = 0;
  for (let i = 0; i < 24; i++) {
    context.module.exports.authLimit({ ip: '192.0.2.9', path: ['/login', '/LOGIN', '/LoGiN/', '/login/'][i % 4], route: { path: '/login' } }, { set() {}, status(value) { assert.equal(value, 429); blocked++; return this; }, json() {} }, () => passed++);
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(passed, 20);
  assert.equal(blocked, 4);
});

test('copied Upstash credentials are trimmed before client initialization', async () => {
  let received, passed = false;
  class Redis { constructor(options) { received = options; } }
  class Ratelimit {
    static slidingWindow() { return {}; }
    async limit() { return { success: true, limit: 20, remaining: 19, reset: Date.now() }; }
  }
  const context = {
    module: { exports: {} },
    require: name => name === 'node:crypto' ? require(name) : name === '@upstash/redis' ? { Redis } : { Ratelimit },
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

test('invalid Upstash configuration retains development rate limits instead of throwing a 500', async t => {
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
  for (let i = 0; i < 21; i++) await authLimit({ ip: '192.0.2.45', path: '/google/exchange' }, res, () => passed++);
  assert.equal(passed, 20);
  assert.equal(status, 429);
  assert.ok(messages.length);
  assert.ok(messages.every(message => !message.includes('test-private-token')));
});
