# Backend deployment verification runbook

Operator checklist for standing up the separate Vercel backend project and proving it works **before** any frontend traffic moves. Render stays live and untouched throughout.

Read `VERCEL.md` first for the entrypoint, pooling, environment and transaction-mode background. This file is the ordered procedure plus places to record what you observed.

Nothing here deletes or resets data. Do not apply schema changes as part of this runbook.

---

## Part A — Create the project

| # | Step | Expected |
|---|---|---|
| A1 | New Vercel project, import `Siva-Pavan02/StoneDesk` | Repository connects |
| A2 | Set **Root Directory** to `Backend` | Vercel re-detects from that folder |
| A3 | Confirm detected framework | `Express` |
| A4 | Install command | `npm ci` |
| A5 | Build command | Leave empty. `prisma generate` runs from `postinstall`. |
| A6 | Output directory | Leave empty. Setting one breaks the function build. |
| A7 | Node.js version | `24.x`. `engines.node` pins it anyway; they should agree. |
| A8 | Do **not** add a custom domain yet | Preview URL is enough for this runbook |

Record: project name, and whether A3 showed Express without being told.

```text
A3 detected framework: ______________________
```

---

## Part B — Environment variables

Use the matrix in `VERCEL.md` ("Environment variable matrix") as the source of truth. Set names in the dashboard; take values from Supabase, Upstash and your SMTP provider.

Scope deliberately. Set the **Preview** environment separately from **Production** — in particular `APP_ORIGIN`, which must be the exact frontend origin for that environment or every browser request is rejected with 403.

Checklist, all required for a working preview:

