const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_SAVED_REFERENCES,
  formatTruckNumber,
  normalizeReference,
  referenceKey,
  rememberReference,
  removeReference,
  rememberDispatchReferences
} = require('../utils/savedReferences');

test('trucks are stored as formatted plates and dedupe by compact plate', () => {
  assert.equal(formatTruckNumber('tn01ab1234'), 'TN 01 AB 1234');
  assert.equal(normalizeReference('trucks', 'tn01ab1234'), 'TN 01 AB 1234');
  assert.equal(referenceKey('trucks', 'tn01ab1234'), referenceKey('trucks', 'TN 01 AB 1234'));
  assert.equal(referenceKey('trucks', 'TN-01-AB-1234'), 'TN01AB1234');
  assert.equal(rememberReference(['TN 01 AB 1234'], 'tn01ab1234', 'trucks'), null);
  assert.equal(rememberReference(['TN 01 AB 1234'], 'TN-01-AB-1234', 'trucks'), null);
});

test('a truck that is not an Indian plate is upper-cased', () => {
  assert.equal(normalizeReference('trucks', '  my   truck 7 '), 'MY TRUCK 7');
});

test('destinations dedupe case-insensitively with collapsed whitespace', () => {
  assert.equal(normalizeReference('destinations', ' Kadapa '), 'Kadapa');
  assert.equal(rememberReference(['Kadapa'], 'kadapa', 'destinations'), null);
  assert.equal(rememberReference(['New  Delhi'], ' new delhi ', 'destinations'), null);
});

test('new values are prepended, newest first', () => {
  assert.deepEqual(rememberReference(['Kadapa'], 'Chennai', 'destinations'), ['Chennai', 'Kadapa']);
  assert.deepEqual(rememberReference(undefined, 'Chennai', 'destinations'), ['Chennai']);
});

test('the list is capped at 500 and drops the oldest', () => {
  const list = Array.from({ length: MAX_SAVED_REFERENCES }, (_, i) => `Place ${i}`);
  const next = rememberReference(list, 'Fresh', 'destinations');
  assert.equal(next.length, MAX_SAVED_REFERENCES);
  assert.equal(next[0], 'Fresh');
  assert.equal(next.at(-1), `Place ${MAX_SAVED_REFERENCES - 2}`);
});

test('blank, non-string and too-long values are rejected', () => {
  assert.equal(normalizeReference('trucks', '   '), null);
  assert.equal(normalizeReference('trucks', 42), null);
  assert.equal(normalizeReference('trucks', 'A'.repeat(41)), null);
  assert.equal(normalizeReference('destinations', 'B'.repeat(201)), null);
  assert.equal(normalizeReference('destinations', 'B'.repeat(200)), 'B'.repeat(200));
  assert.equal(rememberReference([], '', 'destinations'), null);
});

test('removeReference matches by key', () => {
  assert.deepEqual(removeReference(['TN 01 AB 1234', 'KA 05 C 1111'], 'tn01ab1234', 'trucks'), ['KA 05 C 1111']);
  assert.deepEqual(removeReference(['TN01AA1111'], 'tn01aa1111', 'trucks'), []);
  assert.deepEqual(removeReference(['Kadapa', 'Chennai'], ' kadapa ', 'destinations'), ['Chennai']);
});

function fakeDb(settings, counts = []) {
  const calls = [];
  return {
    calls,
    masterSettings: {
      findUnique: async () => structuredClone(settings),
      updateMany: async args => { calls.push(args); return { count: counts.length ? counts.shift() : 1 }; }
    }
  };
}

test('rememberDispatchReferences writes nothing when both values are saved', async () => {
  const db = fakeDb({ version: 3, savedTrucks: ['TN 01 AB 1234'], savedDestinations: ['Kadapa'] });
  await rememberDispatchReferences(db, 'org1', { truckNumber: 'TN01AB1234', buyerDestination: 'kadapa' });
  assert.equal(db.calls.length, 0);
});

test('rememberDispatchReferences writes once with a version guard and only changed lists', async () => {
  const db = fakeDb({ version: 3, savedTrucks: [], savedDestinations: ['Kadapa'] });
  await rememberDispatchReferences(db, 'org1', { truckNumber: 'TN01AB1234', buyerDestination: 'Kadapa' });
  assert.equal(db.calls.length, 1);
  assert.deepEqual(db.calls[0], {
    where: { id: 'org1', version: 3 },
    data: { version: { increment: 1 }, savedTrucks: { set: ['TN 01 AB 1234'] } }
  });
});

test('rememberDispatchReferences retries when the version changed', async () => {
  const db = fakeDb({ version: 1, savedTrucks: [], savedDestinations: [] }, [0, 0, 1]);
  await rememberDispatchReferences(db, 'org1', { truckNumber: 'TN01AB1234', buyerDestination: 'Kadapa' });
  assert.equal(db.calls.length, 3);
});

test('rememberDispatchReferences gives up after 3 attempts without throwing', async () => {
  const db = fakeDb({ version: 1, savedTrucks: [], savedDestinations: [] }, [0, 0, 0, 0]);
  await rememberDispatchReferences(db, 'org1', { truckNumber: 'TN01AB1234', buyerDestination: 'Kadapa' });
  assert.equal(db.calls.length, 3);
});

test('rememberDispatchReferences swallows a throwing db', async () => {
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    const db = { masterSettings: { findUnique: async () => { throw Object.assign(new Error('down'), { code: 'P1001' }); } } };
    await assert.doesNotReject(rememberDispatchReferences(db, 'org1', { truckNumber: 'TN01AB1234', buyerDestination: 'Kadapa' }));
    assert.deepEqual(warnings, [['Could not save truck/destination suggestion', 'P1001']]);
  } finally {
    console.warn = warn;
  }
});
