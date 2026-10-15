import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft, readDraft, readDrafts, writeDraft, clearDraft, hasDraftContent, DRAFT_KEY, DRAFTS_FULL, MAX_DRAFTS, detailErrors, entryErrors, makeRow, payload } from '../src/utils/pilotDraft.js';
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
test('encrypted draft recovery preserves the latest edit and organization isolation', async () => {
  const store = storage(), first = { ...newDraft(), partyName: 'First', entry: { length: '3', width: '2' } }, last = { ...first, partyName: 'Latest' };
  const a = writeDraft(first, 'yard-a', store), b = writeDraft(last, 'yard-a', store);
  assert.equal(await a, true); assert.equal(await b, true);
  assert.deepEqual(await readDraft(store, 'yard-a'), last);
  assert.equal(await readDraft(store, 'yard-b'), null);
  assert.ok(!store.getItem(`${DRAFT_KEY}:yard-a`).includes('Latest'));
});
test('clear waits for pending encryption so discarded or saved drafts cannot return', async () => {
  const store = storage(), draft = { ...newDraft(), partyName: 'Discard me' };
  const writing = writeDraft(draft, 'yard', store), clearing = clearDraft('yard', store);
  await Promise.all([writing, clearing]);
  assert.equal(await readDraft(store, 'yard'), null);
  assert.equal(hasDraftContent(newDraft()), false);
  assert.equal(hasDraftContent(draft), true);
});
test('storage failures are reported and malformed recovery is ignored', async () => {
  const failed = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('blocked'); } };
  assert.equal(await writeDraft(newDraft(), 'yard', failed), false);
  assert.equal(await clearDraft('yard', failed), false);
  const store = storage(); store.setItem(`${DRAFT_KEY}:yard`, 'not valid ciphertext');
  assert.equal(await readDraft(store, 'yard'), null);
});
test('detailErrors reports each missing load detail by field and agrees with payload', () => {
  const blank = { ...newDraft(), date: '', fee: '-1' };
  assert.deepEqual(Object.keys(detailErrors(blank)).sort(), ['buyerDestination', 'date', 'fee', 'partyName', 'supervisor', 'truckNumber']);
  assert.equal(detailErrors({ ...blank, partyName: '   ' }).partyName, 'Enter the party name');
  const filled = { ...newDraft(500), partyName: 'Buyer', truckNumber: 'TN 01 AB 1234', buyerDestination: 'Kadapa', supervisor: 'Ravi',
    rows: [{ stoneType: 'Granite', finish: 'Polished', rowNo: 1, lengthFt: 3, widthFt: 2, quantity: 1, ratePerSqFt: 40, category: 'Regular' }] };
  assert.deepEqual(detailErrors(filled), {});
  assert.doesNotThrow(() => payload(filled));
  assert.equal(detailErrors({ ...filled, fee: '0' }).fee, undefined);
});
test('entryErrors flags each invalid measurement field and agrees with makeRow', () => {
  const product = { stoneType: 'Granite', finish: 'Polished' };
  const errors = entryErrors({ length: '', width: '0', quantity: '1.5', rate: '' }, undefined);
  assert.deepEqual(Object.keys(errors).sort(), ['length', 'productId', 'quantity', 'rate', 'width']);
  const valid = { length: '3½', width: '2', quantity: '4', rate: '0', rowNo: '1', category: 'Regular' };
  assert.deepEqual(entryErrors(valid, product), {});
  assert.doesNotThrow(() => makeRow(valid, product));
  assert.deepEqual(Object.keys(entryErrors({ ...valid, quantity: '100001' }, product)), ['quantity']);
});
test('up to five unfinished loads are kept side by side and a sixth is refused', async () => {
  const store = storage();
  const drafts = Array.from({ length: MAX_DRAFTS }, (_, i) => ({ ...newDraft(), partyName: `Party ${i}` }));
  for (const draft of drafts) assert.equal(await writeDraft(draft, 'yard', store), true);
  assert.equal(MAX_DRAFTS, 5);
  assert.equal((await readDrafts(store, 'yard')).length, 5);
  assert.equal(await writeDraft({ ...newDraft(), partyName: 'Sixth' }, 'yard', store), DRAFTS_FULL);
  // Updating an existing draft still works when the list is full.
  assert.equal(await writeDraft({ ...drafts[0], partyName: 'Edited' }, 'yard', store), true);
  assert.equal((await readDraft(store, 'yard', drafts[0].clientRequestId)).partyName, 'Edited');
  assert.equal((await readDraft(store, 'yard')).partyName, 'Edited', 'most recently saved comes first');
  assert.ok(!store.getItem(`${DRAFT_KEY}:yard`).includes('Party'));
});
test('deleting one draft keeps the others and frees a slot', async () => {
  const store = storage();
  const a = { ...newDraft(), partyName: 'A' }, b = { ...newDraft(), partyName: 'B' };
  await writeDraft(a, 'yard', store); await writeDraft(b, 'yard', store);
  assert.equal(await clearDraft('yard', store, a.clientRequestId), true);
  assert.deepEqual((await readDrafts(store, 'yard')).map(d => d.partyName), ['B']);
  assert.equal(await readDraft(store, 'yard', a.clientRequestId), null);
  await clearDraft('yard', store, b.clientRequestId);
  assert.equal(store.getItem(`${DRAFT_KEY}:yard`), null);
});
test('listed drafts carry their saved time, which is never stored inside the draft', async () => {
  const store = storage(), draft = { ...newDraft(), partyName: 'Timed' };
  await writeDraft(draft, 'yard', store);
  const [listed] = await readDrafts(store, 'yard');
  assert.equal(listed.partyName, 'Timed');
  assert.ok(listed.savedAt > 0);
  // Writing a listed draft back (as the load screen does) does not nest savedAt.
  await writeDraft(listed, 'yard', store);
  assert.equal('savedAt' in await readDraft(store, 'yard'), false);
});
