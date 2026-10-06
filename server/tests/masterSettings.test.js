const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../server');
const MasterSettings = require('../models/MasterSettings');

test('MasterSettings API', async (t) => {
  // connect to db
  await mongoose.connect('mongodb://localhost:27017/granitesync_test');
  await MasterSettings.deleteMany({});
  
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/master-settings/unit_04`;

  const request = async (method, path, body) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };

  await t.test('15. Handle missing settings / 1. Get existing settings', async () => {
    const { status, data } = await request('GET', '');
    assert.equal(status, 200);
    assert.equal(data.quarryId, 'unit_04');
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
    rateId = data.stoneRates[0]._id;
  });

  await t.test('Prevent duplicate stone rate', async () => {
    const { status } = await request('POST', '/stone-rates', { stoneType: 'Galaxy', finish: 'Slabs', defaultRate: 40 });
    assert.equal(status, 409);
  });

  await t.test('10. Update stone rate', async () => {
    const { status, data } = await request('PUT', `/stone-rates/${rateId}`, { defaultRate: 38 });
    assert.equal(status, 200);
    const rate = data.stoneRates.find(r => r._id === rateId);
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

  await t.test('Cleanup', async () => {
    server.close();
    await mongoose.disconnect();
  });
});
