// DB-free tests for the logo backfill. Run with:
//   node --test tests/externalizeSnapshotLogos.test.js
// Uses a fake pg client and a fake storage module; never connects to a database or Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const sharp = require('sharp');
const { BATCH_SIZE, FIRST_CURSOR, decodeLogo, planRow, parseMode, run } = require('../scripts/externalizeSnapshotLogos');

const ORG_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const ORG_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const png = (width, height) => sharp({ create: { width, height, channels: 3, background: '#115e59' } }).png().toBuffer();
const dataUrl = buffer => `data:image/png;base64,${buffer.toString('base64')}`;

// Fake pg client: answers the batched SELECT from `rows` (ordered by id, id > cursor, LIMIT)
// and records every UPDATE. `guardFails` lists ids whose guard no longer matches.
function fakeClient(rows, { guardFails = new Set() } = {}) {
  const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/^\s*SELECT/i.test(sql)) return { rows: sorted.filter(row => row.id > params[0]).slice(0, BATCH_SIZE) };
      if (/^\s*UPDATE/i.test(sql)) return { rowCount: guardFails.has(params[1]) ? 0 : 1 };
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
}
function fakeStorage({ existing = new Map() } = {}) {
  const calls = [];
  return {
    calls,
    async saveContentLogo(org, sha, buffer) { calls.push(['save', org, sha]); const key = `${org}/${sha}`; if (existing.has(key)) return 'exists'; existing.set(key, buffer); return 'created'; },
    async readContentLogo(org, sha) { calls.push(['read', org, sha]); return existing.get(`${org}/${sha}`); }
  };
}
const quiet = () => {};

test('decodeLogo accepts sharp PNG data URLs and rejects anything else', async () => {
  const buffer = await png(20, 10);
  assert.deepEqual(await decodeLogo(dataUrl(buffer)), { buffer, sha256: sha256(buffer), width: 20, height: 10, bytes: buffer.length });
  const jpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } }).jpeg().toBuffer();
  for (const value of [`data:image/jpeg;base64,${jpeg.toString('base64')}`, `data:image/png;base64,${jpeg.toString('base64')}`, 'data:image/png;base64,bm90IGEgcG5n', 'data:image/png;base64,', 'garbage', '', null, undefined, 42]) {
    assert.equal(await decodeLogo(value), null, String(value).slice(0, 40));
  }
});

test('planRow strips logoDataUrl, keeps other fields and builds the reference', async () => {
  const buffer = await png(30, 12);
  const row = { id: id(1), organizationId: ORG_A, businessSnapshot: { businessName: 'B', phone: 'P', logoDataUrl: dataUrl(buffer) }, revisions: [{ summary: { n: 1 }, businessSnapshot: { businessName: 'B', logoDataUrl: dataUrl(buffer) } }] };
  const copy = structuredClone(row);
  const plan = await planRow(row);
  assert.deepEqual(row, copy, 'input is not mutated');
  assert.deepEqual(plan.snapshot, { businessName: 'B', phone: 'P', logo: { sha256: sha256(buffer), width: 30, height: 12, bytes: buffer.length } });
  assert.deepEqual(plan.upload, { organizationId: ORG_A, sha256: sha256(buffer), buffer });
  assert.equal(plan.invalid, false);
  assert.ok(plan.savedBytes > buffer.length, 'counts the embedded copy and the revision copy');

  const nullLogo = await planRow({ id: id(2), organizationId: ORG_A, businessSnapshot: { businessName: 'B', logoDataUrl: null }, revisions: [] });
  assert.deepEqual(nullLogo.snapshot, { businessName: 'B' });
  assert.equal(nullLogo.upload, null);
  assert.equal(nullLogo.invalid, false);

  const invalid = await planRow({ id: id(3), organizationId: ORG_A, businessSnapshot: { businessName: 'B', logoDataUrl: 'data:image/png;base64,AAAA' }, revisions: [] });
  assert.deepEqual(invalid.snapshot, { businessName: 'B' });
  assert.equal(invalid.upload, null);
  assert.equal(invalid.invalid, true);

  const revisionOnly = await planRow({ id: id(4), organizationId: ORG_A, businessSnapshot: { businessName: 'B', logo: { sha256: 'a'.repeat(64) } }, revisions: [{ businessSnapshot: { businessName: 'B' } }] });
  assert.deepEqual(revisionOnly.snapshot, { businessName: 'B', logo: { sha256: 'a'.repeat(64) } });
  assert.equal(revisionOnly.upload, null);
});

