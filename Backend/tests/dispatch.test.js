const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('./database');
const prisma = database.prisma;
const http = require('http');
const app = require('../app');
const API_PREFIX = '/api';

test('Dispatch API', async (t) => {
  await database.setup(t);


  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const cookie = await require('./authHelper').adminCookie(`http://localhost:${port}`);
  const org = await prisma.masterSettings.findFirst();
  await prisma.masterSettings.update({where:{id:org.id}, data:{defaultRoyaltyFee:8500}});
  const baseUrl = `http://localhost:${port}${API_PREFIX}/dispatches`;

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
    const { status, data } = await request('POST', '/', p);
    assert.equal(status, 400);
    assert.deepEqual(data, { error: 'Invalid manager' });
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

    dispatchId = data.id;
    slipNumber = data.dispatchSlipNumber;
  });

  await t.test('13. Retrieve by ID', async () => {
    const { status, data } = await request('GET', `/${dispatchId}`);
    assert.equal(status, 200);
    assert.equal(data.id, dispatchId);
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
    const { status } = await request('PATCH', `/${newDraft.id}/status`, { status: 'Delivered' });
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

  // Signs a user into a fresh session and returns a fetch helper for them.
  const signedInAs = async (organizationId, role, email) => {
    const crypto = require('node:crypto');
    const user = await prisma.user.create({ data: { organizationId, name: role, email,
      passwordHash: 'dummy', passwordSalt: 'dummy', role, active: true } });
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.session.create({ data: { tokenHash: crypto.createHash('sha256').update(token).digest('hex'), userId: user.id, expiresAt: new Date(Date.now() + 1000000) } });
    return async (method, path, body) => {
      const res = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: `stonedesk_session=${token}` }, body: body ? JSON.stringify(body) : undefined });
      return { status: res.status, data: await res.json().catch(() => null) };
    };
  };

  await t.test('21. Dispatcher cannot move Delivered back', async () => {
    const { organizationId } = await prisma.dispatch.findUnique({ where: { id: dispatchId } });
    const asDispatcher = await signedInAs(organizationId, 'Dispatcher', 'dispatcher@dispatch.test');
    assert.equal((await asDispatcher('PATCH', `/${dispatchId}/status`, { status: 'Dispatched' })).status, 403);
    assert.equal((await request('GET', `/${dispatchId}`)).data.status, 'Delivered');
  });

  await t.test('22. Admin moves Delivered -> Dispatched', async () => {
    const before = (await request('GET', `/${dispatchId}`)).data;
    const { status, data } = await request('PATCH', `/${dispatchId}/status`, { status: 'Dispatched', updatedAt: before.updatedAt });
    assert.equal(status, 200);
    assert.equal(data.status, 'Dispatched');
    assert.equal(data.dispatchSlipNumber, slipNumber);
    assert.deepEqual(data.summary, before.summary);
    assert.ok(new Date(data.updatedAt) > new Date(before.updatedAt));
  });

  await t.test('23. Admin can mark it delivered again', async () => {
    const { status, data } = await request('PATCH', `/${dispatchId}/status`, { status: 'Delivered' });
    assert.equal(status, 200);
    assert.equal(data.status, 'Delivered');
  });

  await t.test('24. Stale updatedAt is rejected', async () => {
    const { status } = await request('PATCH', `/${dispatchId}/status`, { status: 'Dispatched', updatedAt: '2000-01-01T00:00:00.000Z' });
    assert.equal(status, 409);
    assert.equal((await request('GET', `/${dispatchId}`)).data.status, 'Delivered');
  });

  await t.test('25. Delivered -> Draft still rejected for admin', async () => {
    assert.equal((await request('PATCH', `/${dispatchId}/status`, { status: 'Draft' })).status, 400);
  });

  await t.test('26. Other organization gets 404', async () => {
    const otherOrg = await prisma.masterSettings.create({ data: { organizationId: 'status-test-other-org' } });
    const asOtherAdmin = await signedInAs(otherOrg.id, 'Admin', 'other-admin@dispatch.test');
    assert.equal((await asOtherAdmin('PATCH', `/${dispatchId}/status`, { status: 'Dispatched' })).status, 404);
    assert.equal((await request('GET', `/${dispatchId}`)).data.status, 'Delivered');
  });

  await t.test('16 / 22. Historical Immutability Test', async () => {
    await prisma.masterSettings.update({ where: { id: org.id }, data: { defaultRoyaltyFee: 15000 } });

    const { status, data } = await request('GET', `/${dispatchId}`);
    assert.equal(status, 200);

    assert.equal(data.summary.loadingAndRoyaltyFees, 8500, 'Royalty changed! Should be immutable.');
    assert.equal(data.inventory[0].ratePerSqFt, 100, 'Rate changed! Should be immutable.');
    assert.equal(data.summary.netBillableAmount, 18500);
  });

  await t.test('Any role deletes a Draft; only Admin deletes a finalized invoice', async () => {
    const crypto = require('node:crypto');
    const staff = await prisma.user.create({ data: { organizationId: org.id, name: 'Yard Operator', email: 'yard@dispatch.test',
      passwordHash: 'dummy', passwordSalt: 'dummy', role: 'YardManager', active: true } });
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.session.create({ data: { tokenHash: crypto.createHash('sha256').update(token).digest('hex'), userId: staff.id, expiresAt: new Date(Date.now() + 1000000) } });
    const asStaff = async (method, path, body) => {
      const res = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: `stonedesk_session=${token}` }, body: body ? JSON.stringify(body) : undefined });
      return { status: res.status, data: await res.json().catch(() => null) };
    };
    const draft = await asStaff('POST', '', validPayload);
    assert.equal(draft.status, 200);
    const removed = await asStaff('DELETE', `/${draft.data.id}`);
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.data, { ok: true, id: draft.data.id, paymentsRemoved: 0 });
    assert.equal((await request('GET', `/${draft.data.id}`)).status, 404);

    const finalized = await request('POST', '', validPayload);
    assert.equal((await request('POST', `/${finalized.data.id}/finalize`)).status, 200);
    assert.equal((await asStaff('DELETE', `/${finalized.data.id}`)).status, 403);
    assert.equal((await request('GET', `/${finalized.data.id}`)).status, 200);
    assert.equal((await request('DELETE', `/${finalized.data.id}`)).status, 200);
  });

  await t.test('Saving a load remembers truck and destination once', async () => {
    await prisma.masterSettings.update({ where: { id: org.id }, data: { savedTrucks: [], savedDestinations: [] } });
    const first = await request('POST', '/', { ...validPayload, logistics: { truckNumber: 'tn01ab1234', buyerDestination: ' Kadapa ' } });
    assert.equal(first.status, 200);
    let settings = await prisma.masterSettings.findUnique({ where: { id: org.id } });
    assert.deepEqual(settings.savedTrucks, ['TN 01 AB 1234']);
    assert.deepEqual(settings.savedDestinations, ['Kadapa']);
    const second = await request('POST', '/', { ...validPayload, logistics: { truckNumber: 'TN 01 AB 1234', buyerDestination: 'kadapa' } });
    assert.equal(second.status, 200);
    settings = await prisma.masterSettings.findUnique({ where: { id: org.id } });
    assert.deepEqual(settings.savedTrucks, ['TN 01 AB 1234']);
    assert.deepEqual(settings.savedDestinations, ['Kadapa']);
  });
  await t.test('Cleanup', async () => {
    await new Promise(resolve => server.close(resolve));

  });
});
