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

## Externalize invoice logos (no schema change)

Finalized bills used to embed the logo as a base64 data URL in `Dispatch.businessSnapshot.logoDataUrl`, and each revision copied the whole `businessSnapshot`. That was most of the `Dispatch` bytes. Logos are now immutable, content-addressed objects in the private `SUPABASE_LOGO_BUCKET` (default `stonedesk-logos`) at `org/<organizationId>/<sha256>.png`. Snapshots store only `businessSnapshot.logo = { sha256, width, height, bytes }`, and revisions no longer copy `businessSnapshot`. `businessSnapshot` and `revisions` are already JSON and `logoPath` stays a string, so there is nothing to `db push`. The manual steps are in `prisma/changes/20261103_externalize_logos.sql`.

Rollout order:

1. Readers: deploy the frontend first. Its logo hydration accepts both shapes and stays inert until bills carry references. Old bills with `logoDataUrl` render unchanged.
2. Writers: deploy the backend. The `GET /uploads/logos/<sha256>.png` route (session organization only, `private, max-age=31536000, immutable`), content-addressed `storeLogo`, reference-only finalize snapshots and revisions without `businessSnapshot` ship together. New uploads set `MasterSettings.logoPath` to `/uploads/logos/<sha256>.png`. Legacy `/uploads/<uuid>.png` values keep working: finalize copies them to the content-addressed key once and references that copy.
3. Back up `"Dispatch"` off-database with `pg_dump` via `DIRECT_URL` (command in the SQL note). Do not create a backup table inside Postgres.
4. Backfill: run `node scripts/externalizeSnapshotLogos.js` (dry run by default, prints counts only). With explicit operator approval, run it again with `--apply`. Run it with the production storage settings (`LOGO_STORAGE=supabase`, `SUPABASE_URL` and the storage secret key) so the objects land in the bucket the backend reads. `--apply` refuses to run with local-disk storage, because it would write the logos to the operator's machine while stripping them from the database `DIRECT_URL` points at. Only for a disposable local database, add `--local-disk` to allow it. It uploads each distinct (organization, sha256) once, verifies existing objects byte for byte, and rewrites rows with raw SQL guarded on the snapshot as read, so `@updatedAt` is not bumped and a re-run is a no-op. Invalid embedded logos are stripped and counted; they already render as the placeholder.
5. Reclaim space: `VACUUM (ANALYZE) "Dispatch";`, then `VACUUM FULL "Dispatch";` off-hours (exclusive lock) to shrink the reported database size.
6. Later, not part of this change: orphan cleanup. List `org/<organizationId>/` and delete objects that no `logoPath` or snapshot sha references, through the Storage API `remove()` only, never SQL on `storage.objects`. Delete legacy flat `<uuid>.png` objects only after confirming no `logoPath` points at them.

The bucket stays backend-only: create no `storage.objects` policies for `anon` or `authenticated`. With no policies, clients are denied and the server's secret key bypasses RLS. `npm run db:check` fails if any storage policy references the bucket.

Rollback: once step 2 is live, roll forward with a fixed build of the new backend instead of rolling back. The reader route ships in the same deploy as the writers, so no earlier backend build can read what this change writes. Rolling the backend back past step 2 has these effects:

- Organizations that uploaded a logo on the new code have `MasterSettings.logoPath = /uploads/logos/<sha256>.png`. The old finalize accepts only `/uploads/<uuid>.png`, so every finalize for those organizations fails with 400 "Invalid stored logo". Their current logo (settings and workspace) also stops loading, because the old `/uploads` route only serves `<uuid>.png` and returns 404.
- The old backend has no `GET /uploads/logos/:file`, so every bill that holds only a `businessSnapshot.logo` reference shows the LOGO placeholder on screen, in print and in PDFs. Before the backfill, that is the bills finalized since step 2. After the backfill, it is every bill with a logo.

No data is lost: objects are never overwritten or deleted, and the step 3 dump keeps the embedded bytes. If a rollback cannot be avoided:

- Each affected organization must remove its logo or upload it again on the old build. That writes a `/uploads/<uuid>.png` path, and finalize works again.
- Bills that hold only a reference need their bytes put back. For the backfilled rows, load the step 3 dump into a scratch table and copy back only `businessSnapshot` and `revisions` by id. A whole-table restore would overwrite later payments, status changes and new bills. Bills finalized after step 2 were never embedded, so the dump cannot help them. They need a re-inline script that reads `org/<organizationId>/<sha256>.png` and writes `logoDataUrl` back. That script does not exist yet; write and review it before rolling back.

Do not run orphan cleanup until the change is final.

Later options: lower the bucket `fileSizeLimit` to 512 KB once every object is re-encoded, and encode smaller logos (`fit inside 384×384`, palette PNG). Both only save Storage, egress and PDF size.

## Compatibility

YardManager is stored in PostgreSQL and serialized as Yard Manager. Inventory, measurements, frozen totals and branding remain JSON. Legacy piece-shaped records remain readable.

## Tests

`npm test` requires explicit `TEST_DATABASE_URL` in `Backend/.env.test`; it never falls back to production DATABASE_URL. Optional `TEST_DIRECT_URL` selects the administrative test connection. Tests create isolated `stonedesk_test_<random UUID>` schemas and remove only their own schema. Use a disposable PostgreSQL database with schema-creation privileges. Keep all credentials out of source control and browser bundles.