- `NODE_ENV` = `production` (exact string; the session cookie's `Secure` flag depends on it)
- `APP_ORIGIN` = the frontend origin you will test from, scheme included, no trailing slash
- `TRUST_PROXY` = `1`
- `DATABASE_URL` = Supabase **transaction pooler**, port 6543, with `pgbouncer=true&connection_limit=1&sslmode=require`
- `DIRECT_URL` = direct or session connection (port 5432). Required even though runtime does not use it, because the Prisma schema reads it.
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`
- `LOGO_STORAGE` = `supabase` (the app refuses to boot on Vercel otherwise)
- `SUPABASE_LOGO_BUCKET` if you are not using the `stonedesk-logos` default
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (without these, every auth attempt returns 503 by design)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` only if you intend to test password reset

Do **not** set: `VERCEL` (the platform sets it), `SERVE_FRONTEND`, `UPLOAD_DIR`, `PORT`, `HOST`, `TEST_DATABASE_URL`, `TEST_DIRECT_URL`.

Use a staging Supabase project and a staging bucket for preview checks if you have them. Keep the logo bucket **private**.

---

## Part C — Build log review

Deploy, then read the build log for these specific signals.

| # | Look for | Pass condition |
|---|---|---|
| C1 | Node version line | Reports 24.x |
| C2 | `npm ci` | Completes, no `EBADENGINE` |
| C3 | `prisma generate` | "Generated Prisma Client" appears |
| C4 | Entrypoint | Build resolves `app.js`, not `server.js` |
| C5 | Absence of a listener message | "Server running on port" must **not** appear. If it does, `server.js` was selected and the split regressed. |
| C6 | Bundle size | Note it. Sharp is a native dependency; the limit is 250 MB. |

```text
C1 Node version: ____________    C3 prisma generate: pass / fail
C4 entrypoint:   ____________    C5 listener message present: yes / no
C6 bundle size:  ____________
```

---

## Part D — Smoke test the preview URL

Let `API` be the preview deployment URL. These two need no session:

```bash
curl -i "$API/healthz"
curl -i "$API/api/healthz"
```

Expected: `200` with `{"ok":true}`. This endpoint performs no database work, so a failure here is a build, boot or environment problem, not a database one.

Boot-failure triage: a 500 on `/healthz` most likely means a startup throw. The three startup conditions are a missing `APP_ORIGIN` in production, `LOGO_STORAGE` not set to `supabase`, and `SERVE_FRONTEND=true`. Check those three before anything else.

Then confirm the auth boundary is intact:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/dispatches"
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/loading-lists"
curl -s -o /dev/null -w '%{http_code}\n' "$API/uploads/00000000-0000-4000-0000-000000000000.png"
```

Expected: `401` on all three. A `404` means routing did not reach the app; a `200` is a serious auth regression — stop and report it.

Origin enforcement:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "Origin: https://evil.example" "$API/healthz"
curl -si -H "Origin: $APP_ORIGIN" "$API/healthz" | grep -i access-control-allow-origin
```

Expected: `403` for the untrusted origin; the allowed origin echoed back exactly, never `*`.

```text
D1 /healthz: ______   D2 /api/healthz: ______
D3 /api/dispatches: ______  /api/loading-lists: ______  /uploads/<uuid>.png: ______
D4 untrusted origin: ______  D5 ACAO value: ____________________
```

---

## Part E — Authenticated functional pass

Sign in through a browser pointed at the preview frontend (so requests stay same-origin through the rewrite), or with a cookie jar:

```bash
curl -c jar.txt -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' -H "Origin: $APP_ORIGIN" \
  -d '{"email":"...","password":"..."}'
curl -b jar.txt "$API/api/auth/session"
```

On the login response, confirm the `Set-Cookie` carries `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` and **no** `Domain`.

Then exercise, recording status and rough latency for each:

| # | Area | Check |
|---|---|---|
| E1 | Session | `GET /api/auth/session` returns the user |
| E2 | Master settings | profile and products load |
| E3 | Loading lists | search returns `{data,nextCursor}`, detail loads, save persists |
| E4 | Dispatches | list, search, detail |
| E5 | Dispatch create | draft saves |
| E6 | Finalization | draft finalizes, invoice totals match the draft |
| E7 | Invoice payment | partial payment, then a payment exceeding the balance is **rejected** |
| E8 | Analytics | dashboard figures render |
| E9 | Logo | upload a PNG and a JPEG, then read `/uploads/<file>` back |
| E10 | Roles | Admin, Dispatcher and Yard Manager each see the right permissions |
| E11 | Inactive user | a paused account is refused |
| E12 | Tenant isolation | with two organizations, neither sees the other's data |
| E13 | Rate limiting | repeated bad logins eventually return 429 with `Retry-After` |
| E14 | Password reset | only if SMTP was configured |

```text
E1 ____ E2 ____ E3 ____ E4 ____ E5 ____ E6 ____ E7 ____
E8 ____ E9 ____ E10 ____ E11 ____ E12 ____ E13 ____ E14 ____
```

---

## Part F — Runtime log review

Open the project's runtime logs and look specifically for:

| Signal | Meaning |
|---|---|
| `P1001`, `P1002`, `P1017` | Cannot reach or lost the database. Check `DATABASE_URL` host and port. |
| `P2024` | Connection pool timeout. Invocations are queuing for the single connection. |
| `P2028` | Interactive transaction timed out. Surfaces to the client as a generic 500. |
| `prepared statement ... already exists` | `pgbouncer=true` is missing from `DATABASE_URL`. |
| `Max client connections reached` | Too many pooler clients. Lower `connection_limit` or review instance count. |
| Function timeout / duration at the ceiling | Cold start or a slow query |
| `Sign-in protection is temporarily unavailable` | Upstash unreachable or its variables are wrong |
| `Logo storage is temporarily unavailable` | Supabase Storage or `SUPABASE_SECRET_KEY` problem |
| Sharp or native-module load errors | Bundling problem on the Node 24 runtime |
| `request_failed` with code `UNEXPECTED` | Unmapped server error; correlate with the request |

Confirm no log line contains a connection string, a password, a token or a Supabase key. `utils/errorHandler.js` is built to emit only an event name and a whitelisted code, so a leak here is a defect worth reporting.

```text
F1 Prisma errors observed: ______________________________
F2 Pool/connection errors: ______________________________
F3 Timeouts:               ______________________________
F4 Storage / Upstash:      ______________________________
F5 Any secret in logs:     yes / no
```

---

## Part G — Cold start and client IP

Two measurements that matter for this migration specifically.

**G1 — Cold versus warm.** Leave the deployment idle for several minutes, then time `/healthz` and an authenticated `GET /api/dispatches`. Repeat immediately for the warm figure.

```text
cold /healthz: ______ ms    warm /healthz: ______ ms
cold /api/dispatches: ______ ms    warm: ______ ms
```

**G2 — Client IP.** Authentication rate limits are keyed on `req.ip`, so `TRUST_PROXY=1` has to resolve to the real caller. From two different networks, trigger enough failed logins to approach the limit and confirm the budgets are independent rather than shared. If one network's failures exhaust the other's budget, `req.ip` is resolving to the edge and the limiter is effectively global — report it rather than working around it.

```text
G2 independent IP budgets: yes / no
```

---

## Stop condition

Do not change `Frontend/vercel.json` from this runbook. Report results back; frontend cutover is the next task and needs Parts C through G to pass first.

## Deferred to Render retirement

`Frontend/scripts/configureVercel.mjs` generates `Frontend/vercel.json` and validates that its argument ends in `.onrender.com`, so it would reject a Vercel backend host. Its output has also drifted from the committed `vercel.json`: it emits `framework`, `buildCommand` and `outputDirectory` keys, `:path*` rewrite syntax rather than `(.*)`, a negative-lookahead SPA catch-all, and extra `Cache-Control` header blocks. Running it would rewrite the live routing config even if the hostname were correct.

It is invoked only by hand, documented in `docs/deployment.md`, and reached by no npm script or CI job, so it is inert where it stands. Decision for this migration: leave it untouched, do not run it, and cut over `Frontend/vercel.json` by hand. Retarget or remove it during Render retirement, and update `docs/deployment.md` at the same time.
