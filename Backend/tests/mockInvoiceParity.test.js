const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

test('mock invoice payment, statement, revision and delete contracts match the real API', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stonedesk-mock-invoice-'));
  const child = spawn(process.execPath, [path.join(__dirname, '../mock/server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, MOCK_PORT: '0', MOCK_DATA_FILE: path.join(directory, 'mock-data.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Mock did not start')), 10000);
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/Mock StoneDesk API running on http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Mock exited before startup (${code})`)); });
  });
  const base = `http://127.0.0.1:${port}/api`;
  async function call(pathname, method = 'GET', body) {
    const response = await fetch(base + pathname, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }
  const draft = await call('/dispatches', 'POST', {
    supervisor: 'Supervisor', partyName: 'Mock Buyer', date: new Date().toISOString(),
    logistics: { truckNumber: 'AP01AB1234', buyerDestination: 'Kadapa' },
    inventory: [{ stoneType: 'Granite', finish: 'Polished', ratePerSqFt: 40.5,
      measurementRows: [{ lengthFt: 3.25, widthFt: 2.5, quantity: 4, category: 'Regular' }] }],
    loadingAndRoyaltyFees: 150.5,
  });
  assert.equal(draft.status, 200);
  assert.equal(draft.data.summary.netBillableAmount, 1466.75);
  const id = draft.data.id;
  const todayStatus = await call('/dispatches/status-counts?period=today');
  const allStatus = await call('/dispatches/status-counts?period=all');
  assert.equal(todayStatus.status, 200);
  assert.equal(allStatus.status, 200);
  assert.deepEqual((await call('/dispatches/status-counts')).data.statusCounts, todayStatus.data.statusCounts);
  assert.equal(todayStatus.data.statusCounts.Draft >= 1, true);
  assert.equal(todayStatus.data.today, allStatus.data.today);
  assert.ok(allStatus.data.statusCounts.Draft >= todayStatus.data.statusCounts.Draft);
  assert.equal((await call('/dispatches/status-counts?period=3')).status, 400);
  assert.equal((await call(`/dispatches/${id}/finalize`, 'POST', {})).status, 200);
  const key = randomUUID();
  const first = await call(`/dispatches/${id}/payments`, 'POST', { amount: 500.1, note: '  Bank  ', clientRequestId: key });
  assert.equal(first.status, 201);
  assert.equal(first.data.balance, 966.65);
  assert.equal((await call(`/dispatches/${id}/payments`, 'POST', { amount: 500.1, note: 'Bank', clientRequestId: key.toUpperCase() })).status, 200);
  assert.equal((await call(`/dispatches/${id}/payments`, 'POST', { amount: 500.2, note: 'Bank', clientRequestId: key })).status, 409);
  const statement = await call(`/dispatches/${id}/payment-statement`);
  assert.equal(statement.status, 200);
  assert.deepEqual([statement.data.invoice.total, statement.data.received, statement.data.balance, statement.data.status],
    ['1466.75', '500.10', '966.65', 'PARTIALLY_PAID']);
  const record = await call(`/dispatches/${id}`);
  const lowered = await call(`/dispatches/${id}/revise`, 'PUT', {
    ...record.data, updatedAt: record.data.updatedAt,
    inventory: [{ ...record.data.inventory[0], ratePerSqFt: 10 }], loadingAndRoyaltyFees: 0,
  });
  assert.equal(lowered.status, 409);
  assert.equal((await call(`/dispatches/${id}`, 'DELETE')).status, 409);
  const analytics = await call('/dispatches/analytics?period=all');
  assert.equal(analytics.status, 200);
  assert.ok(analytics.data.paymentAnalytics.current.received >= 500.1);
  const beforeFutureTodayStatus = await call('/dispatches/status-counts?period=today');
  const beforeFutureAllStatus = await call('/dispatches/status-counts?period=all');
  const future = await call('/dispatches', 'POST', {
    supervisor: 'Supervisor', partyName: 'Future Buyer',
    date: new Date(Date.now() + 7 * 86400000).toISOString(),
    logistics: { truckNumber: 'AP02CD5678', buyerDestination: 'Kadapa' },
    inventory: [{ stoneType: 'Granite', finish: 'Polished', ratePerSqFt: 40.5,
      measurementRows: [{ lengthFt: 3.25, widthFt: 2.5, quantity: 4, category: 'Regular' }] }],
    loadingAndRoyaltyFees: 150.5,
  });
  assert.equal(future.status, 200);
  assert.equal((await call(`/dispatches/${future.data.id}/finalize`, 'POST', {})).status, 200);
  const afterFutureStatus = await call('/dispatches/status-counts?period=today');
  assert.deepEqual(afterFutureStatus.data.statusCounts, beforeFutureTodayStatus.data.statusCounts);
  assert.deepEqual((await call('/dispatches/status-counts?period=all')).data.statusCounts, beforeFutureAllStatus.data.statusCounts);
  assert.equal((await call(`/dispatches/${future.data.id}/payments`, 'POST', {
    amount: 100, clientRequestId: randomUUID(),
  })).status, 201);
  const afterFuture = await call('/dispatches/analytics?period=all');
  assert.equal(afterFuture.data.paymentAnalytics.current.received, analytics.data.paymentAnalytics.current.received + 100);
  assert.equal(afterFuture.data.paymentAnalytics.current.outstanding, analytics.data.paymentAnalytics.current.outstanding);
  const futureReceivables = await call('/dispatches/receivables?party=Future%20Buyer');
  assert.equal(futureReceivables.data.data.length, 0);
});
