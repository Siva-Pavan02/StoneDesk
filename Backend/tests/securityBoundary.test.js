const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const API_PREFIX = '/api';

// Exercise the real Express middleware and file serving with an isolated DB double.
// This suite must never connect to the configured business database.
test('HTTP boundaries protect logs, browser responses and organization logos', async t => {
  process.env.NODE_ENV = 'test';
  process.env.APP_ORIGIN = 'https://yard.example';
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stonedesk-security-'));
  process.env.UPLOAD_DIR = directory;
  const logo = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa.png';
  const otherLogo = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb.png';
  await fs.writeFile(path.join(directory, logo), 'owner-logo');
  await fs.writeFile(path.join(directory, otherLogo), 'other-logo');
  // Content-addressed logos live under org/<organizationId>/<sha256>.png.
  const ORG_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
  const ORG_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
  const shaA = createHash('sha256').update('owner-content-logo').digest('hex');
  const shaB = createHash('sha256').update('other-content-logo').digest('hex');
  await fs.mkdir(path.join(directory, 'org', ORG_A), { recursive: true });
  await fs.mkdir(path.join(directory, 'org', ORG_B), { recursive: true });
  await fs.writeFile(path.join(directory, 'org', ORG_A, `${shaA}.png`), 'owner-content-logo');
  await fs.writeFile(path.join(directory, 'org', ORG_B, `${shaB}.png`), 'other-content-logo');
  const token = 'a'.repeat(64);
  const tokenHash = createHash('sha256').update(token).digest('hex');
  let active = true;
  const database = {
    session: { findFirst: async ({ where }) => where.tokenHash === tokenHash ? { user: { id: 'owner', organizationId: ORG_A, active, role: 'Admin' } } : null },
    masterSettings: { findUnique: async ({ where }) => { assert.equal(where.id, ORG_A); return { logoPath: `/uploads/${logo}` }; } },
  };
  require.cache[require.resolve('../utils/prisma')] = { exports: database };
  const server = http.createServer(require('../app'));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(directory, { recursive: true, force: true }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = { Cookie: `stonedesk_session=${token}` };
  await t.test('security headers cover normal, denied and preflight responses', async () => {
    for (const route of ['/', `${API_PREFIX}/dispatches`]) {
      const response = await fetch(base + route);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    }
    for (const method of ['GET', 'POST', 'OPTIONS']) {
      const response = await fetch(base + `${API_PREFIX}/auth/login`, { method, headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    }
    const allowed = await fetch(base + `${API_PREFIX}/auth/login`, { method: 'OPTIONS', headers: { Origin: process.env.APP_ORIGIN, 'Access-Control-Request-Method': 'POST' } });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), process.env.APP_ORIGIN);
    assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  });
  await t.test('own logo loads; foreign, unknown and encoded foreign paths fail closed', async () => {
    const own = await fetch(base + `/uploads/${logo}`, { headers: cookie });
    assert.equal(own.status, 200); assert.equal(await own.text(), 'owner-logo');
    for (const target of [otherLogo, otherLogo.replace('b', '%62'), 'cccc.png', '../uploads/' + otherLogo, '%2e%2e%2f' + otherLogo]) {
      const response = await fetch(base + '/uploads/' + target, { headers: cookie });
      assert.equal(response.status, 404, target);
      assert.ok(!(await response.text()).includes('other-logo'));
    }
    assert.equal((await fetch(base + `/uploads/${logo}`)).status, 401);
    active = false;
    assert.equal((await fetch(base + `/uploads/${logo}`, { headers: cookie })).status, 403);
    active = true;
  });
  await t.test('content-addressed logos resolve in the session organization only', async () => {
    const own = await fetch(base + `/uploads/logos/${shaA}.png`, { headers: cookie });
    assert.equal(own.status, 200);
    assert.equal(await own.text(), 'owner-content-logo');
    assert.equal(own.headers.get('cache-control'), 'private, max-age=31536000, immutable');
    assert.match(own.headers.get('content-type'), /^image\/png/);
    assert.equal(own.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await fetch(base + `/uploads/logos/${shaA}.png`, { method: 'HEAD', headers: cookie })).status, 200);
    // A foreign organization's sha is simply not in this organization's folder.
    for (const target of [`${shaB}.png`, `${'0'.repeat(64)}.png`, `${shaA}.PNG`, `${shaA.slice(1)}.png`, logo, `..%2f${shaA}.png`, `%2e%2e%2forg%2f${ORG_B}%2f${shaB}.png`, `${shaA}.png/extra`]) {
      const response = await fetch(base + '/uploads/logos/' + target, { headers: cookie });
      assert.equal(response.status, 404, target);
      const body = await response.text();
      assert.ok(!body.includes('other-content-logo') && !body.includes('owner-content-logo'), target);
      assert.equal(response.headers.get('cache-control'), 'private, no-store', target);
    }
    assert.equal((await fetch(base + `/uploads/org/${ORG_B}/${shaB}.png`, { headers: cookie })).status, 404);
    assert.equal((await fetch(base + `/uploads/logos/${shaA}.png`)).status, 401);
    active = false;
    assert.equal((await fetch(base + `/uploads/logos/${shaA}.png`, { headers: cookie })).status, 403);
    active = true;
    // The current-logo route keeps no-store: its meaning changes when the logo is removed.
    assert.equal((await fetch(base + `/uploads/${logo}`, { headers: cookie })).headers.get('cache-control'), 'private, no-store');
  });
  await t.test('JSON is bounded and malformed input stays generic', async () => {
    const large = await fetch(base + `${API_PREFIX}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(103000) }) });
    assert.equal(large.status, 413);
    const malformed = await fetch(base + `${API_PREFIX}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{private' });
    assert.equal(malformed.status, 400); assert.equal((await malformed.json()).error, 'Invalid JSON body');
  });
});

test('request error logs never include message, stack, metadata or arbitrary codes', () => {
  const handler = require('../utils/errorHandler');
  const original = console.error;
  const logs = [];
  console.error = (...args) => logs.push(JSON.stringify(args));
  try {
    for (const error of [
      { name: 'PrismaClientValidationError', message: 'secret-password', meta: { token: 'secret-password' } },
      { code: 'P2003', message: 'secret-password' },
      { name: 'secret-password', code: 'secret-password', message: 'secret-password', stack: 'secret-password' },
    ]) {
      let status;
      handler(error, { path: '/api/dispatches' }, { status(value) { status = value; return this; }, json(value) { assert.ok(!JSON.stringify(value).includes('secret-password')); } }, () => {});
      assert.ok([400, 500].includes(status));
    }
    assert.equal(logs.length, 3);
    assert.ok(logs.every(line => !line.includes('secret-password')));
    assert.ok(logs.some(line => line.includes('P2003')));
  } finally { console.error = original; }
});
