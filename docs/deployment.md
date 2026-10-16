# Vercel frontend + free Render backend

Status: configuration prepared; not deployed.

## Prepare private logos

Set `SUPABASE_SECRET_KEY` only in Backend/.env and the Render backend environment. Run `node scripts/setupLogoStorage.js` from Backend. This creates a private `stonedesk-logos` bucket and copies/verifies existing PNG logos without deleting local originals. Only enable `LOGO_STORAGE=supabase` after setup succeeds. Existing finalized bills retain their embedded logos until the backfill.

New logos are stored as immutable objects at `org/<organizationId>/<sha256>.png`, and finalized bills store a small `businessSnapshot.logo` reference instead of the image bytes. The browser fetches `/uploads/logos/<sha256>.png` (session organization only) and embeds it when the bill opens. `setupLogoStorage.js` also copies and verifies local `org/` folders. Follow the rollout order in [Externalize invoice logos](../Backend/prisma/MIGRATION.md#externalize-invoice-logos-no-schema-change): frontend first, then backend, then backup, backfill (`scripts/externalizeSnapshotLogos.js`, dry run by default; `--apply` needs `LOGO_STORAGE=supabase`) and VACUUM. Once the backend is deployed, fix forward rather than rolling it back: an older backend rejects finalize for organizations that uploaded a logo since the deploy and cannot serve referenced logos, so those bills show the LOGO placeholder. The rollback notes in MIGRATION.md list the recovery steps. `configureVercel.mjs` leaves `/uploads/logos/*` browser-cacheable (private, immutable) but sets `CDN-Cache-Control: no-store`, so shared caches never store logos.

## Render

Use the repository-root render.yaml with GitHub Siva-Pavan02/StoneDesk. It creates one free Node backend in Singapore; no additional database or Redis is provisioned. Enter environment values marked `sync: false` through Render's secret fields. Set APP_ORIGIN to the final Vercel website origin. The backend binds to Render's PORT and exposes /healthz. Free services sleep when idle. Automatic deploys are disabled until the release is verified.

## Vercel

Use `Frontend` as the project root, Vite, `npm ci`, `npm run build`, and `dist`. Keep `VITE_API_BASE_URL=/api`. After Render assigns its real hostname, run `node scripts/configureVercel.mjs https://YOUR-SERVICE.onrender.com` from Frontend. Review and commit the generated vercel.json before deployment. It proxies API and protected logo requests to Render, sets security headers, disables API caching, and adds SPA fallback routing. Do not place database or storage secrets in Vercel frontend variables.

In Supabase Auth URL Configuration, add the final website origin as Site URL and `https://YOUR-WEBSITE/?google_callback=*` as an allowed redirect. Keep Google's redirect URI pointing to Supabase's /auth/v1/callback endpoint. Retain localhost redirects only while local development is needed.

## Release checks

Verify the chosen accounts/projects and source commit before publishing. Verify backend health, unauthenticated access rejection, login cookie persistence through the proxy, Google login, private logo upload/download, bill export, and logout. Open an old bill (embedded logo) and a new bill (referenced logo), and fetch `/uploads/logos/<sha256>.png` again after replacing the logo: the historical logo must still load. Check rate-limit client-IP behavior through both proxies. Vercel's _headers file is not used; the generated vercel.json carries the browser security headers.

Remaining external requirements: deployment account access, server-only storage key, actual service hostnames, and final Google login by the account owner. Vercel plan eligibility for business use must be satisfied; selecting Render's free plan does not change Vercel's plan terms.
