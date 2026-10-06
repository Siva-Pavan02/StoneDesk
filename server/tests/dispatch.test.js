const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../server');
const Dispatch = require('../models/Dispatch');
const MasterSettings = require('../models/MasterSettings');

test('Dispatch API', async (t) => {
  await mongoose.connect('mongodb://localhost:27017/granitesync_test');
  await Dispatch.deleteMany({});
  await MasterSettings.deleteMany({});
  
  await MasterSettings.create({
    quarryId: 'unit_04',
    defaultRoyaltyFee: 8500
  });

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const cookie = await require('./authHelper').adminCookie(`http://localhost:${port}`);
  const baseUrl = `http://localhost:${port}/api/dispatches`;

  const request = async (method, path, body) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };

  let dispatchId;
  let slipNumber;

  const validPayload = {
    supervisor: 'Siva',
    logistics: { truckNumber: 'TN01', buyerDestination: 'Chennai' },
    inventory: [
      {
        stoneType: 'Galaxy',
        finish: 'Slabs',
        ratePerSqFt: 100,
        pieces: [
          { lengthFt: 10, widthFt: 5 } // 50 sq ft
        ]
      }
    ]
  };

  await t.test('2. Reject missing supervisor', async () => {
    const p = { ...validPayload, supervisor: undefined };
    const { status } = await request('POST', '/', p);
    assert.equal(status, 400);
  });

  await t.test('3. Reject missing truck number', async () => {
    const p = { ...validPayload, logistics: { buyerDestination: 'Chennai' } };
    const { status } = await request('POST', '/', p);
    assert.equal(status, 400);
  });

  await t.test('4. Reject missing destination', async () => {
    const p = { ...validPayload, logistics: { truckNumber: 'TN01' } };
    const { status } = await request('POST', '/', p);
    assert.equal(status, 400);
  });

  await t.test('5. Reject empty inventory', async () => {
    const p = { ...validPayload, inventory: [] };
    const { status } = await request('POST', '/', p);
    assert.equal(status, 400);
  });

  await t.test('6. Reject invalid dimensions', async () => {
    const p = { ...validPayload, inventory: [{ ...validPayload.inventory[0], pieces: [{ lengthFt: -10, widthFt: 5 }] }] };
    const { status } = await request('POST', '/', p);
    assert.equal(status, 400);
  });

  await t.test('7. Reject negative rate', async () => {
    const p = { ...validPayload, inventory: [{ ...validPayload.inventory[0], ratePerSqFt: -100 }] };
    const { status } = await request('POST', '/', p);
    assert.equal(status, 400);
  });

  await t.test('1. Create valid Draft / 8-12. Calculations and snapshot', async () => {
    const { status, data } = await request('POST', '/', validPayload);
    assert.equal(status, 200);
    assert.equal(data.status, 'Draft');
    assert.equal(data.inventory[0].pieces[0].sqFt, 50); 
    assert.equal(data.inventory[0].lineTotal, 5000); 
    assert.equal(data.summary.totalDispatchVolumeSqFt, 50);
    assert.equal(data.summary.baseMaterialTotal, 5000);
    assert.equal(data.summary.loadingAndRoyaltyFees, 8500); 
    assert.equal(data.summary.netBillableAmount, 13500); 
    assert.ok(data.dispatchSlipNumber.startsWith('GS-')); 
    
    dispatchId = data._id;
    slipNumber = data.dispatchSlipNumber;
  });

  await t.test('13. Retrieve by ID', async () => {
    const { status, data } = await request('GET', `/${dispatchId}`);
    assert.equal(status, 200);
    assert.equal(data._id, dispatchId);
  });

  await t.test('14. Retrieve by slip number', async () => {
    const { status, data } = await request('GET', `/slip/${slipNumber}`);
    assert.equal(status, 200);
    assert.equal(data.dispatchSlipNumber, slipNumber);
  });

  await t.test('15. Update Draft', async () => {
    const updatedPayload = {
      ...validPayload,
      inventory: [
        {
          ...validPayload.inventory[0],
          pieces: [
            { lengthFt: 10, widthFt: 5 }, // 50
            { lengthFt: 10, widthFt: 5 }  // 50 => 100 total
          ]
        }
      ]
    };
    const { status, data } = await request('PUT', `/${dispatchId}`, updatedPayload);
    assert.equal(status, 200);
    assert.equal(data.summary.totalDispatchVolumeSqFt, 100);
    assert.equal(data.summary.baseMaterialTotal, 10000);
  });

  await t.test('17. Draft -> Dispatched (Finalize)', async () => {
    const { status, data } = await request('POST', `/${dispatchId}/finalize`);
    assert.equal(status, 200);
    assert.equal(data.status, 'Dispatched');
  });

  await t.test('16. Reject updating Dispatched', async () => {
    const { status } = await request('PUT', `/${dispatchId}`, validPayload);
    assert.equal(status, 400); 
  });

  await t.test('19. Reject Draft -> Delivered (via status endpoint)', async () => {
    const { data: newDraft } = await request('POST', '/', validPayload);
    const { status } = await request('PATCH', `/${newDraft._id}/status`, { status: 'Delivered' });
    assert.equal(status, 400); 
  });

  await t.test('18. Dispatched -> Delivered', async () => {
    const { status, data } = await request('PATCH', `/${dispatchId}/status`, { status: 'Delivered' });
    assert.equal(status, 200);
    assert.equal(data.status, 'Delivered');
  });

  await t.test('20. Reject Delivered -> Draft (not exposed anyway)', async () => {
    const { status } = await request('PATCH', `/${dispatchId}/status`, { status: 'Draft' });
    assert.equal(status, 400);
  });

  await t.test('16 / 22. Historical Immutability Test', async () => {
    await MasterSettings.updateOne({ quarryId: 'unit_04' }, { defaultRoyaltyFee: 15000 });
    
    const { status, data } = await request('GET', `/${dispatchId}`);
    assert.equal(status, 200);
    
    assert.equal(data.summary.loadingAndRoyaltyFees, 8500, 'Royalty changed! Should be immutable.');
    assert.equal(data.inventory[0].ratePerSqFt, 100, 'Rate changed! Should be immutable.');
    assert.equal(data.summary.netBillableAmount, 18500);
  });

  await t.test('Cleanup', async () => {
    server.close();
    await mongoose.disconnect();
  });
});
