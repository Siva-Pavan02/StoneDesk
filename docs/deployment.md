# Vercel frontend + free Render backend

Status: configuration prepared; not deployed.

## Prepare private logos

Set `SUPABASE_SECRET_KEY` only in Backend/.env and the Render backend environment. Run `node scripts/setupLogoStorage.js` from Backend. This creates a private `stonedesk-logos` bucket and copies/verifies existing PNG logos without deleting local originals. Only enable `LOGO_STORAGE=supabase` after setup succeeds. Existing finalized bills retain their embedded logos.

## Render

Use the repository-root render.yaml with GitHub Siva-Pavan02/StoneDesk. It creates one free Node backend in Singapore; no additional database or Redis is provisioned. Enter environment values marked `sync: false` through Render's secret fields. Set APP_ORIGIN to the final Vercel website origin. The backend binds to Render's PORT and exposes /healthz. Free services sleep when idle. Automatic deploys are disabled until the release is verified.

## Vercel

Use `Frontend` as the project root, Vite, `npm ci`, `npm run build`, and `dist`. Keep `VITE_API_BASE_URL=/api`. After Render assigns its real hostname, run `node scripts/configureVercel.mjs https://YOUR-SERVICE.onrender.com` from Frontend. Review and commit the generated vercel.json before deployment. It proxies API and protected logo requests to Render, sets security headers, disables API caching, and adds SPA fallback routing. Do not place database or storage secrets in Vercel frontend variables.

In Supabase Auth URL Configuration, add the final website origin as Site URL and `https://YOUR-WEBSITE/?google_callback=*` as an allowed redirect. Keep Google's redirect URI pointing to Supabase's /auth/v1/callback endpoint. Retain localhost redirects only while local development is needed.

## Release checks

Verify the chosen accounts/projects and source commit before publishing. Verify backend health, unauthenticated access rejection, login cookie persistence through the proxy, Google login, private logo upload/download, bill export, and logout. Check rate-limit client-IP behavior through both proxies. Vercel's _headers file is not used; the generated vercel.json carries the browser security headers.

Remaining external requirements: deployment account access, server-only storage key, actual service hostnames, and final Google login by the account owner. Vercel plan eligibility for business use must be satisfied; selecting Render's free plan does not change Vercel's plan terms.
