const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('./database');
const prisma = database.prisma;
const http = require('node:http');
const app = require('../server');
const API_PREFIX = '/api';

test('Multi-tenancy: Organization isolation', async (t) => {
  await database.setup(t);

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  
  const baseUrl = `http://localhost:${port}`;
  
  async function call(path, method = 'GET', body, cookie, origin) {
    const response = await fetch(baseUrl + path, { 
      method, 
      headers: { 
        'Content-Type': 'application/json', 
        ...(cookie ? { Cookie: cookie } : {}), 
        ...(origin ? { Origin: origin } : {}) 
      }, 
      body: body === undefined ? undefined : JSON.stringify(body) 
    });
    return { status: response.status, data: await response.json(), cookies: response.headers.getSetCookie() };
  }
  
  const cookieOf = response => response.cookies.find(c => c.startsWith('stonedesk_session=') && !c.startsWith('stonedesk_session=;')).split(';')[0];
  
  const password = 'SecurePass123!';
  
  // Create Org A
  const orgAOwner = await call(`${API_PREFIX}/auth/signup`, 'POST', { 
    email: 'ownerA@example.test', 
    password, 
    name: 'Owner A', 
    createOrganization: true, 
    businessName: 'Org A Yard' 
  });
  assert.equal(orgAOwner.status, 201);
  const orgAOwnerCookie = cookieOf(orgAOwner);
  const orgAOrgId = orgAOwner.data.organizationCode;
  
  // Create Org B
  const orgBOwner = await call(`${API_PREFIX}/auth/signup`, 'POST', { 
    email: 'ownerB@example.test', 
    password, 
    name: 'Owner B', 
    createOrganization: true, 
    businessName: 'Org B Yard' 
  });
  assert.equal(orgBOwner.status, 201);
  const orgBOwnerCookie = cookieOf(orgBOwner);
  const orgBOrgId = orgBOwner.data.organizationCode;
  
  // Create staff in Org A
  const orgAStaff = await call(`${API_PREFIX}/auth/signup`, 'POST', { 
    email: 'staffA@example.test', 
    password, 
    name: 'Staff A', 
    organizationId: orgAOrgId 
  });
  assert.equal(orgAStaff.status, 201);
  const orgAStaffCookie = cookieOf(orgAStaff);
  
  // Create staff in Org B
  const orgBStaff = await call(`${API_PREFIX}/auth/signup`, 'POST', { 
    email: 'staffB@example.test', 
    password, 
    name: 'Staff B', 
    organizationId: orgBOrgId 
  });
  assert.equal(orgBStaff.status, 201);
  const orgBStaffCookie = cookieOf(orgBStaff);
  
  await t.test('Org A users cannot access Org B master settings', async () => {
    const res = await call(`${API_PREFIX}/master-settings/${orgBOrgId}`, 'GET', undefined, orgAOwnerCookie);
    assert.equal(res.status, 404);
  });
  
  await t.test('Org A users cannot access Org B dispatches', async () => {
    const res = await call(`${API_PREFIX}/dispatches`, 'GET', undefined, orgAOwnerCookie);
    assert.equal(res.status, 200);
    assert.equal(res.data.data.length, 0);
    
    // Create a dispatch in Org B
    const orgBDispatch = await call(`${API_PREFIX}/dispatches`, 'POST', {
      supervisor: 'Owner B',
      logistics: { truckNumber: 'TN01', buyerDestination: 'Chennai' },
      inventory: [{ stoneType: 'Stone', finish: 'Polished', ratePerSqFt: 100, pieces: [{ lengthFt: 10, widthFt: 5 }] }]
    }, orgBOwnerCookie);
    assert.equal(orgBDispatch.status, 200);
    
    // Org A user should not see Org B's dispatch
    const res2 = await call(`${API_PREFIX}/dispatches`, 'GET', undefined, orgAOwnerCookie);
    assert.equal(res2.status, 200);
    assert.equal(res2.data.data.length, 0);
  });
  
  await t.test('Org A users cannot access Org B loading lists', async () => {
    const res = await call(`${API_PREFIX}/loading-lists`, 'GET', undefined, orgAOwnerCookie);
    assert.equal(res.status, 200);
    assert.equal(res.data.length, 0);
    
    const orgBList = await call(`${API_PREFIX}/loading-lists`, 'POST', {
      supervisor: 'Owner B',
      buyerDestination: 'Chennai',
      stoneType: 'Stone',
      finish: 'Polished',
      requirements: [{ lengthFt: 10, widthFt: 5, requiredQuantity: 10 }]
    }, orgBOwnerCookie);
    assert.equal(orgBList.status, 201);
    
    const res2 = await call(`${API_PREFIX}/loading-lists`, 'GET', undefined, orgAOwnerCookie);
    assert.equal(res2.status, 200);
    assert.equal(res2.data.length, 0);
  });
  
  await t.test('Org A staff cannot access Org B data', async () => {
    const res = await call(`${API_PREFIX}/dispatches`, 'GET', undefined, orgAStaffCookie);
    assert.equal(res.status, 200);
    assert.equal(res.data.data.length, 0);
  });
  
  await t.test('Cross-org dispatch access by ID returns 404', async () => {
    const orgBDispatch = await call(`${API_PREFIX}/dispatches`, 'POST', {
      supervisor: 'Owner B',
      logistics: { truckNumber: 'TN01', buyerDestination: 'Chennai' },
      inventory: [{ stoneType: 'Stone', finish: 'Polished', ratePerSqFt: 100, pieces: [{ lengthFt: 10, widthFt: 5 }] }]
    }, orgBOwnerCookie);
    assert.equal(orgBDispatch.status, 200);
    
    const dispatchId = orgBDispatch.data.id;
    
    // Org A owner tries to access Org B's dispatch by ID
    const res = await call(`${API_PREFIX}/dispatches/${dispatchId}`, 'GET', undefined, orgAOwnerCookie);
    assert.equal(res.status, 404);
  });
  
  await t.test('Cross-org loading list access by ID returns 404', async () => {
    const orgBList = await call(`${API_PREFIX}/loading-lists`, 'POST', {
      supervisor: 'Owner B',
      buyerDestination: 'Chennai',
      stoneType: 'Stone',
      finish: 'Polished',
      requirements: [{ lengthFt: 10, widthFt: 5, requiredQuantity: 10 }]
    }, orgBOwnerCookie);
    assert.equal(orgBList.status, 201);
    
    const listId = orgBList.data.id;
    
    const res = await call(`${API_PREFIX}/loading-lists/${listId}`, 'GET', undefined, orgAOwnerCookie);
    assert.equal(res.status, 404);
  });
  
  await t.test('Cross-org master settings access by organizationId returns 404', async () => {
    const res = await call(`${API_PREFIX}/master-settings/${orgBOrgId}`, 'GET', undefined, orgAOwnerCookie);
    assert.equal(res.status, 404);
  });
  
  await t.test('Auth endpoints work per organization', async () => {
    // Each org's users can only access their own org data
    const orgARes = await call(`${API_PREFIX}/auth/me`, 'GET', undefined, orgAOwnerCookie);
    assert.equal(orgARes.status, 200);
    assert.equal(orgARes.data.user.organizationId, orgAOwner.data.user.organizationId);
    
    const orgBRes = await call(`${API_PREFIX}/auth/me`, 'GET', undefined, orgBOwnerCookie);
    assert.equal(orgBRes.status, 200);
    assert.equal(orgBRes.data.user.organizationId, orgBOwner.data.user.organizationId);
    
    assert.notEqual(orgARes.data.user.organizationId, orgBRes.data.user.organizationId);
  });
  
  await new Promise(resolve => server.close(resolve));
});