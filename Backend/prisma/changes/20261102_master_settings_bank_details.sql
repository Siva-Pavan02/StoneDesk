-- AddColumn: optional business bank / UPI details rendered on finalized invoices.
-- No backfill: existing rows stay NULL and render no bank-details line.
BEGIN;
ALTER TABLE "MasterSettings" ADD COLUMN IF NOT EXISTS "bankDetails" VARCHAR(300);
COMMIT;
