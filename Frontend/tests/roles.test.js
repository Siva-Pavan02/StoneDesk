import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_LABELS, roleLabel, roleTone, canAddProduct, canManageProducts, canRemoveSuggestions } from '../src/utils/roles.js';

test('roleTone maps each role to its tag colour', () => {
  assert.equal(roleTone('Admin'), 'admin');
  assert.equal(roleTone('Yard Manager'), 'manager');
  assert.equal(roleTone('YardManager'), 'manager');
  assert.equal(roleTone('Dispatcher'), 'dispatcher');
  assert.equal(roleTone('Auditor'), 'dispatcher');
  assert.equal(roleTone(undefined), 'dispatcher');
});

test('roleLabel shows Manager for both Yard Manager spellings', () => {
  assert.equal(roleLabel('Yard Manager'), 'Manager');
  assert.equal(roleLabel('YardManager'), 'Manager');
  assert.equal(roleLabel('Admin'), 'Admin');
  assert.equal(roleLabel('Dispatcher'), 'Dispatcher');
});

test('roleLabel falls back to the input for unknown roles', () => {
  assert.equal(roleLabel('Auditor'), 'Auditor');
  assert.equal(roleLabel(undefined), undefined);
});

test('no role label says Supervisor or Yard Manager', () => {
  for (const label of Object.values(ROLE_LABELS)) assert.doesNotMatch(label, /supervisor|yard manager/i);
});

test('Admin and managers can add products, Dispatcher cannot', () => {
  assert.equal(canAddProduct('Admin'), true);
  assert.equal(canAddProduct('Yard Manager'), true);
  assert.equal(canAddProduct('YardManager'), true);
  assert.equal(canAddProduct('Dispatcher'), false);
  assert.equal(canAddProduct(undefined), false);
});

test('only Admin manages products and removes suggestions', () => {
  for (const role of ['Yard Manager', 'YardManager', 'Dispatcher', undefined]) {
    assert.equal(canManageProducts(role), false);
    assert.equal(canRemoveSuggestions(role), false);
  }
  assert.equal(canManageProducts('Admin'), true);
  assert.equal(canRemoveSuggestions('Admin'), true);
});
