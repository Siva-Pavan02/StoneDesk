const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const database = require('./database');
const app = require('../app');

test('payment statement is tenant scoped and reconciles one invoice snapshot', async (t) => {
  const prisma = await database.setup(t);
  const [paymentIndex] = await prisma.$queryRaw`
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'InvoicePayment_org_clientRequestId_key'
  `;
  assert.match(paymentIndex?.indexdef || '', /UNIQUE INDEX.*organizationId.*clientRequestId.*WHERE.*IS NOT NULL/i);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function call(path, method = 'GET', body, cookie) {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sessionCookie = response.headers.getSetCookie().find(value => value.startsWith('stonedesk_session=') && !value.startsWith('stonedesk_session=;'));
    return { status: response.status, data: await response.json(), cookie: sessionCookie?.split(';')[0] };
  }
  const signup = await call('/auth/signup', 'POST', {
    email: `statement-${randomUUID()}@example.test`, password: 'TestPassword123!',
    name: 'Statement Owner', createOrganization: true, businessName: 'Statement Stone',
  });
  assert.equal(signup.status, 201);
  const cookie = signup.cookie;
  const settings = await prisma.masterSettings.findFirst({ where: { organizationId: signup.data.organizationCode } });
  await prisma.masterSettings.update({ where: { id: settings.id }, data: {
    businessName: 'Statement Stone', defaultRoyaltyFee: 0,
    stoneRates: [{ stoneType: 'Granite', finish: 'Polished', ratePerSqFt: 40.5 }],
  } });
  const draft = await call('/dispatches', 'POST', {
    supervisor: 'Supervisor', partyName: 'Statement Buyer',
    date: new Date().toISOString(), logistics: { truckNumber: 'AP01AB1234', buyerDestination: 'Kadapa' },
    inventory: [{ stoneType: 'Granite', finish: 'Polished', ratePerSqFt: 40.5,
      measurementRows: [{ rowNo: 1, lengthFt: 3.25, widthFt: 2.5, quantity: 4, category: 'Regular' }] }],
    loadingAndRoyaltyFees: 150.5,
  }, cookie);
  assert.equal(draft.status, 200);
  const id = draft.data.id;
  assert.equal((await call(`/dispatches/${id}/payment-statement`, 'GET', undefined, cookie)).status, 409);
  assert.equal((await call(`/dispatches/${id}/finalize`, 'POST', {}, cookie)).status, 200);
  const firstRequestId = randomUUID();
  const saved = await call(`/dispatches/${id}/payments`, 'POST', {
    amount: 500.1, note: '  Bank transfer  ', clientRequestId: firstRequestId,
  }, cookie);
  assert.equal(saved.status, 201);
  const statement = await call(`/dispatches/${id}/payment-statement`, 'GET', undefined, cookie);
  assert.equal(statement.status, 200);
  assert.equal(statement.data.timeZone, 'Asia/Kolkata');
  assert.ok(Number.isFinite(Date.parse(statement.data.asOf)));
  assert.deepEqual({
    total: statement.data.invoice.total, received: statement.data.received,
    balance: statement.data.balance, excess: statement.data.excess, status: statement.data.status,
  }, { total: '1466.75', received: '500.10', balance: '966.65', excess: '0.00', status: 'PARTIALLY_PAID' });
  assert.equal(statement.data.invoice.revisionNumber, 1);
  assert.equal(statement.data.invoice.calculationVersion, 2);
  assert.deepEqual(statement.data.payments.map(p => [p.amount, p.note]), [['500.10', 'Bank transfer']]);
  assert.equal((await call(`/dispatches/${id}/payments`, 'POST', {
    amount: 966.65, clientRequestId: randomUUID(),
  }, cookie)).status, 201);
  let analytics = await call('/dispatches/analytics?period=all', 'GET', undefined, cookie);
  assert.equal(analytics.status, 200);
  assert.equal(analytics.data.paymentAnalytics.current.completedInvoices, 1);
  const original = await call(`/dispatches/${id}`, 'GET', undefined, cookie);
  const revised = await call(`/dispatches/${id}/revise`, 'PUT', {
    ...original.data, updatedAt: original.data.updatedAt, loadingAndRoyaltyFees: 683.75,
  }, cookie);
  assert.equal(revised.status, 200);
  assert.equal(revised.data.summary.netBillableAmount, 2000);
  analytics = await call('/dispatches/analytics?period=all', 'GET', undefined, cookie);
  assert.equal(analytics.data.paymentAnalytics.current.completedInvoices, 0);
  assert.equal((await call(`/dispatches/${id}/payments`, 'POST', {
    amount: 533.25, clientRequestId: randomUUID(),
  }, cookie)).status, 201);
  analytics = await call('/dispatches/analytics?period=all', 'GET', undefined, cookie);
  assert.equal(analytics.data.paymentAnalytics.current.completedInvoices, 1);
  const revisedStatement = await call(`/dispatches/${id}/payment-statement`, 'GET', undefined, cookie);
  assert.equal(revisedStatement.data.invoice.revisionNumber, 2);
  assert.equal(revisedStatement.data.invoice.total, '2000.00');
  assert.equal(revisedStatement.data.balance, '0.00');
  const future = await prisma.dispatch.create({ data: {
    organizationId: settings.id, clientRequestId: randomUUID(),
    dispatchSlipNumber: `GS-${randomUUID()}`,
    date: new Date(Date.now() + 7 * 86400000), supervisor: original.data.supervisor,
    partyName: original.data.partyName, logistics: original.data.logistics,
    inventory: original.data.inventory, summary: original.data.summary,
    businessSnapshot: original.data.businessSnapshot, revisions: [], status: 'Dispatched',
  } });
  await prisma.invoicePayment.create({ data: {
    organizationId: settings.id, dispatchId: future.id,
    amount: '100.00', clientRequestId: randomUUID(),
  } });
  analytics = await call('/dispatches/analytics?period=all', 'GET', undefined, cookie);
  assert.equal(analytics.status, 200);
  assert.equal(analytics.data.paymentAnalytics.current.received, 2100);
  assert.equal(analytics.data.paymentAnalytics.current.outstanding, 0);
  assert.equal(analytics.data.paymentAnalytics.current.completedInvoices, 1);
  const receivables = await call('/dispatches/receivables?party=Statement%20Buyer', 'GET', undefined, cookie);
  assert.equal(receivables.status, 200);
  assert.equal(receivables.data.data.some(row => row.id === future.id), false);
  const list = await call('/dispatches?limit=20', 'GET', undefined, cookie);
  assert.equal(list.data.data.some(row => row.id === future.id), true);
  const crossInvoice = await call(`/dispatches/${future.id}/payments`, 'POST', {
    amount: 1, clientRequestId: firstRequestId,
  }, cookie);
  assert.equal(crossInvoice.status, 409);
  const concurrent = await prisma.dispatch.create({ data: {
    organizationId: settings.id, clientRequestId: randomUUID(), dispatchSlipNumber: `GS-${randomUUID()}`,
    date: new Date(), supervisor: original.data.supervisor, partyName: original.data.partyName,
    logistics: original.data.logistics, inventory: original.data.inventory,
    summary: original.data.summary, businessSnapshot: original.data.businessSnapshot,
    revisions: [], status: 'Dispatched',
  } });
  const concurrentKey = randomUUID();
  const concurrentResponses = await Promise.all([1, 2].map(() => call(`/dispatches/${concurrent.id}/payments`, 'POST', {
    amount: 100, clientRequestId: concurrentKey,
  }, cookie)));
  assert.deepEqual(concurrentResponses.map(response => response.status).sort(), [200, 201]);
  assert.equal(await prisma.invoicePayment.count({ where: { dispatchId: concurrent.id } }), 1);
  const raceInvoice = await prisma.dispatch.create({ data: {
    organizationId: settings.id, clientRequestId: randomUUID(), dispatchSlipNumber: `GS-${randomUUID()}`,
    date: new Date(), supervisor: original.data.supervisor, partyName: original.data.partyName,
    logistics: original.data.logistics, inventory: original.data.inventory,
    summary: original.data.summary, businessSnapshot: original.data.businessSnapshot,
    revisions: [], status: 'Dispatched',
  } });
  const [racePayment, raceRevision] = await Promise.all([
    call(`/dispatches/${raceInvoice.id}/payments`, 'POST', { amount: 1000, clientRequestId: randomUUID() }, cookie),
    call(`/dispatches/${raceInvoice.id}/revise`, 'PUT', {
      ...original.data, updatedAt: raceInvoice.updatedAt.toISOString(),
      inventory: original.data.inventory.map(group => ({ ...group, ratePerSqFt: 10 })),
      loadingAndRoyaltyFees: 175,
    }, cookie),
  ]);
  assert.ok([[201, 409], [400, 200]].some(pair => pair[0] === racePayment.status && pair[1] === raceRevision.status));
  const raceState = await call(`/dispatches/${raceInvoice.id}/payments`, 'GET', undefined, cookie);
  assert.ok(raceState.data.invoiceTotal >= raceState.data.received);
  const other = await call('/auth/signup', 'POST', {
    email: `other-${randomUUID()}@example.test`, password: 'TestPassword123!',
    name: 'Other Owner', createOrganization: true, businessName: 'Other Stone',
  });
  assert.equal(other.status, 201);
  assert.equal((await call(`/dispatches/${id}/payment-statement`, 'GET', undefined, other.cookie)).status, 404);
  const otherSettings = await prisma.masterSettings.findFirst({ where: { organizationId: other.data.organizationCode } });
  const otherInvoice = await prisma.dispatch.create({ data: {
    organizationId: otherSettings.id, clientRequestId: randomUUID(), dispatchSlipNumber: `GS-${randomUUID()}`,
    date: new Date(), supervisor: original.data.supervisor, partyName: 'Other Buyer',
    logistics: original.data.logistics, inventory: original.data.inventory,
    summary: original.data.summary, businessSnapshot: original.data.businessSnapshot,
    revisions: [], status: 'Dispatched',
  } });
  assert.equal((await call(`/dispatches/${otherInvoice.id}/payments`, 'POST', {
    amount: 500.1, note: 'Bank transfer', clientRequestId: firstRequestId,
  }, other.cookie)).status, 201);
  await prisma.dispatch.update({ where: { id: concurrent.id }, data: {
    summary: { ...original.data.summary, netBillableAmount: 1466.755 },
  } });
  assert.equal((await call(`/dispatches/${concurrent.id}/payments`, 'GET', undefined, cookie)).status, 500);
  assert.equal((await call('/dispatches/analytics?period=all', 'GET', undefined, cookie)).status, 500);
  const inventory = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, '../scripts/auditInvoiceMoney.js')], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8',
    env: { ...process.env, AUDIT_DATABASE_URL: process.env.DIRECT_URL },
  }));
  assert.ok(inventory.anomalies.some(row => row.dispatchId === concurrent.id));
});