test('the default dry run only reads: no uploads and no UPDATEs', async () => {
  const buffer = await png(10, 10);
  const client = fakeClient([
    { id: id(1), organizationId: ORG_A, businessSnapshot: { businessName: 'B', logoDataUrl: dataUrl(buffer) }, revisions: [] },
    { id: id(2), organizationId: ORG_A, businessSnapshot: { businessName: 'B', logoDataUrl: dataUrl(buffer) }, revisions: [] },
    { id: id(3), organizationId: ORG_A, businessSnapshot: { businessName: 'B', logoDataUrl: 'garbage' }, revisions: [] }
  ]);
  const storage = fakeStorage();
  const lines = [];
  const counts = await run({ client, storage, log: line => lines.push(line) });
  assert.ok(client.calls.every(call => /^\s*SELECT/i.test(call.sql)));
  assert.deepEqual(client.calls[0].params, [FIRST_CURSOR]);
  assert.deepEqual(storage.calls, []);
  assert.equal(counts.scanned, 3);
  assert.equal(counts.rewritten, 3);
  assert.equal(counts.uploaded, 1, 'one distinct (org, sha)');
  assert.equal(counts.invalid, 1);
  assert.ok(counts.savedBytes > 0);
  assert.ok(lines.some(line => line.includes('dry run')));
  assert.ok(!lines.join('\n').includes('data:image'), 'never logs data URLs');
  assert.ok(!lines.join('\n').includes(id(1)), 'never logs ids');
});

test('apply uploads once per (org, sha) and rewrites each row with the guard', async () => {
  const buffer = await png(16, 8);
  const sha = sha256(buffer);
  const snapshotA1 = { businessName: 'A', logoDataUrl: dataUrl(buffer) };
  const rows = [
    { id: id(1), organizationId: ORG_A, businessSnapshot: snapshotA1, revisions: [{ summary: {}, businessSnapshot: snapshotA1 }] },
    { id: id(2), organizationId: ORG_A, businessSnapshot: { businessName: 'A', logoDataUrl: dataUrl(buffer) }, revisions: [] },
    { id: id(3), organizationId: ORG_B, businessSnapshot: { businessName: 'B', logoDataUrl: dataUrl(buffer) }, revisions: [] }
  ];
  const client = fakeClient(rows);
  const storage = fakeStorage();
  const counts = await run({ client, storage, apply: true, log: quiet });
  assert.deepEqual(storage.calls, [['save', ORG_A, sha], ['save', ORG_B, sha]], 'same logo in another org is its own object');
  const updates = client.calls.filter(call => /^\s*UPDATE/i.test(call.sql));
  assert.equal(updates.length, 3);
  assert.match(updates[0].sql, /WHERE id = \$2::uuid AND "businessSnapshot" IS NOT DISTINCT FROM \$3::jsonb/);
  assert.match(updates[0].sql, /- 'businessSnapshot'/);
  assert.doesNotMatch(updates[0].sql, /updatedAt/, 'raw SQL leaves @updatedAt alone');
  assert.deepEqual(JSON.parse(updates[0].params[0]), { businessName: 'A', logo: { sha256: sha, width: 16, height: 8, bytes: buffer.length } });
  assert.equal(updates[0].params[1], id(1));
  assert.deepEqual(JSON.parse(updates[0].params[2]), snapshotA1, 'guard uses the snapshot exactly as read');
  assert.deepEqual({ rewritten: counts.rewritten, uploaded: counts.uploaded, verified: counts.verified, skipped: counts.skipped }, { rewritten: 3, uploaded: 2, verified: 0, skipped: 0 });
});

