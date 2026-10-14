# Backend preview preparation

Production still uses Render. This change does not switch the frontend rewrite, deploy a backend, or apply database changes.

## Project

Create a separate Vercel project with root `Backend`, Express framework, install command `npm ci`, and Node 24.x in project settings. `app.js` exports the app; importing it does not start a listener or eagerly connect to PostgreSQL. `server.js` holds the listener and process lifecycle, so local/Render `npm start` still starts a traditional server. Vercel's Express runtime resolves the first match among `app`, `index`, `server` (also under `src/`) and requires either a default export or a port listener. `Backend/app.js` is the first candidate and exports the app, so it is the entrypoint; `server.js` is never selected. `package.json` `main` points at `app.js` for consistency. `vercel.json` declares `{"framework":"express"}` only. Do not set an output directory or add legacy `@vercel/node` builds.

Two platform constraints apply. First, `express.static()` is ignored on Vercel; static assets would have to live in `public/**`. Both static mounts in `app.js` are already unreachable there, because the startup check rejects `SERVE_FRONTEND=true` and requires `LOGO_STORAGE=supabase`, which routes logo reads through Supabase Storage instead of the local directory. Second, an Express app that renders its own error page leaves the function in an undefined state, so `utils/errorHandler.js` must stay registered last and must keep answering with JSON. The app is deployed as a single function on Fluid compute.

`package.json` declares `engines.node` as `>=22`. That range exists for compatibility, not for runtime selection: it is wide enough to accept the Node 22.22.0 that `render.yaml` pins for the rollback deployment, so one declaration serves both hosts and `render.yaml` needs no edit.

The Vercel project selects its runtime explicitly. Set **Node.js 24.x** in project settings rather than leaving the version to range resolution. Vercel does read `engines.node` in preference to that dropdown, and a `>=22.0.0` range resolves to the latest 24.x, so the two agree here — but agreement is not the same as confirmation. Treat the build log as the only authority and record the reported version at check C1.

The floor is set by dependencies, not preference: `@supabase/supabase-js` requires Node 22 or newer, followed by `sharp` at 20.9 and `nodemailer` at 20, so anything below 22 is refused. The repository test run uses Node 24.16.0.

## Server-only environment

