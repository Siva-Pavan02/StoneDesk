# Google sign-in

1. Enable Google in Supabase Authentication → Sign In / Providers.
2. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `Backend/.env`. Use a publishable key, never a service-role key. Restart the backend after editing.
3. In Supabase Authentication → URL Configuration, set Site URL to your website origin. Add `http://localhost:5173/?google_callback=*` to Redirect URLs for local development. If using a different port/origin, add its equivalent. Add `https://YOUR-DOMAIN/?google_callback=*` when deploying. Do not use a wildcard hostname.
4. Keep Google's authorized redirect URI set to `https://kwxjvtmmjljzdrjjdfoo.supabase.co/auth/v1/callback`.
5. Apply the nullable unique `User.supabaseUserId` field from the Prisma schema before starting the updated backend. Existing rows remain unchanged.

The browser creates a PKCE verifier and per-attempt state in sessionStorage. The backend exchanges the code, validates the Google identity against Supabase's Auth API (`GET /auth/v1/user`), then ends that Supabase session (`POST /auth/v1/logout?scope=local`). Supabase access and refresh tokens never reach the browser. Existing accounts require their StoneDesk password once to link Google; subsequent sign-ins use the stable Supabase user ID. New accounts choose create/join organization, using the existing role rules. Application sessions remain HttpOnly cookies.

When signup or linking is still needed, the backend stores the verified email and Supabase user ID for 10 minutes under a random, opaque ticket (Upstash Redis in production, memory locally) and returns only the ticket. `/auth/signup` and `/auth/google/link` accept `googleTicket`; a ticket is removed once it succeeds, and a mistyped link password does not use it up. Reloading unfinished onboarding requires signing in again.

Abandoned sign-ups leave Google-only Supabase Auth users that no StoneDesk account references. List them with `node scripts/cleanupAuthUsers.js` (dry run) and delete them with `--apply`. It only selects unlinked, Google-only users older than 24 hours.

Deploy the backend and frontend together: an older frontend sends `googleAccessToken`, which the backend no longer accepts, so a Google onboarding in progress during the deploy must be restarted.

Verify: existing email/password login; first Google link with wrong then correct password; repeat Google login; new Google account joining a workspace; paused account rejection; cancellation; callback replay rejection. A real Google consent interaction must be completed by the account owner.
