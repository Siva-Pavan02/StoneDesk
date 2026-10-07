const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('./database');
const prisma = database.prisma;
const http = require('http');
const app = require('../server');
const API_PREFIX = '/api';

test('MasterSettings API', async (t) => {
  // connect to db
  await database.setup(t);

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const base = `http://localhost:${port}`;
  const signupRes = await fetch(`${base}${API_PREFIX}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test Owner', createOrganization: true, businessName: 'Test Yard', email: 'owner@example.test', password: 'SecurePass123!' }) });
  const cookie = signupRes.headers.getSetCookie().find(value => value.startsWith('stonedesk_session=') && !value.startsWith('stonedesk_session=;')).split(';')[0];
  const signupData = await signupRes.json();
  const organizationId = signupData.organizationCode;
  const baseUrl = `${base}${API_PREFIX}/master-settings/${organizationId}`;

  const request = async (method, path, body) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };

  await t.test('15. Handle missing settings / 1. Get existing settings', async () => {
    const { status, data } = await request('GET', '');
    assert.equal(status, 200);
    assert.match(data.organizationId, /^[A-Z0-9-]+-[A-Z0-9]{6}$/);
    assert.equal(data.defaultRoyaltyFee, 0);
  });

  await t.test('3. Add truck', async () => {
    const { status, data } = await request('POST', '/trucks', { truckNumber: 'TN01AA1111' });
    assert.equal(status, 200);
    assert.ok(data.savedTrucks.includes('TN01AA1111'));
  });

  await t.test('4. Prevent duplicate truck', async () => {
    const { status } = await request('POST', '/trucks', { truckNumber: 'tn01aa1111' });
    assert.equal(status, 409);
  });

  await t.test('5. Delete truck', async () => {
    const { status, data } = await request('DELETE', '/trucks/TN01AA1111');
    assert.equal(status, 200);
    assert.equal(data.savedTrucks.includes('TN01AA1111'), false);
  });

  await t.test('6. Add destination', async () => {
    const { status, data } = await request('POST', '/destinations', { destination: 'Salem' });
    assert.equal(status, 200);
    assert.ok(data.savedDestinations.includes('Salem'));
  });

  await t.test('7. Prevent duplicate destination', async () => {
    const { status } = await request('POST', '/destinations', { destination: 'Salem' });
    assert.equal(status, 409);
  });

  await t.test('8. Delete destination', async () => {
    const { status, data } = await request('DELETE', '/destinations/Salem');
    assert.equal(status, 200);
    assert.equal(data.savedDestinations.includes('Salem'), false);
  });

  let rateId = null;
  await t.test('9. Add stone rate', async () => {
    const { status, data } = await request('POST', '/stone-rates', { stoneType: 'Galaxy', finish: 'Slabs', defaultRate: 35 });
    assert.equal(status, 200);
    assert.equal(data.stoneRates[0].defaultRate, 35);
    rateId = data.stoneRates[0].id;
  });

  await t.test('Prevent duplicate stone rate', async () => {
    const { status } = await request('POST', '/stone-rates', { stoneType: 'Galaxy', finish: 'Slabs', defaultRate: 40 });
    assert.equal(status, 409);
  });

  await t.test('10. Update stone rate', async () => {
    const { status, data } = await request('PUT', `/stone-rates/${rateId}`, { defaultRate: 38 });
    assert.equal(status, 200);
    const rate = data.stoneRates.find(r => r.id === rateId);
    assert.equal(rate.defaultRate, 38);
  });

  await t.test('13. Reject negative rate', async () => {
    const { status } = await request('PUT', `/stone-rates/${rateId}`, { defaultRate: -5 });
    assert.equal(status, 400);
  });

  await t.test('11. Delete stone rate', async () => {
    const { status, data } = await request('DELETE', `/stone-rates/${rateId}`);
    assert.equal(status, 200);
    assert.equal(data.stoneRates.length, 0);
  });

  await t.test('12. Update royalty', async () => {
    const { status, data } = await request('PUT', '/royalty', { defaultRoyaltyFee: 9000 });
    assert.equal(status, 200);
    assert.equal(data.defaultRoyaltyFee, 9000);
  });

  await t.test('14. Reject negative royalty', async () => {
    const { status } = await request('PUT', '/royalty', { defaultRoyaltyFee: -100 });
    assert.equal(status, 400);
  });

  await t.test('16. Handle invalid requests (empty truck)', async () => {
    const { status } = await request('POST', '/trucks', { truckNumber: '  ' });
    assert.equal(status, 400);
  });

  await t.test('Concurrent catalogue changes retain all entries and unique IDs', async () => {
    const results = await Promise.all(['A', 'B', 'C'].map(stoneType => request('POST', '/stone-rates', { stoneType, finish: 'Honed', defaultRate: 10 })));
    assert.ok(results.every(r => r.status === 200), JSON.stringify(results));
    const { data } = await request('GET', '');
    assert.deepEqual(data.stoneRates.map(r => r.stoneType).sort(), ['A', 'B', 'C']);
    assert.equal(new Set(data.stoneRates.map(r => r.id)).size, 3);
    assert.match(data.id, /^[a-f0-9-]{36}$/);
    const duplicates = await Promise.all([1,2].map(() => request('POST', '/trucks', { truckNumber: 'AP01' })));
    assert.deepEqual(duplicates.map(r => r.status).sort(), [200,409]);
    const invalid = await request('PUT', '', { stoneRates: [{ id:'same', stoneType:'X', finish:'Honed', defaultRate:1 }, { id:'same', stoneType:'Y', finish:'Honed', defaultRate:2 }] });
    assert.equal(invalid.status, 400);
    assert.equal((await request('DELETE', '/stone-rates/missing')).status, 404);
  });
  await t.test('Cleanup', async () => {
    await new Promise(resolve => server.close(resolve));

  });
});
