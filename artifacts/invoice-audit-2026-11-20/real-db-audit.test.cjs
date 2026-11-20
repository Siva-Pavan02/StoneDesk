const test = require('node:test');
const http = require('node:http');
const database = require('../../Backend/tests/database');
const app = require('../../Backend/app');

test('isolated real API invoice audit observations', async t => {
  const prisma = await database.setup(t);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, method = 'GET', body, cookie) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json(), cookie: res.headers.getSetCookie().find(x => x.startsWith('stonedesk_session=') && !x.startsWith('stonedesk_session=;'))?.split(';')[0] };
  };
  const owner = await call('/auth/signup', 'POST', {
    email: 'invoice-audit@example.test', password: 'TestPassword123!', name: 'Invoice Audit',
    createOrganization: true, businessName: 'Invoice Audit Stone Works',
  });
  if (owner.status !== 201) throw new Error(`Signup failed: ${owner.status} ${JSON.stringify(owner.body)}`);
  const cookie = owner.cookie;
  const settings = await prisma.masterSettings.findFirst({ where: { organizationId: owner.body.organizationCode } });
  await prisma.masterSettings.update({ where: { id: settings.id }, data: {
    stoneRates: [{ stoneType: 'Granite', finish: 'Polished', ratePerSqFt: 40.5 }], defaultRoyaltyFee: 0,
  } });
  const load = (key, quantity, fee, date) => ({
    clientRequestId: key, date, supervisor: 'QA Auditor', partyName: key,
    logistics: { truckNumber: key.slice(0, 15), buyerDestination: 'Kadapa' },
    inventory: [{ stoneType: 'Granite', finish: 'Polished', ratePerSqFt: 40.5,
      measurementRows: [{ rowNo: 1, lengthFt: 3.25, widthFt: 2.5, quantity, category: 'Regular' }] }],
    loadingAndRoyaltyFees: fee,
  });
  const save = (payload) => call('/dispatches', 'POST', payload, cookie);
  const finalize = id => call(`/dispatches/${id}/finalize`, 'POST', {}, cookie);
  const payment = (id, amount, note) => call(`/dispatches/${id}/payments`, 'POST', { amount, note }, cookie);

  const mainPayload = load('audit-realdb-main-20261120', 4, 150.25, '2026-11-20T00:00:00.000Z');
  const main = await save(mainPayload);
  if (main.status !== 200) throw new Error(`Main draft failed: ${main.status} ${JSON.stringify(main.body)}`);
  const saveRetry = await save(mainPayload);
  await finalize(main.body.id);
  const p1 = await payment(main.body.id, 100, 'same retry');
  const p2 = await payment(main.body.id, 100, 'same retry');
  const settle = await payment(main.body.id, 1266.5, 'settle');
  const beforeEdit = await call(`/dispatches/${main.body.id}`, 'GET', undefined, cookie);
  const revise = await call(`/dispatches/${main.body.id}/revise`, 'PUT', { updatedAt: beforeEdit.body.updatedAt, loadingAndRoyaltyFees: 0 }, cookie);
  const paid = await call(`/dispatches/${main.body.id}/payments`, 'GET', undefined, cookie);

  const precision = await save(load('audit-realdb-precision-20261120', 5, 150.25, '2026-11-20T00:00:00.000Z'));
  const future = await save(load('audit-realdb-future-20261120', 4, 150.5, '2026-12-20T00:00:00.000Z'));
  if (precision.status !== 200 || future.status !== 200) throw new Error(`Other drafts failed: ${precision.status} ${JSON.stringify(precision.body)}; ${future.status} ${JSON.stringify(future.body)}`);
  await finalize(precision.body.id);
  await finalize(future.body.id);
  const analytics = await call('/dispatches/analytics?period=3', 'GET', undefined, cookie);
  const ids = [main.body.id, precision.body.id, future.body.id];
  const stored = await prisma.dispatch.findMany({ where: { id: { in: ids } }, select: { id: true, summary: true, date: true } });
  const dbPayments = await prisma.invoicePayment.findMany({ where: { dispatchId: main.body.id }, select: { amount: true } });
  console.log('AUDIT_RESULT ' + JSON.stringify({
    saveStatuses: [main.status, saveRetry.status], sameLoadId: main.body.id === saveRetry.body.id,
    paymentStatuses: [p1.status, p2.status, settle.status], paymentIds: [p1.body.payments?.[0]?.id, p2.body.payments?.[0]?.id],
    reviseStatus: revise.status, afterRevision: { total: paid.body.invoiceTotal, received: paid.body.received, balance: paid.body.balance, status: paid.body.status },
    dbPaymentAmounts: dbPayments.map(p => p.amount.toString()),
    precisionApiTotal: precision.body.summary?.netBillableAmount, futureApiTotal: future.body.summary?.netBillableAmount,
    stored: stored.map(x => ({ id: x.id, date: x.date, total: x.summary.netBillableAmount })),
    analyticsStatus: analytics.status, analyticsCurrent: analytics.body.paymentAnalytics?.current,
    analyticsParties: analytics.body.paymentAnalytics?.parties,
  }));
});
