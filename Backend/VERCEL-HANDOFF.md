# Deployment handoff — StoneDesk backend on Vercel

**State: CODE PREPARATION COMPLETE — DEPLOYMENT VERIFICATION PENDING**

For someone with Vercel dashboard access. Everything verifiable without a deployment has been done; what remains needs the platform.

Scope limits for this handoff. Do not change `Frontend/vercel.json`, do not change or disable anything on Render, and do not run `Frontend/scripts/configureVercel.mjs`. Production traffic still goes to Render and stays there until the results below come back clean.

Background detail lives in `VERCEL.md`. The full checklist with blanks to fill in is `VERCEL-VERIFY.md`. This file is the short version plus what to send back.

---

## 1. Project creation

| Setting | Value |
|---|---|
| Repository | `Siva-Pavan02/StoneDesk` |
| Root Directory | `Backend` |
| Framework | Expect Vercel to detect **Express**. `vercel.json` declares `{"framework":"express"}`. |
| Node.js Version | **24.x**, set explicitly in project settings |
| Install Command | `npm ci` |
| Build Command | **leave empty** |
| Output Directory | **leave empty** — setting one breaks the function build |
| Custom domain | not yet |

Entrypoint: Vercel resolves the first of `app`, `index`, `server` (also under `src/`). `Backend/app.js` is the first match and exports the app without binding a port, so it is the entrypoint. `server.js` holds the listener for local and Render use and must never be selected.

Prisma: `prisma generate` runs from the `postinstall` script, so no build command is needed. `engines.node` is `>=22` for Render compatibility only — it is not how the Vercel runtime gets chosen, which is why the project setting is explicit and why C1 confirms the real version from the log.

The app deploys as a single function on Fluid compute. `express.static()` is ignored on Vercel; this is already handled, because the startup check forces Supabase storage and refuses combined frontend serving.

---

## 2. Environment variables — names only

Set these in the Vercel project. Values come from Supabase, Upstash and your SMTP provider. Scope **Preview** separately from **Production**, especially `APP_ORIGIN`.

**Database**
- `DATABASE_URL` — runtime queries. Supabase shared pooler, **transaction mode, port 6543**, with `pgbouncer=true`, `connection_limit=1`, `sslmode=require`. Pooled username form is `postgres.[PROJECT-REF]`.
- `DIRECT_URL` — schema and admin work only, port 5432. Required even though runtime does not use it, because the Prisma schema reads it. Never point migrations at the transaction pooler.

**Supabase**
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` — server-only. Never add it to the frontend project.
- `SUPABASE_PUBLISHABLE_KEY`
- `LOGO_STORAGE` — must be `supabase`; the app refuses to boot on Vercel otherwise
- `SUPABASE_LOGO_BUCKET` — optional, defaults to `stonedesk-logos`. Keep the bucket **private**.

**Auth / security**
- `APP_ORIGIN` — the exact **frontend** origin, scheme included, no trailing slash. Any other origin is rejected with 403, and this value is also the base for password-reset links, so pointing it at the API domain would email links to the wrong host.
- There is no session or JWT secret to configure. Sessions are random tokens stored as SHA-256 hashes in the database, so nothing needs signing.

**Upstash**
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- Without both, every authentication attempt returns 503 by design. There is no in-memory fallback in production.

**SMTP / OAuth**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — only needed for password reset. Absent, reset fails loudly and nothing else degrades.
- No Google OAuth variables belong here. Google sign-in is brokered by Supabase Auth over PKCE. Add the frontend origin to the Supabase OAuth redirect allow-list in the Supabase dashboard.

**Runtime configuration**
- `NODE_ENV` — exactly `production`. Security-bearing: the session cookie gets its `Secure` flag only on this exact string, and strict origin rejection depends on it.
- `TRUST_PROXY` — `1` behind the Vercel edge, so `req.ip` is the caller rather than the proxy. Authentication rate limits are keyed on `req.ip`; check G2 decides whether this is working.

**Do not set:** `VERCEL` (the platform sets it), `SERVE_FRONTEND`, `UPLOAD_DIR`, `PORT`, `HOST`, `TEST_DATABASE_URL`, `TEST_DIRECT_URL`.

---

## 3. Verification sequence

Run in order. Stop and report if a gate fails rather than working around it. Full detail and recording blanks are in `VERCEL-VERIFY.md`.

**Part C — build log**
- C1 Node version reported in the log is 24.x
- C2 `npm ci` completes with no `EBADENGINE`
- C3 "Generated Prisma Client" appears
- C4 build resolves `app.js` as the entrypoint
- C5 `"Server running on port"` is **absent** — if it appears, `server.js` was selected and the app/server split regressed
- (note the bundle size; Sharp is native, the limit is 250 MB)

**Part D — unauthenticated smoke tests** against the preview URL
- D1 `GET /healthz` → `200 {"ok":true}`
- D2 `GET /api/healthz` → `200`
- D3 `GET /api/dispatches`, `/api/loading-lists`, `/uploads/<uuid>.png` → `401` each. A `404` means routing missed the app; a `200` is an auth regression — stop.
- D4 request with `Origin: https://evil.example` → `403`
- D5 request with the allowed origin → `Access-Control-Allow-Origin` echoes it exactly, never `*`

