-- Add an organization-scoped payment request ID without changing legacy rows.
-- Prisma 6 cannot model a compound unique index containing an optional field.
BEGIN;
ALTER TABLE "InvoicePayment"
  ADD COLUMN IF NOT EXISTS "clientRequestId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relname = 'InvoicePayment'
      AND a.attname = 'clientRequestId'
      AND NOT a.attisdropped
      AND a.atttypid = 'uuid'::regtype
  ) THEN
    RAISE EXCEPTION 'InvoicePayment.clientRequestId must be uuid';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "InvoicePayment_org_clientRequestId_key"
  ON "InvoicePayment" ("organizationId", "clientRequestId")
  WHERE "clientRequestId" IS NOT NULL;
COMMIT;