- `NODE_ENV=production`, `APP_ORIGIN` set to the exact HTTPS frontend preview origin.
- `LOGO_STORAGE=supabase`, `SUPABASE_LOGO_BUCKET`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`; keep the bucket private. Vercel rejects local-logo storage and combined frontend serving.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Auth attempts return 503 if distributed protection is unavailable, including timeout responses. Local fallback is development/test only. Account keys hash normalized emails; IP and account budgets are each 20 attempts per 15 minutes. A targeted account can temporarily exhaust its budget; there is no permanent lockout.
- `DATABASE_URL`: use the Supabase dashboard's transaction-pooler connection for serverless compute, with Prisma 6-compatible `pgbouncer=true`, a deliberately small `connection_limit` (start with 1 and load-test), and bounded `pool_timeout`/`connect_timeout`. Each warm instance has one module-level Prisma client; total connections still scale with instances.
- `DIRECT_URL`: administrative direct connection, or session pooler where direct IPv6 is unavailable. Use for reviewed schema operations outside request handling. Never point migrations at transaction pooling. Do not print these values.
- Configure the existing SMTP variables for reset email. Use staging accounts/database/bucket for preview checks.

Keep browser calls same-origin through frontend `/api` and `/uploads` rewrites so secure, HttpOnly, SameSite=Strict cookies stay on the frontend host. Configure the preview origin in Supabase's OAuth redirect allow-list. Verify actual client IP forwarding before enabling `TRUST_PROXY=1`; do not blindly trust arbitrary forwarded headers or broaden `APP_ORIGIN` to all previews.

## Environment variable matrix

Every variable the backend reads, taken from the code rather than from documentation. Set names only in the Vercel dashboard; values come from Supabase, Upstash and your SMTP provider. There is no session or JWT secret to configure: sessions are random 32-byte tokens stored as SHA-256 hashes in the `Session` table, so the database is the only thing that can validate one.

| Variable | Class | Needed on Vercel | Notes |
|---|---|---|---|
| `NODE_ENV` | Runtime configuration | Production and Preview | Must be exactly `production`. Gates the cookie `Secure` flag and strict origin rejection. |
| `APP_ORIGIN` | Runtime configuration | Production and Preview | The exact frontend origin, scheme included. Startup fails without it in production. Scope a separate value to the Preview environment. |
| `TRUST_PROXY` | Runtime configuration | Production and Preview | `1` behind the Vercel edge, so `req.ip` is the caller and not the proxy. Rate limits key on `req.ip`. |
| `DATABASE_URL` | Runtime secret | Production and Preview | Transaction pooler, port 6543. See the connection notes above. |
| `DIRECT_URL` | Runtime secret | Production and Preview | Direct or session connection for schema work only. Read by the Prisma schema, so it must be present even when unused at runtime. |
| `SUPABASE_URL` | Runtime configuration | Production and Preview | Required for Storage and Google sign-in. Validated as an HTTPS origin with no path, query or credentials. |
| `SUPABASE_STORAGE_SECRET_KEY` | Runtime secret | Production and Preview | Server-only. Private logo storage. Falls back to `SUPABASE_SECRET_KEY`. Never expose it to the frontend project. |
| `SUPABASE_ADMIN_SECRET_KEY` | Runtime secret | Production and Preview | Server-only. Auth-user deletion. Falls back to `SUPABASE_SECRET_KEY`. Use a different key from storage so each can be rotated alone. |
| `SUPABASE_SECRET_KEY` | Runtime secret | Production and Preview | Server-only shared fallback for the two keys above. Never expose it to the frontend project. |
| `SUPABASE_PUBLISHABLE_KEY` | Runtime configuration | Production and Preview | Google sign-in. Must carry the `sb_publishable_` prefix. |
| `LOGO_STORAGE` | Runtime configuration | Production and Preview | Must be `supabase`. Startup rejects anything else here. |
| `SUPABASE_LOGO_BUCKET` | Runtime configuration | Optional | Defaults to `stonedesk-logos`. Keep the bucket private. |
| `UPSTASH_REDIS_REST_URL` | Runtime secret | Production and Preview | Without it, every authentication attempt returns 503 by design. |
| `UPSTASH_REDIS_REST_TOKEN` | Runtime secret | Production and Preview | As above. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Runtime secret | Optional | Password reset only. Absent credentials log a warning at first use and fail the reset request; nothing else degrades. |
| `SERVE_FRONTEND` | Runtime configuration | Must be unset or false | Startup rejects `true`. |
| `UPLOAD_DIR` | Local only | No | Ignored while `LOGO_STORAGE=supabase`. |
| `PORT`, `HOST` | Local only | No | Consumed by `server.js`, which the serverless entrypoint never loads. |
| `TEST_DATABASE_URL`, `TEST_DIRECT_URL` | Local only | No | Read by `tests/database.js` from `.env.test`. |
| `MOCK_PORT` | Local only | No | `mock/server.js` only. |
| `VERCEL` | Build-time configuration | Set by the platform | Never set it by hand. Drives the storage and frontend startup checks and forces distributed rate limiting. |

Preview deployments need their own `APP_ORIGIN`, because `NODE_ENV=production` means any origin that is not an exact match gets a 403. A per-deployment preview hostname changes on every push, so point `APP_ORIGIN` at a stable preview alias rather than a one-off deployment URL, and add that same origin to the Supabase OAuth redirect allow-list. Google sign-in is brokered by Supabase Auth over PKCE, so there is no Google client ID or secret in this backend; the redirect targets the frontend origin, not the API.

## Process state

No request outcome depends on a single long-lived process. The only module-level mutable values are lazy per-instance clients and immutable constants: the Nodemailer transporter in `utils/email.js`, the Upstash client and its one-time warning flag in `utils/rateLimiter.js`, and the frozen action and status sets in `utils/auditLog.js` and `utils/dispatchAnalytics.js`. The analytics `Map`s are request-scoped locals inside `buildAnalytics`, not shared state. The in-memory `attempts` map in `utils/rateLimiter.js` is the one piece that would be wrong across instances, and it is unreachable in production: the limiter throws a 503 rather than falling back whenever `NODE_ENV=production` or `VERCEL` is set, so Upstash stays authoritative. There are no timers, intervals or background jobs, and every audit write is awaited before its response is sent, so nothing is left in flight when an invocation freezes.

## Transaction compatibility with transaction-mode pooling

Transaction mode returns a connection to the pool after each transaction, not after each statement, so a `BEGIN … COMMIT` block keeps one backend connection for its whole duration. The payment path in `controllers/paymentController.js` depends on that: inside a single `prisma.$transaction`, it takes `SELECT … FOR UPDATE` on the `Dispatch` row (scoped to the caller's organization), reads the existing `InvoicePayment` rows, recomputes the balance, rejects an amount above that balance, and only then inserts. A second concurrent request blocks on the row lock, then reads the first payment once it commits and is rejected, so total received cannot exceed the invoice total.

The documented limitations of transaction mode do not apply to this codebase: prepared statements are disabled through `pgbouncer=true`; there are no cursors, no `LISTEN`/`NOTIFY`, no temporary tables and no session-level advisory locks; and Prisma awaits statements sequentially rather than pipelining. The only `SET LOCAL` is in `scripts/addGoogleIdentity.js`, which runs on the direct connection and is transaction-scoped regardless.

Two operational consequences follow from `connection_limit=1`. A payment transaction holds the instance's single connection while it runs, so concurrent invocations on the same warm instance queue behind it, bounded by `pool_timeout`; exhaustion surfaces as `P2024`, which `utils/errorHandler.js` already maps to a 503 retry response. Interactive transactions also keep Prisma's defaults for `maxWait` and `timeout`, and a breach raises `P2028`, which is not specifically mapped and therefore returns a generic 500. Watch for both in the preview deployment before tuning either value.

## Schema rollout

This repository previously used `db push` and has no Prisma Migrate baseline. Do not start `migrate deploy` against production as though baseline history exists.

`prisma/changes/20261012_invitations.sql` is additive SQL generated by Prisma 6 `migrate diff`, plus transactional RLS/grant protection. It creates `Invitation` with hashed-token uniqueness, organization/issuer foreign keys, expiry/revocation/use timestamps and an organization/date index. Existing rows are untouched. After backup and explicit operator approval, apply once to the intended application schema with an administrative connection. Run `prisma generate` and the updated `scripts/protectDatabase.js` after schema deployment, before exposing the new application release. The protection script covers every model in the generated schema, so generate from the reviewed schema first.

`prisma/changes/20261020_password_login.sql` must be applied before the backend that uses it is deployed: back up the database; apply the SQL once with explicit operator approval; run `npx prisma generate` and `node scripts/protectDatabase.js`; then deploy the backend. The install step (`npm ci` here, `npm install` on Render) triggers the same `postinstall` `prisma generate`, so a deployment built against a database without the `passwordLogin` column fails every `User` query. `npm run db:check` reports whether the column exists. See [MIGRATION.md](prisma/MIGRATION.md).

Application rollback should retain the table/data. Reverting the signup code restores insecure code-based joining, so prefer a forward fix. Never drop the table as an automatic rollback. Existing members retain access; new members need an invitation. Old frontend signup using only organization ID now gets 400. Loading-list responses change from an array to `{data,nextCursor}`; release matching frontend/backend together in a maintenance window or preview first.

## Required hosted verification before switching

Verify `/healthz`, `/api/healthz`, signed-out `/api/auth/session`, local login, Google signup/link/login, invitation issuance/revocation/redemption, inactive-user rejection, profile/products, dispatch list/search/create/finalize, paginated loading-list search/detail/save, private logo upload/read, password reset, rate limiting/outage behavior, CORS rejection, cookie persistence, and response headers. Use two organizations to verify isolation. Test cold/warm requests and connection counts under representative concurrency.

Only after these pass should a separate approved change move frontend rewrites to the new backend. Keep Render available for recovery. Hosted verification and production query plans/grants remain unverified in this PR: the connected Supabase account does not list StoneDesk.

## References checked

- [Current Express support](https://vercel.com/docs/frameworks/backend/express)
- [Supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Prisma with Supabase](https://supabase.com/docs/guides/database/prisma)
- [Grants and RLS](https://supabase.com/docs/guides/api/securing-your-api)
