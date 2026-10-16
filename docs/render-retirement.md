# Render retirement checklist

**Do not delete or disable the Render service while working through this file.** Retirement is the last step of the migration and runs only after the Vercel backend has been stable in production for an agreed period. Nothing here should be executed before Task 8 cutover and Task 9 end-to-end verification have both passed.

Audit date: this file records the dependency sweep as of the code-preparation phase. Re-run the sweep in step 1 before acting, because the cutover changes two of the entries.

---

## 1. Dependency sweep

Re-run before acting:

```bash
git grep -nE 'onrender\.com|render\.yaml|RENDER_' -- . ':!*/node_modules/*' ':!*/dist/*'
```

### Requires action

| # | Coupling | Location | Resolved by |
|---|---|---|---|
| 1 | API and uploads rewrites | `Frontend/vercel.json` rewrite destinations | Task 8 cutover |
| 2 | Rewrite assertion and test name | `Frontend/tests/securityPolicy.test.js` | Task 8 cutover |
| 3 | `.onrender.com` hostname validation | `Frontend/scripts/configureVercel.mjs` | This checklist, step 4 |
| 4 | Deployment instructions | `docs/deployment.md` — title, `## Render`, `## Vercel` | This checklist, step 5 |
| 5 | Service blueprint | `render.yaml` (repository root) | This checklist, step 6 — last |

### No action needed

These mention Render accurately and stay true while `server.js` remains the long-lived startup path:

- `Backend/.env.example` — cites Render as an example of a persistent backend for connection choice and for `HOST`
- `docs/ARCHITECTURE.md` — describes `server.js` as local/Render startup
- `Backend/VERCEL.md`, `VERCEL-VERIFY.md`, `VERCEL-HANDOFF.md` — migration documents that deliberately reference Render as the rollback target

### Categories cleared by audit

| Category | Finding |
|---|---|
| OAuth callbacks | No Render URL anywhere in the chain. Google's redirect URI points at Supabase `/auth/v1/callback`; Supabase Site URL and allowed redirect use the **website** origin. Confirm in the Supabase dashboard (step 2). |
| File storage | Logos live in Supabase Storage. `LOGO_STORAGE=supabase` is enforced at startup on Vercel, `UPLOAD_DIR` is local-only. No Render disk dependency at runtime — but see step 3. |
| Monitoring | Only `render.yaml` `healthCheckPath: /healthz`, which is internal to Render and disappears with the service. No external uptime integration found in the repository. |
| Environment references | Render's own variables are set in its dashboard as `sync: false`. Neither Vercel project references Render. Frontend env files contain only `VITE_API_BASE_URL`. |

---

## 2. Confirm the OAuth chain (operator, Supabase dashboard)

The repository cannot prove this; it has to be read from Supabase.

- [ ] Supabase Auth → URL Configuration → **Site URL** is the production frontend origin
- [ ] Allowed redirect URLs contain the production frontend origin pattern, and **no** `*.onrender.com` entry
- [ ] Google's authorised redirect URI still points at Supabase `/auth/v1/callback`, not at any service host
- [ ] Any localhost redirect entries are intentional

Removing Render cannot break Google sign-in if all four hold, because Render never appears in the flow.

---

## 3. Confirm no logo is stranded on Render's filesystem

This is the one data-loss risk in retirement, and it is easy to miss.

`LOGO_STORAGE=supabase` was enabled at some point. `Backend/scripts/setupLogoStorage.js` copies local logos into the private bucket and **deliberately keeps the local originals**. Any logo uploaded while the backend was still on local storage exists on Render's disk, and may or may not have been copied.

- [ ] For every organization with a non-null `logoPath`, confirm the object exists in the Supabase bucket
- [ ] Confirm the live Vercel backend can serve each one through `GET /uploads/<file>` as an authenticated member of the owning organization
- [ ] Only then treat Render's disk as disposable

Bills finalized before the logo backfill embed their logo as base64, so those invoices are unaffected either way. Newer bills reference a content-addressed object (`org/<organizationId>/<sha256>.png`) in the bucket, written at upload or finalize time, so they never depend on Render's disk. The risk is limited to the current logo of each organization.

---

## 4. Resolve the vercel.json generator

`Frontend/scripts/configureVercel.mjs` writes `Frontend/vercel.json` and rejects any host not ending in `.onrender.com`. Its output has also drifted from the committed file: it emits `framework`, `buildCommand` and `outputDirectory` keys, `:path*` rewrite syntax rather than `(.*)`, a negative-lookahead SPA catch-all, and extra `Cache-Control` header blocks.

It is invoked only by hand and reached by no npm script or CI job, so it is inert where it stands. Pick one:

- [ ] **Delete it** and remove its mention from `docs/deployment.md`. Cleanest if the routing config is now maintained by hand.
- [ ] **Retarget it** to the Vercel backend host and realign its template with the committed `vercel.json`, then regenerate and diff to confirm no unintended routing or header change.

Do not leave it as-is after retirement. A script that silently rewrites live routing to a decommissioned host is a trap.

---

## 5. Rewrite the deployment documentation

- [ ] Retitle `docs/deployment.md` away from "Vercel frontend + free Render backend"
- [ ] Replace the `## Render` section with the Vercel backend project settings, or point at `Backend/VERCEL-HANDOFF.md`
- [ ] Update the `## Vercel` section: drop the `configureVercel.mjs` instruction, keep `VITE_API_BASE_URL=/api`
- [ ] Keep the Supabase Auth paragraph; it is correct and host-independent
- [ ] Update `## Release checks`, which currently says "through both proxies"

---

## 6. Retire the service

Only after steps 1–5, and after the Vercel backend has been stable in production for the agreed window.

- [ ] Vercel backend has served production traffic with no unexplained errors for the agreed period
- [ ] Rollback is no longer wanted — confirm explicitly with the owner
- [ ] Export anything worth keeping from Render: deployment history, logs, the environment variable **names** actually in use
- [ ] Suspend the service first and observe. Do not delete.
- [ ] After the observation window with no impact, delete the service
- [ ] Remove `render.yaml` in a separate, clearly labelled commit
- [ ] Note the retirement in `docs/deployment.md`

Suspend before delete. A suspended service can be resumed; a deleted one cannot.

---

## 7. Rollback remains available until step 6

Until the service is deleted, recovery is reverting the two rewrite destinations in `Frontend/vercel.json` plus the matching assertion in `Frontend/tests/securityPolicy.test.js`, then redeploying the frontend. No backend change is needed.

Two facts that keep this cheap:

- The backend code is hosting-neutral. `server.js` still binds a port and runs under `npm start`, so Render keeps working after the app/server split. `engines.node` is `>=22`, which accepts the `NODE_VERSION 22.22.0` pinned in `render.yaml`, so a Render rebuild is not blocked.
- `render.yaml` sets `autoDeployTrigger: off`, so Render serves the commit it last deployed and will not pick up migration commits on its own. Check which commit that is before relying on it, and redeploy deliberately if you need a newer one.
