-- AddColumn: version history for admin invoice revisions. No backfill; existing rows default to [].
BEGIN;
ALTER TABLE "Dispatch" ADD COLUMN IF NOT EXISTS "revisions" JSONB NOT NULL DEFAULT '[]';
COMMIT;