A 500 on `/healthz` means a startup throw. Only three conditions cause it: missing `APP_ORIGIN` in production, `LOGO_STORAGE` not `supabase`, or `SERVE_FRONTEND=true`.

**Part E — authenticated pass.** On login, confirm `Set-Cookie` carries `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` and **no** `Domain`. Then: E1 session · E2 master settings · E3 loading lists (search returns `{data,nextCursor}`, detail, save) · E4 dispatch list/search/detail · E5 dispatch create · E6 finalization with totals matching the draft · E7 partial payment accepted **and** a payment above the balance rejected · E8 analytics · E9 logo upload (PNG and JPEG) then read back · E10 Admin, Dispatcher, Yard Manager permissions · E11 inactive account refused · E12 two-organization isolation · E13 repeated bad logins reach `429` with `Retry-After` · E14 password reset, only if SMTP was configured.

**Part F — runtime logs.** Look for and report: `P1001`/`P1002`/`P1017` (cannot reach database), `P2024` (pool timeout), `P2028` (transaction timeout), `prepared statement ... already exists` (missing `pgbouncer=true`), `Max client connections reached`, function timeouts, `Sign-in protection is temporarily unavailable` (Upstash), `Logo storage is temporarily unavailable` (Supabase Storage), Sharp or native-module load failures, `request_failed` with code `UNEXPECTED`. Also confirm no log line contains a connection string, password, token or key.

**Part G — cold start and client IP**
- G1 time `/healthz` and an authenticated `GET /api/dispatches` after several minutes idle, then immediately again for the warm figure
- G2 from two different networks, approach the login rate limit and confirm the budgets are **independent**. If one network exhausts the other's budget, `req.ip` is resolving to the edge and rate limiting is effectively global — report it rather than working around it.

---

## 4. What to send back

1. **Verified production backend hostname**, copied from Vercel. Not assumed, not inferred.
2. **C1–C5** results, including the Node version string and the bundle size.
3. **D1–D5** status codes, and the `Access-Control-Allow-Origin` value observed.
4. **E1–E14** pass/fail, plus the `Set-Cookie` attributes seen on login.
5. **F1–F5** any error codes observed, and explicit confirmation that no secret appeared in logs.
6. **G1** cold and warm timings; **G2** whether IP budgets were independent.
7. **Log evidence** for anything that failed: the request path, status, timestamp and the error code line. Redact values; the code and event name are enough.

Expected to remain outstanding: **payment concurrency is NOT FULLY VERIFIED** until a disposable test database exists. Check E7 proves the single-request rejection path only. The concurrent race needs either `Backend/.env.test` with a throwaway `TEST_DATABASE_URL`, or two simultaneous payment requests against the preview deployment.

---

## 5. After the results

Frontend cutover is a two-file, hand-applied change once C–G pass: the two rewrite destinations in `Frontend/vercel.json` and the matching assertion in `Frontend/tests/securityPolicy.test.js`. Rollback is reverting those two files and redeploying. Render stays available until that has been stable.