test('an existing object is verified by bytes; a mismatch aborts before any rewrite', async () => {
  const buffer = await png(12, 12);
  const sha = sha256(buffer);
  const row = { id: id(1), organizationId: ORG_A, businessSnapshot: { businessName: 'A', logoDataUrl: dataUrl(buffer) }, revisions: [] };

  const same = fakeStorage({ existing: new Map([[`${ORG_A}/${sha}`, Buffer.from(buffer)]]) });
  const okClient = fakeClient([row]);
  const counts = await run({ client: okClient, storage: same, apply: true, log: quiet });
  assert.deepEqual(same.calls, [['save', ORG_A, sha], ['read', ORG_A, sha]]);
  assert.equal(counts.verified, 1);
  assert.equal(counts.rewritten, 1);

  const different = fakeStorage({ existing: new Map([[`${ORG_A}/${sha}`, Buffer.from('other bytes')]]) });
  const badClient = fakeClient([row]);
  await assert.rejects(run({ client: badClient, storage: different, apply: true, log: quiet }), /does not match/);
  assert.equal(badClient.calls.filter(call => /^\s*UPDATE/i.test(call.sql)).length, 0);
});

test('invalid data URLs are stripped and counted; guard misses are skipped, not overwritten', async () => {
  const rows = [
    { id: id(1), organizationId: ORG_A, businessSnapshot: { businessName: 'A', logoDataUrl: 'data:image/png;base64,AAAA' }, revisions: [] },
    { id: id(2), organizationId: ORG_A, businessSnapshot: { businessName: 'A', logoDataUrl: null }, revisions: [{ businessSnapshot: { businessName: 'A' } }] }
  ];
  const client = fakeClient(rows, { guardFails: new Set([id(2)]) });
  const storage = fakeStorage();
  const counts = await run({ client, storage, apply: true, log: quiet });
  assert.deepEqual(storage.calls, []);
  const updates = client.calls.filter(call => /^\s*UPDATE/i.test(call.sql));
  assert.deepEqual(JSON.parse(updates[0].params[0]), { businessName: 'A' });
  assert.equal(counts.invalid, 1);
  assert.equal(counts.rewritten, 1);
  assert.equal(counts.skipped, 1);
});

test('--apply refuses local-disk storage unless --local-disk is passed', () => {
  assert.deepEqual(parseMode([], false), { apply: false }, 'dry run is fine on local disk');
  assert.deepEqual(parseMode([], true), { apply: false });
  assert.deepEqual(parseMode(['--apply'], true), { apply: true });
  const refused = parseMode(['--apply'], false);
  assert.equal(refused.apply, true);
  assert.match(refused.error, /Refusing --apply with local-disk logo storage/);
  assert.match(refused.error, /LOGO_STORAGE=supabase/);
  assert.deepEqual(parseMode(['--apply', '--local-disk'], false), { apply: true });
  assert.deepEqual(parseMode(['--local-disk'], false), { apply: false });
});

test('batches of 50 by id stop when a SELECT returns fewer rows', async () => {
  const rows = Array.from({ length: BATCH_SIZE + 3 }, (_, n) => ({ id: id(n + 1), organizationId: ORG_A, businessSnapshot: { businessName: 'A', logoDataUrl: null }, revisions: [] }));
  const client = fakeClient(rows);
  const counts = await run({ client, storage: fakeStorage(), log: quiet });
  const selects = client.calls.filter(call => /^\s*SELECT/i.test(call.sql));
  assert.equal(BATCH_SIZE, 50);
  assert.equal(selects.length, 2);
  assert.deepEqual(selects.map(call => call.params[0]), [FIRST_CURSOR, id(BATCH_SIZE)]);
  assert.match(selects[0].sql, /LIMIT 50/);
  assert.match(selects[0].sql, /ORDER BY id/);
  assert.equal(counts.scanned, BATCH_SIZE + 3);
});
