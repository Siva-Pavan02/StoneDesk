const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('./database');
const app = require('../app');

test('dispatch search covers older records and retains tenant, status and pagination filters', async t => {
  await database.setup(t);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = await require('./authHelper').adminCookie(base);
  const org = await database.prisma.masterSettings.findFirst();
  const other = await database.prisma.masterSettings.create({ data: { organizationId: 'OTHER-SEARCH' } });
  const record = (organizationId, n, partyName, status = 'Draft') => ({ organizationId, dispatchSlipNumber: `SEARCH-${n}`, supervisor: 'Test', partyName, status, logistics: { truckNumber: `AP-${n}`, buyerDestination: 'Kadapa' }, inventory: [], summary: {}, createdAt: new Date(2026, 0, n) });
  await database.prisma.dispatch.createMany({ data: [
    ...Array.from({ length: 25 }, (_, n) => record(org.id, n + 1, n < 2 ? 'Old Party' : 'Recent Party')),
    record(other.id, 40, 'Old Party'), record(org.id, 41, 'Old Party', 'Delivered')
  ] });
  const get = async query => { const r = await fetch(`${base}/api/dispatches?${query}`, { headers: { Cookie: cookie } }); return { status: r.status, data: await r.json() }; };
  const first = await get('q=old%20party&status=Draft&limit=1');
  assert.equal(first.status, 200);
  assert.equal(first.data.data.length, 1);
  assert.equal(first.data.data[0].dispatchSlipNumber, 'SEARCH-2');
  assert.equal(first.data.data[0].inventory, undefined);
  const second = await get(`q=old%20party&status=Draft&limit=1&cursor=${first.data.nextCursor}`);
  assert.equal(second.data.data[0].dispatchSlipNumber, 'SEARCH-1');
  assert.equal(second.data.nextCursor, null);
  assert.equal((await get('q=ap-1')).status, 200);
  assert.equal((await get('q=kADapa')).data.data.length, 20);
  assert.equal((await get('q=' + 'x'.repeat(121))).status, 400);
});
