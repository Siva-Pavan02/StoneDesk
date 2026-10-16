// Moves logo bytes out of Dispatch rows: every finalized bill whose businessSnapshot
// still embeds logoDataUrl gets a content-addressed object at org/<organizationId>/<sha256>.png
// and a small businessSnapshot.logo = { sha256, width, height, bytes } reference instead.
// Revision entries lose their copied businessSnapshot (the history view falls back to the record's).
//
// Order (see prisma/MIGRATION.md, "Externalize invoice logos"):
//   1. Back up "Dispatch" off-database first:
//        pg_dump "$DIRECT_URL" --data-only -t '"Dispatch"' -Fc -f dispatch-before-logos.dump
//   2. Dry run (default; reads only, prints counts):   node scripts/externalizeSnapshotLogos.js
//   3. With operator approval, write:                  node scripts/externalizeSnapshotLogos.js --apply
//      --apply needs LOGO_STORAGE=supabase: it refuses local-disk storage, which would put the
//      logos on this machine while stripping them from the database. Add --local-disk only for
//      a disposable local database.
//   4. Reclaim space with the VACUUM steps in prisma/changes/20261103_externalize_logos.sql.
//
// Rows are rewritten with raw SQL so Prisma's @updatedAt is not bumped (open clients would
// otherwise get 409 on their next edit). The WHERE guard compares the snapshot as read, so a
// re-run or a concurrent change is skipped instead of overwritten. Only counts are printed:
// no ids, data URLs or connection strings.
const sharp = require('sharp');
const { createHash } = require('node:crypto');

const BATCH_SIZE = 50;
const FIRST_CURSOR = '00000000-0000-0000-0000-000000000000';
const SELECT_SQL = `SELECT id, "organizationId", "businessSnapshot", revisions FROM "Dispatch"
  WHERE ("businessSnapshot" ? 'logoDataUrl' OR jsonb_path_exists(revisions, '$[*].businessSnapshot'))
    AND id > $1::uuid
  ORDER BY id LIMIT ${BATCH_SIZE}`;
const UPDATE_SQL = `UPDATE "Dispatch" SET "businessSnapshot" = $1::jsonb,
    revisions = CASE WHEN jsonb_typeof(revisions) = 'array' THEN (
      SELECT coalesce(jsonb_agg(CASE WHEN jsonb_typeof(e.r) = 'object' THEN e.r - 'businessSnapshot' ELSE e.r END ORDER BY e.ord), '[]'::jsonb)
      FROM jsonb_array_elements(revisions) WITH ORDINALITY AS e(r, ord)) ELSE revisions END
  WHERE id = $2::uuid AND "businessSnapshot" IS NOT DISTINCT FROM $3::jsonb`;

const jsonBytes = value => value === undefined ? 0 : Buffer.byteLength(JSON.stringify(value));

// Returns { buffer, sha256, width, height, bytes } for a valid PNG data URL, else null.
async function decodeLogo(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return null;
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length) return null;
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.format !== 'png' || !metadata.width || !metadata.height) return null;
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    return { buffer, sha256, width: metadata.width, height: metadata.height, bytes: buffer.length };
  } catch { return null; }
}

// Pure transform of one row. Never mutates the input.
async function planRow(row) {
  const original = row.businessSnapshot;
  const isObject = original !== null && typeof original === 'object' && !Array.isArray(original);
  let snapshot = original;
  let upload = null;
  let invalid = false;
  if (isObject && Object.hasOwn(original, 'logoDataUrl')) {
    const { logoDataUrl, ...rest } = original;
    snapshot = rest;
    if (logoDataUrl !== null && logoDataUrl !== undefined && logoDataUrl !== '') {
      const decoded = await decodeLogo(logoDataUrl);
      if (decoded) {
        snapshot = { ...rest, logo: { sha256: decoded.sha256, width: decoded.width, height: decoded.height, bytes: decoded.bytes } };
        upload = { organizationId: row.organizationId, sha256: decoded.sha256, buffer: decoded.buffer };
      } else invalid = true; // already renders as the placeholder; stripped and counted
    }
  }
  const revisions = Array.isArray(row.revisions) ? row.revisions : [];
  const revisionBytes = revisions.reduce((sum, entry) => sum + (entry && typeof entry === 'object' && Object.hasOwn(entry, 'businessSnapshot') ? jsonBytes(entry.businessSnapshot) : 0), 0);
  const savedBytes = Math.max(0, jsonBytes(original) - jsonBytes(snapshot)) + revisionBytes;
  return { snapshot, upload, invalid, savedBytes };
}

