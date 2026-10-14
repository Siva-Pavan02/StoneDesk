-- AddColumn: false only for accounts created by Google sign-up after this release.
-- No backfill: existing rows keep true and still require the current password.
BEGIN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordLogin" BOOLEAN NOT NULL DEFAULT true;
COMMIT;
