const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('./database');
const prisma = database.prisma;
const http = require('node:http');
const app = require('../app');
const API_PREFIX = '/api';

test('Invoice Payments V1 API', async (t) => {
  try {
    await database.setup(t);

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  async function call(path, method = 'GET', body, cookie) {
    const res = await fetch(baseUrl + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: res.status, data: await res.json().catch(() => null), cookies: res.headers.getSetCookie() };
  }

  const cookieOf = response => response.cookies.find(c => c.startsWith('stonedesk_session=') && !c.startsWith('stonedesk_session=;')).split(';')[0];
  const password = 'TestPassword123!';

  // 1. Create Org A Owner (Admin)
  const ownerA = await call(`${API_PREFIX}/auth/signup`, 'POST', {
    email: 'ownerA@payments.test',
    password,
    name: 'Owner A',
    createOrganization: true,
    businessName: 'Stone Works A'
  });
  assert.equal(ownerA.status, 201);
  const cookieA = cookieOf(ownerA);

  // Set up product stoneRates so dispatch can be finalized
  const orgA = await prisma.masterSettings.findFirst({
    where: { organizationId: ownerA.data.organizationCode }
  });
  await prisma.masterSettings.update({
    where: { id: orgA.id },
    data: {
      businessName: 'Stone Works A',
      stoneRates: [{ stoneType: 'Granite', finish: 'Polished', ratePerSqFt: 100 }],
      defaultRoyaltyFee: 0
    }
  });

  // Create YardManager user in Org A
  const yardManagerUser = await prisma.user.create({
    data: {
      organizationId: orgA.id,
      name: 'Yard Operator',
      email: 'yard@payments.test',
      passwordHash: 'dummy',
      passwordSalt: 'dummy',
      role: 'YardManager',
      active: true
    }
  });
  const ymToken = require('node:crypto').randomBytes(32).toString('hex');
  const ymSession = await prisma.session.create({
    data: {
      tokenHash: require('node:crypto').createHash('sha256').update(ymToken).digest('hex'),
      userId: yardManagerUser.id,
      expiresAt: new Date(Date.now() + 1000000)
    }
  });
  const cookieYardManager = `stonedesk_session=${ymToken}`;

  // Create Org B Owner for multi-tenant check
  const ownerB = await call(`${API_PREFIX}/auth/signup`, 'POST', {
    email: 'ownerB@payments.test',
    password,
    name: 'Owner B',
    createOrganization: true,
    businessName: 'Stone Works B'
  });
  assert.equal(ownerB.status, 201);
  const cookieB = cookieOf(ownerB);

  // Create a draft dispatch in Org A (800 sq ft @ 100 = 80,000)
  const draftRes = await call(`${API_PREFIX}/dispatches`, 'POST', {
    supervisor: 'Supervisor One',
    logistics: { truckNumber: 'AP01AB1234', buyerDestination: 'Hyderabad' },
    inventory: [
      {
        stoneType: 'Granite',
        finish: 'Polished',
        ratePerSqFt: 100,
        pieces: [
          { lengthFt: 40, widthFt: 20 } // 800 sq ft = 80,000
        ]
      }
    ]
  }, cookieA);
  assert.equal(draftRes.status, 200);
  const draftId = draftRes.data.id;
  assert.equal(draftRes.data.summary.netBillableAmount, 80000);

  await t.test('1. Reject payment creation on draft dispatch', async () => {
    const res = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'POST', { amount: 10000 }, cookieA);
    assert.equal(res.status, 400);
    assert.match(res.data.error, /finalized/i);
  });

  // Finalize dispatch
  const finalized = await call(`${API_PREFIX}/dispatches/${draftId}/finalize`, 'POST', {}, cookieA);
  assert.equal(finalized.status, 200);
  assert.equal(finalized.data.status, 'Dispatched');

  await t.test('2. Initial payment status is PAYMENT_DUE with zero payments', async () => {
    const res = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'GET', undefined, cookieA);
    assert.equal(res.status, 200);
    assert.equal(res.data.invoiceTotal, 80000);
    assert.equal(res.data.received, 0);
    assert.equal(res.data.balance, 80000);
    assert.equal(res.data.status, 'PAYMENT_DUE');
    assert.deepEqual(res.data.payments, []);
  });

  await t.test('3. Yard Manager role cannot record payments', async () => {
    const res = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'POST', { amount: 1000 }, cookieYardManager);
    assert.equal(res.status, 403);
  });

  await t.test('4. Reject invalid payment amounts', async () => {
    // Negative
    let res = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'POST', { amount: -500 }, cookieA);
    assert.equal(res.status, 400);

    // Zero
    res = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'POST', { amount: 0 }, cookieA);
    assert.equal(res.status, 400);

    // Non-numeric
    res = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'POST', { amount: 'ten thousand' }, cookieA);
    assert.equal(res.status, 400);

    // Long note
    res = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'POST', { amount: 100, note: 'a'.repeat(300) }, cookieA);
    assert.equal(res.status, 400);
  });

  await t.test('5. First partial payment (25,000)', async () => {
    const res = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'POST', {
      amount: 25000,
      note: 'Advance payment received'
    }, cookieA);
    assert.equal(res.status, 201);
    assert.equal(res.data.invoiceTotal, 80000);
    assert.equal(res.data.received, 25000);
    assert.equal(res.data.balance, 55000);
    assert.equal(res.data.status, 'PARTIALLY_PAID');
    assert.equal(res.data.payments.length, 1);
    assert.equal(res.data.payments[0].amount, 25000);
    assert.equal(res.data.payments[0].note, 'Advance payment received');
    assert.equal(res.data.payments[0].createdBy, 'Owner A');
  });

  await t.test('6. Second partial payment (20,000)', async () => {
    const res = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'POST', {
      amount: 20000,
      note: 'Second installment'
    }, cookieA);
    assert.equal(res.status, 201);
    assert.equal(res.data.invoiceTotal, 80000);
    assert.equal(res.data.received, 45000);
    assert.equal(res.data.balance, 35000);
    assert.equal(res.data.status, 'PARTIALLY_PAID');
    assert.equal(res.data.payments.length, 2);
  });

  await t.test('7. Reject overpayment exceeding current balance (balance is 35,000)', async () => {
    const res = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'POST', {
      amount: 35000.01,
      note: 'Attempting overpayment'
    }, cookieA);
    assert.equal(res.status, 400);
    assert.match(res.data.error, /exceeds remaining balance/i);
  });

  await t.test('8. Final payment paying exact balance (35,000)', async () => {
    const res = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'POST', {
      amount: 35000,
      note: 'Final settlement'
    }, cookieA);
    assert.equal(res.status, 201);
    assert.equal(res.data.invoiceTotal, 80000);
    assert.equal(res.data.received, 80000);
    assert.equal(res.data.balance, 0);
    assert.equal(res.data.status, 'PAID');
    assert.equal(res.data.payments.length, 3);
  });

  await t.test('9. Reject payment when invoice is already PAID', async () => {
    const res = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'POST', { amount: 1 }, cookieA);
    assert.equal(res.status, 400);
    assert.match(res.data.error, /exceeds remaining balance of ₹0/i);
  });

  await t.test('10. Tenant isolation: Org B cannot view or pay Org A invoice', async () => {
    const getRes = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'GET', undefined, cookieB);
    assert.equal(getRes.status, 404);

    const postRes = await call(`${API_PREFIX}/dispatches/${draftId}/payments`, 'POST', { amount: 100 }, cookieB);
    assert.equal(postRes.status, 404);
  });

  await t.test('11. Concurrency: Two simultaneous payments competing for remaining balance', async () => {
    // Create a new finalized dispatch for concurrency test with 10,000 total
    const draft2 = await call(`${API_PREFIX}/dispatches`, 'POST', {
      supervisor: 'Supervisor Race',
      logistics: { truckNumber: 'AP02CD5678', buyerDestination: 'Vijayawada' },
      inventory: [
        {
          stoneType: 'Granite',
          finish: 'Polished',
          ratePerSqFt: 100,
          pieces: [{ lengthFt: 10, widthFt: 10 }] // 100 sq ft = 10,000
        }
      ]
    }, cookieA);
    const id2 = draft2.data.id;
    await call(`${API_PREFIX}/dispatches/${id2}/finalize`, 'POST', {}, cookieA);

    // Two simultaneous requests each trying to pay 10,000
    const [p1, p2] = await Promise.all([
      call(`${API_PREFIX}/dispatches/${id2}/payments`, 'POST', { amount: 10000, note: 'User A' }, cookieA),
      call(`${API_PREFIX}/dispatches/${id2}/payments`, 'POST', { amount: 10000, note: 'User B' }, cookieA)
    ]);

    // Exactly one should succeed with 201, and the other must fail (400 balance exceeded or 409 conflict)
    const successCount = [p1, p2].filter(r => r.status === 201).length;
    const failCount = [p1, p2].filter(r => r.status >= 400).length;
    assert.equal(successCount, 1, 'Exactly one payment succeeds');
    assert.equal(failCount, 1, 'The competing payment fails');

    // Confirm database state has exactly 10,000 recorded and balance is 0
    const summary = await call(`${API_PREFIX}/dispatches/${id2}/payments`, 'GET', undefined, cookieA);
    assert.equal(summary.data.received, 10000);
    assert.equal(summary.data.balance, 0);
    assert.equal(summary.data.status, 'PAID');
    assert.equal(summary.data.payments.length, 1);
  });

  await t.test('12. Deletion restriction: onDelete Restrict prevents deleting dispatch with payments', async () => {
    await assert.rejects(async () => {
      await prisma.dispatch.delete({ where: { id: draftId } });
    }, (err) => {
      // Prisma P2003 = foreign key constraint violated
      return err.code === 'P2003' || /foreign key/i.test(err.message);
    });
  });

  await t.test('13. Money precision & edge values (0.01, 0.10, 1.005, 100.10, 18384.50, 9999999.99)', async () => {
    const { derivePaymentSummary } = require('../utils/paymentSummary');
    
    // Test 1.005 rounds half-up to 1.01 and received + balance == invoiceTotal
    const s1 = derivePaymentSummary(1.005, [{ amount: 0.01 }, { amount: 0.10 }]);
    assert.equal(s1.invoiceTotal, 1.01);
    assert.equal(s1.received, 0.11);
    assert.equal(s1.balance, 0.90);
    assert.equal(Number((s1.received + s1.balance).toFixed(2)), s1.invoiceTotal);

    // Test 18384.50 with 100.10 payment
    const s2 = derivePaymentSummary(18384.50, [{ amount: 100.10 }]);
    assert.equal(s2.invoiceTotal, 18384.50);
    assert.equal(s2.received, 100.10);
    assert.equal(s2.balance, 18284.40);
    assert.equal(Number((s2.received + s2.balance).toFixed(2)), s2.invoiceTotal);

    // Test large value 9999999.99
    const s3 = derivePaymentSummary(9999999.99, [{ amount: 9999999.99 }]);
    assert.equal(s3.invoiceTotal, 9999999.99);
    assert.equal(s3.received, 9999999.99);
    assert.equal(s3.balance, 0);
    assert.equal(s3.status, 'PAID');
    assert.equal(Number((s3.received + s3.balance).toFixed(2)), s3.invoiceTotal);
  });

  await t.test('14. API accepts 1.005 and rounds half-up to exact 1.01 in database', async () => {
    // Create new finalized dispatch with total = 100.10
    const d3 = await call(`${API_PREFIX}/dispatches`, 'POST', {
      supervisor: 'Supervisor Precision',
      logistics: { truckNumber: 'AP03EF9999', buyerDestination: 'Guntur' },
      inventory: [
        {
          stoneType: 'Granite',
          finish: 'Polished',
          ratePerSqFt: 100.10,
          pieces: [{ lengthFt: 1, widthFt: 1 }] // 1 sq ft = 100.10
        }
      ]
    }, cookieA);
    const id3 = d3.data.id;
    await call(`${API_PREFIX}/dispatches/${id3}/finalize`, 'POST', {}, cookieA);

    // Post payment of 1.005
    const payRes = await call(`${API_PREFIX}/dispatches/${id3}/payments`, 'POST', {
      amount: 1.005,
      note: 'Half-up rounding test'
    }, cookieA);
    assert.equal(payRes.status, 201);
    assert.equal(payRes.data.invoiceTotal, 100.10);
    assert.equal(payRes.data.received, 1.01);
    assert.equal(payRes.data.balance, 99.09);
    assert.equal(Number((payRes.data.received + payRes.data.balance).toFixed(2)), 100.10);
    assert.equal(payRes.data.payments[0].amount, 1.01);
  });

    server.close();
  } catch (err) {
    console.error('INVOICE PAYMENT TEST ERROR:', err);
    throw err;
  }
});