async function run({ client, storage, apply = false, log = console.log }) {
  const counts = { scanned: 0, rewritten: 0, uploaded: 0, verified: 0, invalid: 0, skipped: 0, savedBytes: 0 };
  const handled = new Set();
  let cursor = FIRST_CURSOR;
  for (;;) {
    const { rows } = await client.query(SELECT_SQL, [cursor]);
    for (const row of rows) {
      counts.scanned++;
      const plan = await planRow(row);
      if (plan.invalid) counts.invalid++;
      if (plan.upload) {
        const key = `${plan.upload.organizationId}:${plan.upload.sha256}`;
        if (!handled.has(key)) {
          handled.add(key);
          if (!apply) counts.uploaded++;
          else {
            const outcome = await storage.saveContentLogo(plan.upload.organizationId, plan.upload.sha256, plan.upload.buffer);
            if (outcome === 'exists') {
              const stored = await storage.readContentLogo(plan.upload.organizationId, plan.upload.sha256);
              if (!Buffer.from(stored).equals(plan.upload.buffer)) throw new Error('Stored logo does not match its hash');
              counts.verified++;
            } else counts.uploaded++;
          }
        }
      }
      if (!apply) { counts.rewritten++; counts.savedBytes += plan.savedBytes; continue; }
      const read = row.businessSnapshot === null || row.businessSnapshot === undefined ? null : JSON.stringify(row.businessSnapshot);
      const next = plan.snapshot === null || plan.snapshot === undefined ? null : JSON.stringify(plan.snapshot);
      const result = await client.query(UPDATE_SQL, [next, row.id, read]);
      if (result.rowCount) { counts.rewritten++; counts.savedBytes += plan.savedBytes; } else counts.skipped++;
    }
    if (rows.length < BATCH_SIZE) break;
    cursor = rows[rows.length - 1].id;
  }
  const verb = apply ? '' : ' (dry run, nothing written)';
  log(`Rows scanned: ${counts.scanned}${verb}`);
  log(`Rows ${apply ? 'rewritten' : 'to rewrite'}: ${counts.rewritten}`);
  log(`Logo objects ${apply ? 'uploaded' : 'to upload'}: ${counts.uploaded}`);
  if (apply) log(`Existing logo objects verified: ${counts.verified}`);
  log(`Invalid embedded logos stripped${apply ? '' : ' (would be)'}: ${counts.invalid}`);
  if (apply) log(`Rows skipped because they changed meanwhile: ${counts.skipped}`);
  log(`Approximate JSON bytes ${apply ? 'saved' : 'to save'}: ${counts.savedBytes}`);
  return counts;
}

// --apply strips the embedded bytes from the database DIRECT_URL points at, so the objects must
// land in the bucket the backend reads. Local-disk storage needs an explicit --local-disk.
function parseMode(argv, cloudEnabled) {
  const apply = argv.includes('--apply');
  if (apply && !cloudEnabled && !argv.includes('--local-disk')) {
    return { apply, error: 'Refusing --apply with local-disk logo storage. Set LOGO_STORAGE=supabase (with SUPABASE_URL and the storage secret key), or add --local-disk for a disposable local database.' };
  }
  return { apply };
}

async function main() {
  require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
  const storage = require('../utils/logoStorage');
  const { apply, error: modeError } = parseMode(process.argv.slice(2), storage.cloudEnabled());
  if (modeError) { console.error(modeError); process.exitCode = 1; return; }
  if (!process.env.DIRECT_URL) { console.error('DIRECT_URL: not configured'); process.exitCode = 1; return; }
  const { Client } = require('pg');
  console.log(`Logo storage: ${storage.cloudEnabled() ? 'supabase' : 'local disk'}${apply ? '' : '; dry run (pass --apply to write)'}`);
  const client = new Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await run({ client, storage, apply });
  } catch (error) {
    console.error(`Logo backfill stopped (${error.code || 'FAILED'}). Rows already rewritten stay valid; re-run to continue.`);
    process.exitCode = 1;
  } finally { await client.end().catch(() => {}); }
}

if (require.main === module) main();

module.exports = { BATCH_SIZE, FIRST_CURSOR, SELECT_SQL, UPDATE_SQL, decodeLogo, planRow, parseMode, run };
