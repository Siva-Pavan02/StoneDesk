-- Externalize invoice logos: MANUAL operator steps only. No schema change (no DDL).
-- Not for `prisma db push` and not to be applied as a migration. Run each step by hand,
-- in order, with explicit operator approval. See prisma/MIGRATION.md
-- ("Externalize invoice logos (no schema change)") for the full rollout order.
-- VACUUM cannot run inside a transaction, so this file has no BEGIN/COMMIT.

-- Step 0 (read-only): measure before and after.
SELECT avg(pg_column_size("businessSnapshot")) AS avg_snapshot_bytes,
       count(*) FILTER (WHERE "businessSnapshot" ? 'logoDataUrl') AS rows_with_embedded_logo
FROM "Dispatch";
SELECT pg_size_pretty(pg_total_relation_size('"Dispatch"')) AS dispatch_total_size;
-- The logo bucket must stay backend-only: expect 0 (scripts/checkDatabase.js runs the same check).
SELECT count(*) AS storage_policies_on_logo_bucket FROM pg_policies
WHERE schemaname = 'storage' AND (coalesce(qual, '') ILIKE '%stonedesk-logos%' OR coalesce(with_check, '') ILIKE '%stonedesk-logos%');

-- Step 1 (shell, off-database backup; a backup table inside Postgres would itself cost the space
-- this change frees). DIRECT_URL comes from the operator's environment; never paste it into files.
--   pg_dump "$DIRECT_URL" --data-only --table='"Dispatch"' --format=custom --file=dispatch-before-logos.dump

-- Step 2 (shell, from Backend/): dry run first (default, reads only and prints counts), then write.
-- Use the production storage settings (LOGO_STORAGE=supabase, SUPABASE_URL, storage secret key):
-- --apply refuses local-disk storage unless --local-disk is passed (disposable databases only).
--   node scripts/externalizeSnapshotLogos.js
--   node scripts/externalizeSnapshotLogos.js --apply

-- Step 3: make the freed space reusable and refresh planner statistics.
VACUUM (ANALYZE) "Dispatch";

-- Step 4 (off-hours only: VACUUM FULL takes an ACCESS EXCLUSIVE lock and rewrites the table).
-- Needed to shrink the reported database size.
-- VACUUM FULL "Dispatch";
