const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const database = require('./database');
const app = require('../app');
test('invitations enforce issuer, email, role, expiry, revocation and atomic one-time use', async t => {
  await database.setup(t);
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const owner = await require('./authHelper').adminCookie(base);
  const call = async (path, method, body, cookie = owner) => {
    const r = await fetch(base + '/api/auth' + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json(), cookie: r.headers.getSetCookie().find(c => c.startsWith('stonedesk_session=') && !c.startsWith('stonedesk_session=;'))?.split(';')[0] };
  };
  const issue = async email => (await call('/invitations', 'POST', { email, role: 'YardManager' })).data;
  const signup = (token, email) => call('/signup', 'POST', { invitationToken: token, email, password: 'Disposable-test-password-2026', name: 'Member', role: 'Admin' }, null);
  assert.equal((await call('/invitations', 'POST', { email: 'x@example.test', role: 'Admin' })).status, 400);
  assert.equal((await call('/invitations', 'POST', { email: 'x@example.test', role: 'Dispatcher' }, null)).status, 401);
  const i = await issue('member@example.test');
  assert.equal((await signup(i.token, 'wrong@example.test')).status, 400);
  const stored = await database.prisma.invitation.findUnique({ where: { id: i.id } });
  assert.equal(stored.tokenHash, createHash('sha256').update(i.token).digest('hex'));
  assert.equal(JSON.stringify((await call('/invitations','GET')).data).includes(i.token), false);
  const results = await Promise.all([signup(i.token, i.email), signup(i.token, i.email)]);
  assert.equal(results.filter(r => r.status === 201).length, 1);
  const joined = results.find(r => r.status === 201);
  assert.equal(joined.data.user.role, 'Yard Manager');
  assert.equal((await call('/invitations', 'GET', undefined, joined.cookie)).status, 403);
  for (const state of ['expired', 'revoked', 'issuer-paused']) {
    const item = await issue(`${state}@example.test`);
    if (state === 'expired') await database.prisma.invitation.update({ where: { id: item.id }, data: { expiresAt: new Date(0) } });
    if (state === 'revoked') assert.equal((await call(`/invitations/${item.id}`, 'DELETE')).status, 200);
    if (state === 'issuer-paused') await database.prisma.user.updateMany({ where: { role: 'Admin' }, data: { active: false } });
    assert.equal((await signup(item.token, item.email)).status, 400);
  }
});
