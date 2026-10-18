const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = { session: { findFirst() { throw new Error('Unexpected database call'); } }, user: { findMany() { throw new Error('Unexpected database call'); } } };
require.cache[require.resolve('../utils/prisma')] = { exports: prisma };
const auth = require('../utils/auth');
const router = require('../routes/authRoutes');
const user = { id: 'user', organizationId: 'yard', name: 'Staff', email: 'staff@example.test', role: 'YardManager', active: true, supabaseUserId: 'google', passwordLogin: false, passwordHash: 'unused', passwordSalt: 'unused' };
const projected = select => Object.fromEntries(Object.keys(select).map(key => [key, user[key]]));
const request = () => ({ headers: { cookie: `stonedesk_session=${'a'.repeat(64)}` } });
test('session projection preserves identity without credentials or session metadata', async t => {
  let calls = 0;
  t.mock.method(prisma.session, 'findFirst', async args => {
    calls++;
    assert.match(args.where.tokenHash, /^[a-f0-9]{64}$/);
    assert.ok(args.where.expiresAt.gt instanceof Date);
    assert.deepEqual(Object.keys(args.select), ['user']);
    for (const key of ['passwordHash', 'passwordSalt', 'createdAt', 'updatedAt']) assert.equal(args.select.user.select[key], undefined);
    return { user: projected(args.select.user.select) };
  });
  const result = await auth.readSession(request());
  assert.deepEqual(auth.publicUser(result), auth.publicUser(user));
  assert.equal(result.supabaseUserId, user.supabaseUserId);
  assert.equal(await auth.readSession({ headers: {} }), null);
  assert.equal(calls, 1);
});
test('session projection retains inactive and absent session rejection', async t => {
  let row = { user: { ...projected(auth.userSelect), active: false } };
  t.mock.method(prisma.session, 'findFirst', async () => row);
  const res = { status(code) { this.code = code; return this; }, json() {} };
  const next = () => assert.fail('Unauthorized request must not proceed');
  await auth.requireSession(request(), res, next);
  assert.equal(res.code, 403);
  row = null;
  await auth.requireSession(request(), res, next);
  assert.equal(res.code, 401);
});
test('staff query retains tenant scope, ordering and public response', async t => {
  t.mock.method(prisma.user, 'findMany', async args => {
    assert.deepEqual(args.where, { organizationId: 'yard' });
    assert.deepEqual(args.orderBy, { createdAt: 'asc' });
    assert.equal(args.select.passwordHash, undefined);
    assert.equal(args.select.passwordSalt, undefined);
    return [projected(args.select)];
  });
  const handler = router.stack.find(layer => layer.route?.path === '/users' && layer.route.methods.get).route.stack.at(-1).handle;
  let response;
  await handler({ user }, { json(body) { response = body; } }, error => { throw error; });
  assert.deepEqual(response, [auth.publicUser(user)]);
});
