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
