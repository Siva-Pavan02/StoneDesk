# Supabase backend migration

The Express API uses Prisma Client with the server-only DATABASE_URL (Supabase session pooler, port 5432). Local email/password sessions remain managed by Express.

## Apply and run

From server/: npm install, npx prisma db push, node scripts/protectDatabase.js, npm run dev.

Do not use --accept-data-loss without reviewing affected tables and taking a backup. db push creates schema; it does not import MongoDB records.

## Compatibility

API responses retain _id aliases for the existing React client. YardManager is stored in PostgreSQL and serialized as Yard Manager. Inventory, measurements, frozen totals, and branding remain JSON objects. Legacy piece-shaped records are supported by calculation and export code. Historical MongoDB data itself has not been copied or deleted.

## Tests

npm test provisions isolated stonedesk_test_<random UUID> schemas and cleans each up after its suite. TEST_DATABASE_URL can select a dedicated test project; otherwise DATABASE_URL is used with a temporary schema override. Integration tests require network connectivity and schema creation privileges. Never point manual cleanup at public.

## Security

protectDatabase.js enables RLS and revokes anon/authenticated access on the five application tables. Prisma uses the privileged server role; Express enforces sessions and staff roles. Keep DATABASE_URL out of the browser and source control.
