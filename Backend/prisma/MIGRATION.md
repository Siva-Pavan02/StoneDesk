# Supabase backend schema operations

The Express API uses Prisma 6 and server-only database credentials. Run commands from `Backend/`.

## Existing installations

The repository has no Prisma Migrate baseline. Review and apply the additive `prisma/changes/20261012_invitations.sql` once, with a backup and explicit operator approval. It creates and protects the invitation table without rewriting existing records. See [backend rollout instructions](../VERCEL.md) for ordering, connection modes and rollback limitations. Do not run `migrate deploy` as though a baseline exists.

For a new, disposable database, `npx prisma db push` creates the schema. Never use `--accept-data-loss` against a populated database without reviewing the changes and taking a backup.

After an approved schema change, run `npx prisma generate` and `node scripts/protectDatabase.js`. Protection covers every model in the generated client, enables RLS and revokes PUBLIC, anon and authenticated grants. Prisma's server role remains privileged; Express must enforce organization and role boundaries.

## Compatibility

YardManager is stored in PostgreSQL and serialized as Yard Manager. Inventory, measurements, frozen totals and branding remain JSON. Legacy piece-shaped records remain readable.

## Tests

`npm test` requires explicit `TEST_DATABASE_URL` in `Backend/.env.test`; it never falls back to production DATABASE_URL. Optional `TEST_DIRECT_URL` selects the administrative test connection. Tests create isolated `stonedesk_test_<random UUID>` schemas and remove only their own schema. Use a disposable PostgreSQL database with schema-creation privileges. Keep all credentials out of source control and browser bundles.
