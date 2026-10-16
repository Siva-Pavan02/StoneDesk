const test = require('node:test');
const assert = require('node:assert/strict');
const { PRODUCT_CREATORS, normalizeRole, canAddProduct, requireProductCreator } = require('../utils/roles');

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('normalizeRole maps the API label to the enum', () => {
  assert.equal(normalizeRole('Yard Manager'), 'YardManager');
  assert.equal(normalizeRole('Admin'), 'Admin');
  assert.deepEqual(PRODUCT_CREATORS, ['Admin', 'YardManager']);
});

test('Admin and Manager may add products', () => {
  for (const role of ['Admin', 'YardManager', 'Yard Manager']) assert.equal(canAddProduct(role), true, `role ${role}`);
});

test('Dispatcher and unknown roles may not add products', () => {
  for (const role of ['Dispatcher', 'admin', undefined]) assert.equal(canAddProduct(role), false, `role ${role}`);
});

test('requireProductCreator calls next for a Manager', () => {
  let called = false;
  const res = fakeRes();
  requireProductCreator({ user: { role: 'YardManager' } }, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.body, undefined);
});

test('requireProductCreator rejects a Dispatcher with 403', () => {
  let called = false;
  const res = fakeRes();
  requireProductCreator({ user: { role: 'Dispatcher' } }, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: 'Your role does not allow this action' });
});

test('requireProductCreator rejects a request without a user', () => {
  const res = fakeRes();
  requireProductCreator({}, res, () => assert.fail('next must not run'));
  assert.equal(res.statusCode, 403);
});
