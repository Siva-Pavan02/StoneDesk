const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const database = require('./database');
const app = require('../app');

// Real HTTP controllers and PostgreSQL; database.setup owns a disposable schema.
test('mixed products survive persistence, lifecycle, isolation and payment races', async t => {
  const db = await database.setup(t);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const org = await db.masterSettings.create({ data: { organizationId: 'MIXED-A', businessName: 'Mixed yard', stoneRates: [{ stoneType: 'Granite', finish: 'Polished', defaultRate: 40 }] } });
  const other = await db.masterSettings.create({ data: { organizationId: 'MIXED-B', businessName: 'Other yard', stoneRates: [] } });
  async function session(role, organizationId) {
    const user = await db.user.create({ data: { organizationId, role, name: role, email: `${role}-${organizationId}@integration.test`, passwordHash: 'unused', passwordSalt: 'unused' } });
    const token = randomBytes(32).toString('hex');
    await db.session.create({ data: { userId: user.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    return `stonedesk_session=${token}`;
  }
  const admin = await session('Admin', org.id), manager = await session('YardManager', org.id), dispatcher = await session('Dispatcher', org.id), outsider = await session('Admin', other.id);
  async function call(method, route, body, cookie = admin) {
    const r = await fetch(base + route, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: await r.json() };
  }
  const body = { clientRequestId: 'mixed-integration-001', partyName: 'Buyer', supervisor: 'Manager', logistics: { truckNumber: 'TEST01', buyerDestination: 'Yard' }, loadingAndRoyaltyFees: 0,
    inventory: [
      { stoneType: 'Granite', finish: 'Polished', ratePerSqFt: 40, measurementRows: [{ rowNo: 1, lengthFt: 3, widthFt: 2, quantity: 19, category: 'Regular' }, { rowNo: 1, lengthFt: 3.5, widthFt: 1.5, quantity: 2, category: 'TOP' }] },
      { stoneType: 'Basin', finish: '', rateUnit: 'UNIT', ratePerSqFt: 2500, measurementRows: [{ rowNo: 2, rateUnit: 'UNIT', quantity: 5, category: 'Regular' }] },
      { stoneType: 'Basin', finish: '', rateUnit: 'UNIT', ratePerSqFt: 2000, measurementRows: [{ rowNo: 3, rateUnit: 'UNIT', quantity: 1, category: 'Regular' }] }
    ], summary: { netBillableAmount: 1 } };
  let id, finalized, revised;
  function check(record, units = 5) {
    assert.equal(record.inventory.length, 3);
    const [stone, unit, discounted] = record.inventory;
    assert.equal(stone.totalSqFt, 124.5); assert.equal(stone.lineTotal, 4980);
    assert.equal(stone.measurementRows[1].category, 'TOP'); assert.equal(stone.measurementRows[1].lengthFt, 3.5);
    assert.equal(unit.stoneType, 'Basin'); assert.equal(unit.finish, ''); assert.equal(unit.rateUnit, 'UNIT'); assert.equal(unit.ratePerSqFt, 2500);
    assert.equal(unit.measurementRows[0].quantity, units); assert.equal(unit.totalSqFt, 0);
    assert.equal(unit.measurementRows[0].lengthFt, undefined); assert.equal(unit.measurementRows[0].widthFt, undefined);
    assert.equal(unit.lineTotal, units * 2500); assert.equal(discounted.ratePerSqFt, 2000);
    assert.equal(record.summary.netBillableAmount, 6980 + units * 2500);
  }
  await t.test('create/read/update mixed draft with authoritative totals', async () => {
    const created = await call('POST', '/dispatches', body, manager); assert.equal(created.status, 200); id = created.data.id;
    check(await db.dispatch.findUnique({ where: { id } }));
    check((await call('GET', `/dispatches/${id}`)).data);
    const repeats = await Promise.all([call('POST', '/dispatches', body), call('POST', '/dispatches', body)]);
    assert.ok(repeats.every(r => r.data.id === id)); assert.equal(await db.dispatch.count(), 1);
    const update = structuredClone(body); update.inventory[1].measurementRows[0].quantity = 6;
    assert.equal((await call('PUT', `/dispatches/${id}`, update, dispatcher)).status, 200);
    check(await db.dispatch.findUnique({ where: { id } }), 6);
  });
  await t.test('invalid mixed payloads never persist', async () => {
    for (const mutate of [x => x.inventory[1].rateUnit = 'INVALID', x => x.inventory[1].ratePerSqFt = -1, x => x.inventory[1].measurementRows[0].quantity = -1, x => x.inventory[0].measurementRows[0].lengthFt = 0, x => x.inventory[1].measurementRows[0].rateUnit = 'SQ_FT']) {
      const invalid = structuredClone(body); mutate(invalid);
      assert.equal((await call('PUT', `/dispatches/${id}`, invalid)).status, 400);
      check(await db.dispatch.findUnique({ where: { id } }), 6);
    }
  });
  await t.test('finalize/revise preserve mixed inventory and snapshot; stale revision rejected', async () => {
    assert.equal((await call('POST', `/dispatches/${id}/finalize`, {}, manager)).status, 403);
    const response = await call('POST', `/dispatches/${id}/finalize`, {}, dispatcher); assert.equal(response.status, 200);
    finalized = await db.dispatch.findUnique({ where: { id } }); check(finalized, 6); assert.equal(finalized.status, 'Dispatched'); assert.equal(finalized.businessSnapshot.businessName, 'Mixed yard');
    assert.equal((await call('PUT', `/dispatches/${id}/revise`, body, dispatcher)).status, 403);
    const result = await call('PUT', `/dispatches/${id}/revise`, { ...body, updatedAt: finalized.updatedAt }); assert.equal(result.status, 200);
    revised = await db.dispatch.findUnique({ where: { id } }); check(revised);
    assert.deepEqual(revised.revisions[0].inventory, finalized.inventory); assert.deepEqual(revised.businessSnapshot, finalized.businessSnapshot);
    assert.equal((await call('PUT', `/dispatches/${id}/revise`, { ...body, updatedAt: finalized.updatedAt })).status, 409);
    assert.equal((await db.dispatch.findUnique({ where: { id } })).revisions.length, 1);
    const race = await Promise.all([call('PUT', `/dispatches/${id}/revise`, { ...body, updatedAt: revised.updatedAt }), call('PUT', `/dispatches/${id}/revise`, { ...body, updatedAt: revised.updatedAt })]);
    assert.deepEqual(race.map(r => r.status).sort(), [200, 409]);
    check((await call('GET', `/dispatches/${id}`)).data);
    assert.equal((await db.dispatch.findUnique({ where: { id } })).revisions.length, 2);
  });
  await t.test('loading-list units/stone round trip and tenant boundaries', async () => {
    const create = await call('POST', '/loading-lists', { supervisor: 'Manager', buyerDestination: 'Yard', stoneType: 'Basin', finish: '', requirements: [{ rateUnit: 'UNIT', requiredQuantity: 5, loadedQuantity: 3 }] });
    assert.equal(create.status, 201); const listId = create.data.id;
    let list = await db.loadingList.findUnique({ where: { id: listId } }); assert.equal(list.stoneType, 'Basin'); assert.equal(list.requirements[0].balance, 2);
    assert.equal(list.requirements[0].lengthFt, undefined);
    const update = await call('PUT', `/loading-lists/${listId}`, { requirements: [{ ...list.requirements[0], loadedQuantity: 7 }] }); assert.equal(update.status, 200);
    list = (await call('GET', `/loading-lists/${listId}`)).data; assert.equal(list.requirements[0].balance, -2); assert.equal(list.requirements[0].rateUnit, 'UNIT');
    const stone = await call('POST', '/loading-lists', { supervisor: 'Manager', buyerDestination: 'Yard', stoneType: 'Granite', finish: 'Polished', requirements: [{ lengthFt: 3, widthFt: 2, requiredQuantity: 5, loadedQuantity: 1, loadedPieces: [{ lengthFt: 3, widthFt: 2 }] }] });
    assert.equal(stone.status, 201); assert.equal((await db.loadingList.findUnique({ where: { id: stone.data.id } })).requirements[0].balance, 4);
    const mixed = await call('POST', '/loading-lists', { supervisor: 'Manager', buyerDestination: 'Yard', stoneType: 'Mixed requirements', finish: 'Polished', requirements: [stone.data.requirements[0], list.requirements[0]] });
    assert.equal(mixed.status, 201);
    const savedMixed = await db.loadingList.findUnique({ where: { id: mixed.data.id } });
    assert.equal(savedMixed.requirements.length, 2); assert.equal(savedMixed.requirements[1].rateUnit, 'UNIT');
    assert.equal(savedMixed.requirements[0].balance, 4); assert.equal(savedMixed.requirements[1].balance, -2);
    for (const [method, route, data] of [['GET', `/dispatches/${id}`], ['PUT', `/dispatches/${id}`, body], ['GET', `/loading-lists/${listId}`], ['PUT', `/loading-lists/${listId}`, { requirements: [] }], ['GET', `/dispatches/${id}/payments`], ['POST', `/dispatches/${id}/payments`, { amount: 1 }]]) assert.equal((await call(method, route, data, outsider)).status, 404);
  });
  await t.test('mixed invoice payments persist and serialize competing requests', async () => {
    const route = `/dispatches/${id}/payments`;
    let state = (await call('GET', route)).data; assert.equal(state.status, 'PAYMENT_DUE'); assert.equal(state.received, 0); assert.equal(state.balance, 19480);
    assert.equal((await call('POST', route, { amount: 1 }, manager)).status, 403);
    assert.equal((await call('POST', route, { amount: 1000 }, dispatcher)).status, 201);
    const partials = await Promise.all([call('POST', route, { amount: 2000 }), call('POST', route, { amount: 3000 })]); assert.ok(partials.every(r => r.status === 201));
    state = (await call('GET', route)).data; assert.equal(state.status, 'PARTIALLY_PAID'); assert.equal(state.received, 6000); assert.equal(state.balance, 13480);
    const race = await Promise.all([call('POST', route, { amount: 13480 }), call('POST', route, { amount: 13480 })]); assert.deepEqual(race.map(r => r.status).sort(), [201, 400]);
    state = (await call('GET', route)).data; assert.equal(state.status, 'PAID'); assert.equal(state.balance, 0); assert.equal(state.received, 19480);
    const payments = await db.invoicePayment.findMany({ where: { dispatchId: id } }); assert.equal(payments.length, 4); assert.equal(payments.reduce((sum, p) => sum + Number(p.amount), 0), 19480);
  });
  await t.test('unit-only dispatch persists without stone dimensions', async () => {
    const response = await call('POST', '/dispatches', { ...body, clientRequestId: 'unit-only-integration', inventory: body.inventory.slice(1) });
    assert.equal(response.status, 200);
    const saved = await db.dispatch.findUnique({ where: { id: response.data.id } });
    assert.ok(saved.inventory.every(g => g.rateUnit === 'UNIT' && g.totalSqFt === 0));
    assert.equal(saved.summary.netBillableAmount, 14500);
    assert.equal((await call('POST', `/dispatches/${saved.id}/finalize`, {})).status, 200);
  });
  await t.test('legacy pieces survive database reload and buyer/driver projections', async () => {
    const legacy = { ...body, clientRequestId: 'legacy-integration', inventory: [{ stoneType: 'Legacy stone', finish: 'Honed', ratePerSqFt: 40, pieces: [{ lengthFt: 3, widthFt: 2 }] }] };
    const created = await call('POST', '/dispatches', legacy); assert.equal(created.status, 200);
    assert.equal((await call('POST', `/dispatches/${created.data.id}/finalize`, {})).status, 200);
    const record = await db.dispatch.findUnique({ where: { id: created.data.id } }); assert.equal(record.inventory[0].rateUnit, undefined); assert.equal(record.inventory[0].totalSqFt, 6); assert.equal(record.summary.netBillableAmount, 240);
    const { a4InvoiceFromDispatch, projectCopy } = await import('../../Frontend/src/utils/a4InvoiceModel.js');
    const buyer = a4InvoiceFromDispatch(record); assert.equal(buyer.totals.area, '6'); assert.equal(buyer.totals.netPayable, '240.00');
    const driver = projectCopy(buyer, 'driver'); assert.equal(driver.totals.area, '6'); assert.equal(driver.totals.netPayable, undefined); assert.equal(driver.groups[0].entries[0].ratePerSqFt, undefined);
  });
});
