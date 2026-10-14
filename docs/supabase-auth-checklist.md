# Supabase Auth checklist

Checked against the [Supabase Auth docs](https://supabase.com/docs/guides/auth) (API keys, PKCE flow, redirect URLs, server-side auth, Google login). StoneDesk uses Supabase Auth only to verify a Google identity. Users, passwords and sessions are StoneDesk's own (`stonedesk_session` cookie), and data is reached through Prisma, not the Supabase REST API.

## Code (done)

### API keys
- [x] New key format only: the server rejects anything that isn't `sb_publishable_…` (`utils/googleAuth.js`).
- [x] Secret keys only on the server; no `VITE_SUPABASE*` variables.
- [x] `.env` files are git-ignored; only the examples are committed.
- [x] Keys go on the `apikey` header, never `Authorization: Bearer`.
- [x] One secret key per component: `SUPABASE_STORAGE_SECRET_KEY` (logos) and `SUPABASE_ADMIN_SECRET_KEY` (Auth user deletion), falling back to `SUPABASE_SECRET_KEY` (`utils/supabaseKeys.js`).
- [x] Keys are never logged (`utils/errorHandler.js`).

### Google OAuth (PKCE)
- [x] PKCE with an S256 challenge; the code is exchanged on the server (`grant_type=pkce`).
- [x] Verifier and state live in `sessionStorage`, which is per tab, so two tabs cannot overwrite each other's verifier. (The docs' `sb_flow_id` option solves this for supabase-js, which uses shared `localStorage`.)
- [x] Each one-use code is exchanged once, including under React StrictMode.
- [x] Errors in the redirect fragment map to fixed messages; provider text is never shown.
- [x] Identity confirmed server-side with `GET /auth/v1/user`, never by decoding the JWT, and only for a confirmed, verified Google email.
- [x] Supabase tokens never reach the browser. Signup and linking use a 10-minute opaque ticket stored server-side (`utils/googleTickets.js`).
- [x] The Supabase session is ended right after verification (`POST /auth/v1/logout?scope=local`).
- [x] Orphaned Google-only Auth users can be listed and removed (`scripts/cleanupAuthUsers.js`, dry run by default).
- [x] Google sign-in is refused up front in in-app browsers (webviews), where Google blocks it.

### Sessions, caching and database
- [x] Session cookie is httpOnly, `SameSite=strict` and `Secure` in production.
- [x] Requests from unknown origins are rejected before CORS, in both the real API and the mock.
- [x] `Cache-Control: no-store` on every `/api` response.
- [x] Supabase clients are created per call with `persistSession: false`, never shared across requests.
- [x] Account deletion removes the linked Auth user.
- [x] `scripts/protectDatabase.js` enables RLS and revokes `PUBLIC`, `anon` and `authenticated` grants on every table.

## Supabase and Google dashboards (to check)

- [ ] Site URL is the production frontend URL, not `localhost`.
- [ ] Redirect URLs allow the production URL, `http://localhost:5173/**` and Vercel previews (`https://*-<team>.vercel.app/**`).
- [ ] Google provider enabled with a "Web application" OAuth client.
- [ ] Google Cloud authorized redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`; JavaScript origins list the app URL, with `localhost` removed for production.
- [ ] Scopes limited to `openid`, `userinfo.email` and `userinfo.profile`.
- [ ] Consent screen branding verified, or a custom auth domain set, so users don't see `<project-id>.supabase.co`.
- [ ] Security Advisor shows no RLS or grant warnings (re-run `scripts/protectDatabase.js` after every schema change).
- [ ] Two separate secret keys created and set as `SUPABASE_STORAGE_SECRET_KEY` and `SUPABASE_ADMIN_SECRET_KEY`; then `SUPABASE_SECRET_KEY` removed.
- [ ] Upstash Redis configured in production (Google onboarding returns 503 without it, like sign-in rate limiting).
- [ ] `node scripts/cleanupAuthUsers.js` dry run reviewed before any `--apply`.
