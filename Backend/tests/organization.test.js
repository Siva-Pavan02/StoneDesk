const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('./database');
const app = require('../server');
const { organizationCode } = require('../utils/organizationCode');
const API_PREFIX = '/api';

test('generated codes are readable, short and safe for non-Latin business names', () => {
  assert.match(organizationCode('Sri Granite'), /^SRI-GRANITE-[A-Z2-9]{6}$/);
  assert.match(organizationCode('రాయి'), /^STONE-YARD-[A-Z2-9]{6}$/);
  assert.ok(organizationCode('Very long '.repeat(20)).length <= 29);
});
test('organization creation, joining and membership remain isolated', async t => {
  await database.setup(t);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}${API_PREFIX}`;
  async function call(path, body, cookie, method = 'POST') {
    const r = await fetch(base + path, {method, headers:{'Content-Type':'application/json', ...(cookie ? {Cookie:cookie}: {})}, body:body ? JSON.stringify(body):undefined});
    return {status:r.status, data:await r.json(), cookie:r.headers.getSetCookie().find(v=>v.startsWith('stonedesk_session=')&&!v.startsWith('stonedesk_session=;'))?.split(';')[0]};
  }
  const password = 'Disposable-test-password-2026';
  const create = name => call('/auth/signup', {email:`${name}@example.test`,password,name,createOrganization:true,businessName:'Sri Granite'});
  const a = await create('alice'), b = await create('mallory');
  assert.equal(a.status,201); assert.equal(b.status,201);
  assert.notEqual(a.data.organizationCode,b.data.organizationCode);
  const join = await call('/auth/signup', {email:'bob@example.test',name:'Bob',password,organizationId:a.data.organizationCode.toLowerCase(),role:'Admin'});
  assert.equal(join.status,201); assert.equal(join.data.user.organizationId,a.data.user.organizationId); assert.equal(join.data.user.role,'Dispatcher');
  assert.equal((await call('/auth/signup',{email:'bob@example.test',name:'Bob',password,organizationId:a.data.organizationCode})).status,409);
  assert.equal((await call('/auth/signup',{email:'unknown@example.test',name:'Unknown',password,organizationId:'MISSING-ORG'})).status,404);
  const before = await database.prisma.user.findUnique({where:{id:join.data.user.id}});
  assert.equal((await call(`/auth/users/${join.data.user.id}`,{role:'Admin',active:false},b.cookie,'PATCH')).status,404);
  const after = await database.prisma.user.findUnique({where:{id:join.data.user.id}});
  assert.equal(after.role,before.role); assert.equal(after.active,before.active);
  assert.equal((await call(`/auth/users/${join.data.user.id}`,{role:'Yard Manager',active:true},a.cookie,'PATCH')).status,200);
  const event = await database.prisma.auditLog.findFirst({ where: { action: 'user.role_change', organizationId: a.data.user.organizationId }, orderBy: { timestamp: 'desc' } });
  assert.ok(event, 'Role change must persist an audit record');
  const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
  assert.equal(details.oldRole, 'Dispatcher');
  assert.equal(details.newRole, 'YardManager');
  const settings = await call(`/master-settings/${a.data.organizationCode}`,null,a.cookie,'GET');
  assert.equal(settings.data.id,a.data.user.organizationId); assert.equal(settings.data.organizationId,a.data.organizationCode);
  assert.deepEqual(settings.data.stoneRates,[]);
  assert.equal(await database.prisma.masterSettings.count(),2);
  assert.equal((await call('/auth/users',null,b.cookie,'GET')).data.length,1);
});
