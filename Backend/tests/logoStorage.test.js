const test = require('node:test');
const assert = require('node:assert/strict');

test('cloud logos remain private, preserve bytes, and reject invalid paths', async t => {
  const saved = { fetch: global.fetch, mode: process.env.LOGO_STORAGE, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, storageKey: process.env.SUPABASE_STORAGE_SECRET_KEY };
  delete process.env.SUPABASE_STORAGE_SECRET_KEY;
  process.env.LOGO_STORAGE = 'supabase';
  process.env.SUPABASE_URL = 'https://storage.example.test';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  let stored;
  let fail = false;
  global.fetch = async (url, options) => {
    assert.ok(String(url).startsWith('https://storage.example.test/storage/v1/object/'));
    assert.ok(!String(url).includes('/public/'));
    if (fail) return Response.json({ message: 'Internal credential detail', statusCode: '500' }, { status: 500 });
    if (options.method === 'POST') { stored = options.body; return Response.json({ Key: 'file' }); }
    return new Response(stored, { headers: { 'Content-Type': 'image/png' } });
  };
  t.after(() => {
    global.fetch = saved.fetch;
    for (const [name, value] of Object.entries({ LOGO_STORAGE: saved.mode, SUPABASE_URL: saved.url, SUPABASE_SECRET_KEY: saved.key, SUPABASE_STORAGE_SECRET_KEY: saved.storageKey })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  const { saveLogo, readLogo } = require('../utils/logoStorage');
  const bytes = Buffer.from('test image bytes');
  await saveLogo('aaaaaaaa-aaaa.png', bytes);
  assert.deepEqual(await readLogo('aaaaaaaa-aaaa.png'), bytes);
  await assert.rejects(readLogo('../secret'), /Invalid logo filename/);
  fail = true;
  await assert.rejects(readLogo('aaaaaaaa-aaaa.png'), error => error.status === 503 && !error.message.includes('credential'));
});

test('content-addressed logos use org/<orgId>/<sha>.png, never overwrite and map storage errors', async t => {
  const saved = { fetch: global.fetch, mode: process.env.LOGO_STORAGE, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, storageKey: process.env.SUPABASE_STORAGE_SECRET_KEY };
  delete process.env.SUPABASE_STORAGE_SECRET_KEY;
  process.env.LOGO_STORAGE = 'supabase';
  process.env.SUPABASE_URL = 'https://storage.example.test';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  const ORG = 'aaaaaaaa-0000-4000-8000-00000000000a';
  const SHA = 'ab'.repeat(32);
  const calls = [];
  let reply = () => Response.json({ Key: 'file' });
  global.fetch = async (url, options = {}) => { calls.push({ url: String(url), method: options.method || 'GET', headers: new Headers(options.headers) }); return reply(); };
  t.after(() => {
    global.fetch = saved.fetch;
    for (const [name, value] of Object.entries({ LOGO_STORAGE: saved.mode, SUPABASE_URL: saved.url, SUPABASE_SECRET_KEY: saved.key, SUPABASE_STORAGE_SECRET_KEY: saved.storageKey })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  const { contentLogoKey, saveContentLogo, readContentLogo } = require('../utils/logoStorage');
  assert.equal(contentLogoKey(ORG, SHA), `org/${ORG}/${SHA}.png`);
  const bytes = Buffer.from('content logo bytes');

  assert.equal(await saveContentLogo(ORG, SHA, bytes), 'created');
  const upload = calls.at(-1);
  assert.equal(upload.method, 'POST');
  assert.ok(upload.url.includes(`/object/stonedesk-logos/org/${ORG}/${SHA}.png`), upload.url);
  assert.ok(!upload.url.includes('/public/'));
  assert.match(upload.headers.get('cache-control'), /31536000/);
  assert.equal(upload.headers.get('x-upsert'), 'false');
  assert.equal(upload.headers.get('content-type'), 'image/png');

  // Supabase reports a duplicate path as HTTP 400 with statusCode '409' (or a plain 409).
  reply = () => Response.json({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }, { status: 400 });
  assert.equal(await saveContentLogo(ORG, SHA, bytes), 'exists');
  reply = () => Response.json({ message: 'conflict' }, { status: 409 });
  assert.equal(await saveContentLogo(ORG, SHA, bytes), 'exists');
  reply = () => Response.json({ message: 'Internal credential detail', statusCode: '500' }, { status: 500 });
  await assert.rejects(saveContentLogo(ORG, SHA, bytes), error => error.status === 503 && !error.message.includes('credential'));

  reply = () => new Response(bytes, { headers: { 'Content-Type': 'image/png' } });
  assert.deepEqual(await readContentLogo(ORG, SHA), bytes);
  assert.ok(calls.at(-1).url.includes(`stonedesk-logos/org/${ORG}/${SHA}.png`));
  reply = () => Response.json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, { status: 400 });
  await assert.rejects(readContentLogo(ORG, SHA), error => error.status === 404);
  reply = () => Response.json({ statusCode: '404', code: 'NoSuchKey', error: 'NoSuchKey', message: 'Object not found' }, { status: 404 });
  await assert.rejects(readContentLogo(ORG, SHA), error => error.status === 404);
  // A missing bucket or tenant also says statusCode '404', but it is a configuration fault: 503.
  for (const body of [
    { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' },
    { statusCode: '404', code: 'NoSuchBucket', error: 'NoSuchBucket', message: 'The specified bucket does not exist' },
    { statusCode: '404', code: 'TenantNotFound', error: 'TenantNotFound', message: 'Tenant not found' }
  ]) {
    for (const status of [400, 404]) {
      reply = () => Response.json(body, { status });
      await assert.rejects(readContentLogo(ORG, SHA), error => error.status === 503, `${body.message} (${status})`);
    }
  }
  reply = () => new Response('', { status: 404 });
  await assert.rejects(readContentLogo(ORG, SHA), error => error.status === 503, 'an unexplained 404 is not treated as a missing object');
  reply = () => Response.json({ message: 'Internal credential detail', statusCode: '500' }, { status: 500 });
  await assert.rejects(readContentLogo(ORG, SHA), error => error.status === 503 && !error.message.includes('credential'));

  const before = calls.length;
  for (const org of ['org-a', ORG.toUpperCase(), '../x', '', undefined]) {
    await assert.rejects(saveContentLogo(org, SHA, bytes), /Invalid logo path/);
    await assert.rejects(readContentLogo(org, SHA), /Invalid logo path/);
  }
  for (const sha of [SHA.slice(1), SHA.toUpperCase(), `${SHA}.png`, `../${SHA}`, null]) {
    await assert.rejects(saveContentLogo(ORG, sha, bytes), /Invalid logo path/);
    await assert.rejects(readContentLogo(ORG, sha), /Invalid logo path/);
  }
  assert.equal(calls.length, before, 'invalid keys never reach storage');
});
