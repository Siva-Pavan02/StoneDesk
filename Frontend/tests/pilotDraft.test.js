import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft, readDraft, writeDraft, clearDraft, hasDraftContent, DRAFT_KEY } from '../src/utils/pilotDraft.js';
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
