const test = require('node:test');
const assert = require('node:assert/strict');
const { STATUS_TARGETS, statusTransitionError } = require('../utils/dispatchStatus');

const INVALID = { status: 400, error: 'Invalid status transition' };

test('Dispatched -> Delivered is allowed for Admin and Dispatcher', () => {
  assert.equal(statusTransitionError('Dispatched', 'Delivered', 'Admin'), null);
  assert.equal(statusTransitionError('Dispatched', 'Delivered', 'Dispatcher'), null);
});

test('Delivered -> Dispatched is allowed for Admin only', () => {
  assert.equal(statusTransitionError('Delivered', 'Dispatched', 'Admin'), null);
  for (const role of ['Dispatcher', 'YardManager', 'Yard Manager', 'admin', undefined]) {
    assert.deepEqual(statusTransitionError('Delivered', 'Dispatched', role), {
      status: 403,
      error: 'Only an admin can change a delivered load\'s status',
    }, `role ${role}`);
  }
});

test('Going back to Draft is rejected, even for Admin', () => {
  assert.deepEqual(statusTransitionError('Delivered', 'Draft', 'Admin'), INVALID);
  assert.deepEqual(statusTransitionError('Dispatched', 'Draft', 'Admin'), INVALID);
});

test('Draft loads cannot change status here', () => {
  assert.deepEqual(statusTransitionError('Draft', 'Delivered', 'Admin'), INVALID);
  assert.deepEqual(statusTransitionError('Draft', 'Dispatched', 'Admin'), INVALID);
});

test('Same-status and unknown targets are rejected', () => {
  assert.deepEqual(statusTransitionError('Dispatched', 'Dispatched', 'Admin'), INVALID);
  assert.deepEqual(statusTransitionError('Delivered', 'Delivered', 'Admin'), INVALID);
  assert.deepEqual(statusTransitionError('Delivered', 'Cancelled', 'Admin'), INVALID);
  assert.deepEqual(statusTransitionError('Dispatched', undefined, 'Admin'), INVALID);
});

test('STATUS_TARGETS lists only the two reachable statuses', () => {
  assert.deepEqual(STATUS_TARGETS, ['Delivered', 'Dispatched']);
});
