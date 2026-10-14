# Supabase backend schema operations

## Before you deploy or run `npm install`

`prisma/changes/20261020_password_login.sql` must reach the database before the code that uses it. In order:

1. Back up the database.
2. Apply `prisma/changes/20261020_password_login.sql` once, with explicit operator approval.
3. Run `npx prisma generate`, then `node scripts/protectDatabase.js`, as for any approved change.
4. Deploy the backend.

`postinstall` runs `prisma generate` on every `npm install` and `npm ci`, so a client generated from this schema fails every `User` query against a database without the `passwordLogin` column. This applies to any host that runs `npm install` (Render and Vercel). Until step 2 is done, use `npm run mock` locally. `npm run db:check` reports whether the column exists.

The Express API uses Prisma 6 and server-only database credentials. Run commands from `Backend/`.

## Existing installations

The repository has no Prisma Migrate baseline. Review and apply the additive `prisma/changes/20261012_invitations.sql` once, with a backup and explicit operator approval. It creates and protects the invitation table without rewriting existing records. See [backend rollout instructions](../VERCEL.md) for ordering, connection modes and rollback limitations. Do not run `migrate deploy` as though a baseline exists.

Apply the additive `prisma/changes/20261020_password_login.sql` once, with a backup and explicit operator approval, **before** deploying the code that uses it. The generated client selects the new `passwordLogin` column on every `User` read, so code running against a database that lacks the column fails every user query (login, session checks and all authenticated routes). Apply the SQL first, then run `npx prisma generate`. The change only adds `"passwordLogin" BOOLEAN NOT NULL DEFAULT true`; existing rows keep the default and still require the current password to change it.

This change performs no backfill, and that is deliberate. An audit-based backfill (marking Google-linked accounts with no `user.google_link` record as password-free) cannot work: `user.google_link` is not in `SENSITIVE_ACTIONS`, so no such audit row is ever written, and `POST /auth/google/link` has no session, so even a logged action would carry no reliable user id. Such a backfill would wrongly mark every linked account as password-free, including accounts linked by confirming a real, known password. Existing Google-signup users whose generated password is unknowable recover through the forgot-password flow, which sets `passwordLogin = true`.

Apply the additive `prisma/changes/20261101_dispatch_revisions.sql` and `prisma/changes/20261102_master_settings_bank_details.sql` once each, with a backup and explicit operator approval, **before** deploying the code that uses them. The generated client selects `Dispatch.revisions` and `MasterSettings.bankDetails`, so code running against a database without these columns fails dispatch and settings queries. Then run `npx prisma generate` and `node scripts/protectDatabase.js`. Existing rows need no backfill: `revisions` defaults to `[]` and `bankDetails` stays NULL (no bank-details line on the invoice).

For a new, disposable database, `npx prisma db push` creates the schema. Never use `--accept-data-loss` against a populated database without reviewing the changes and taking a backup.

After an approved schema change, run `npx prisma generate` and `node scripts/protectDatabase.js`. Protection covers every model in the generated client, enables RLS and revokes PUBLIC, anon and authenticated grants. Prisma's server role remains privileged; Express must enforce organization and role boundaries.

## Compatibility

YardManager is stored in PostgreSQL and serialized as Yard Manager. Inventory, measurements, frozen totals and branding remain JSON. Legacy piece-shaped records remain readable.

## Tests

`npm test` requires explicit `TEST_DATABASE_URL` in `Backend/.env.test`; it never falls back to production DATABASE_URL. Optional `TEST_DIRECT_URL` selects the administrative test connection. Tests create isolated `stonedesk_test_<random UUID>` schemas and remove only their own schema. Use a disposable PostgreSQL database with schema-creation privileges. Keep all credentials out of source control and browser bundles.
