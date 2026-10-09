# Google sign-in

1. Enable Google in Supabase Authentication → Sign In / Providers.
2. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `Backend/.env`. Use a publishable key, never a service-role key. Restart the backend after editing.
3. In Supabase Authentication → URL Configuration, set Site URL to your website origin. Add `http://localhost:5173/?google_callback=*` to Redirect URLs for local development. If using a different port/origin, add its equivalent. Add `https://YOUR-DOMAIN/?google_callback=*` when deploying. Do not use a wildcard hostname.
4. Keep Google's authorized redirect URI set to `https://kwxjvtmmjljzdrjjdfoo.supabase.co/auth/v1/callback`.
5. Apply the nullable unique `User.supabaseUserId` field from the Prisma schema before starting the updated backend. Existing rows remain unchanged.

The browser creates a PKCE verifier and per-attempt state in sessionStorage. The backend exchanges the code and validates the Google identity against Supabase's Auth API. Existing accounts require their StoneDesk password once to link Google; subsequent sign-ins use the stable Supabase user ID. New accounts choose create/join organization, using the existing role rules. Application sessions remain HttpOnly cookies. OAuth tokens are held only in memory during onboarding, and no Google refresh tokens are persisted. Reloading unfinished OAuth onboarding requires signing in again.

Verify: existing email/password login; first Google link with wrong then correct password; repeat Google login; new Google account joining a workspace; paused account rejection; cancellation; callback replay rejection. A real Google consent interaction must be completed by the account owner.
