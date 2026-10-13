# Technical Architecture

StoneDesk is a multi-tenant web app: a React + Vite single-page client talks to an Express 5 API, which stores data in Supabase PostgreSQL through Prisma. Each business (organization) is isolated by `organizationId`.

## 1. Directory Structure

```text
StoneDesk/
  Backend/                      Node.js + Express 5 API
    app.js                      Express app: middleware pipeline, route mounting, error handler
    server.js                   Listener and process lifecycle only (local/Render startup)
    controllers/
      dispatchController.js     Loads (dispatches): drafts, finalize, status, list, analytics
      loadingListController.js  Loading requirement lists
      masterSettingsController.js
    routes/
      authRoutes.js             Signup, login, Google sign-in, users, password reset, account delete
      dispatchRoutes.js
      loadingListRoutes.js
      masterSettingsRoutes.js   Business profile, logo, trucks, destinations, stone rates, royalty
    utils/
      auth.js                   Sessions, scrypt hashing, requireSession / requireActive / allowRoles
      googleAuth.js             Supabase PKCE exchange for Google sign-in
      pilotCalculations.js      Server-side measurement validation and bill totals
      dispatchCalculations.js   Legacy piece-based totals
      dispatchAnalytics.js      30-day dashboard analytics (IST)
      organizationCode.js       Shareable organization code generator
      businessBranding.js       Logo upload storage (sharp), business snapshot
      requireOrganizationLogo.js  Restricts /uploads to the caller's own logo
      rateLimiter.js            Upstash Redis sliding window, in-memory fallback
      securityHeaders.js        CSP and security headers
      auditLog.js, email.js, errorHandler.js, prisma.js
    prisma/
      schema.prisma             Data model
      MIGRATION.md              Migration notes
    scripts/
      checkDatabase.js          npm run db:check
      protectDatabase.js        Enables RLS and revokes anon access
      addGoogleIdentity.js, repairOrganizationSettings.js, e2ePreview.js
    mock/                       Mock API server (npm run mock) and fixture data
    tests/                      node:test suites (auth, dispatch, multiTenancy, securityBoundary, ...)
  Frontend/                     React 19 + Vite 8 + Tailwind CSS 4 + daisyUI 5
    index.html
    vite.config.js              Dev proxy /api -> http://localhost:5000
    securityPolicy.js           Generates the Content Security Policy
    scripts/generateA4InvoiceSample.mjs   npm run invoice:sample
    public/                     Favicon, icons, fonts, sample invoice
    src/
      main.jsx                  Mounts App inside LanguageProvider (en / te)
      App.jsx                   Checks /auth/session, renders LandingPage or PilotApp
      index.css                 Design tokens and shared controls
      styles/                   workspace.css, landing.css, invoice.css, a4Invoice.css
      components/
        pilot/                  Active application (see section 5)
        LoadingListScreen.jsx   Loading requirements screen (lazy loaded at #requirements)
        SettingsScreen.jsx      Saved trucks and destinations (lazy loaded at #references)
        DispatchTracker.jsx, DispatchHistory.jsx, LanguageToggle.jsx   Legacy, not imported by the app
        dispatch/               Legacy dispatch form parts; FractionChips is still used by LoadingListScreen
      i18n/                     LanguageContext, translations, pilotMessages
      lib/
        pilotApi.js             Fetch wrapper used by the pilot app
        api.js, loadingListApi.js   Clients used by LoadingListScreen / SettingsScreen
        googleSignIn.js         Google PKCE redirect helpers
      utils/                    Calculations, drafts and document exports (see section 6)
    tests/                      node:test suites (invoice exports, calculation parity, CSP, ...)
  docs/                         PRD, architecture, workflows, design and UX notes
```

## 2. Runtime and Request Pipeline

`Backend/app.js` applies middleware in this order:

1. Security headers (`utils/securityHeaders.js`).
2. Origin check: any request with an `Origin` header not allowed by `auth.allowedOrigin` (based on `APP_ORIGIN`, required in production) gets 403.
3. `cors({ origin: true, credentials: true })`.
4. `express.json` with a 100 kb body limit.
5. `/api` router: rejects JSON bodies that are not objects, sets `Cache-Control: no-store`, then mounts:
   - `/api/auth` (public and session routes)
   - `/api/master-settings/:quarryId` (session + active user)
   - `/api/dispatches` (session + active user)
   - `/api/loading-lists` (session + active user)
6. `/uploads`: session + active user + own-organization logo check, then static files from `UPLOAD_DIR`.
7. When `SERVE_FRONTEND=true`, serves `Frontend/dist` with an SPA fallback.
8. Central error handler (`utils/errorHandler.js`).

Default port is `5000`. In development, Vite (port 5173) proxies `/api` to the backend.

## 3. Data Model (Prisma / PostgreSQL)

| Model | Purpose | Key fields |
| --- | --- | --- |
| `MasterSettings` | Tenant root (organization) | `id` (UUID), `organizationId` (unique shareable code), `businessName`, `address`, `phone`, `gstNumber`, `tradeLicense`, `logoPath`, `savedTrucks[]`, `savedDestinations[]`, `stoneRates` (JSON), `defaultRoyaltyFee`, `version` |
| `User` | Member of one organization | `organizationId` -> `MasterSettings.id`, `email` (unique), `supabaseUserId` (unique, optional, Google link), `role` (`Admin`, `YardManager`, `Dispatcher`), `active` |
| `Session` | Cookie session | `tokenHash`, `expiresAt` |
| `PasswordResetToken` | Password reset | Single use, expires after 1 hour |
| `Dispatch` | A truck load and its bill | `dispatchSlipNumber` (unique per org), `clientRequestId` (unique idempotency key), `status` (`Draft`, `Dispatched`, `Delivered`), `partyName`, `logistics`, `inventory`, `summary`, `businessSnapshot` (JSON) |
| `LoadingList` | Size requirements to load | `loadingListNumber` (unique per org), `supervisor`, `buyerDestination`, `stoneType`, `finish`, `requirements` (JSON), `status` (`Draft`, `Loading`, `Completed`) |
| `AuditLog` | Security and business audit trail | `organizationId`, `userId`, `action`, timestamp (indexed, no foreign keys) |

Every query on tenant data is scoped by the caller's `organizationId`.

## 4. Security

- **Sessions:** `stonedesk_session` cookie, `httpOnly`, `SameSite=Strict`, 12 hours. Only a hash of the token is stored.
- **Passwords:** scrypt (N=32768). 12 to 128 characters with a zxcvbn score of at least 3.
- **Rate limiting:** 20 requests per 15 minutes on auth endpoints (Upstash Redis; in-memory fallback locally).
- **Authorization:** `requireSession`, `requireActive` (paused users get 403 on workspace APIs) and `allowRoles(...)`.
- **Google sign-in:** Supabase PKCE exchange; linking an existing account requires the StoneDesk password. See [google-sign-in.md](google-sign-in.md).
- **Database:** `scripts/protectDatabase.js` enables row level security and revokes anonymous access on Supabase.
- **Browser:** CSP generated by `Frontend/securityPolicy.js`; security headers on API and static responses.

## 5. Frontend Application

`App.jsx` calls `/api/auth/session`. Signed-out users see `pilot/LandingPage.jsx` with `pilot/AuthDialog.jsx`; signed-in users get `pilot/PilotApp.jsx`, which uses hash routing:

| Hash | Screen | Notes |
| --- | --- | --- |
| `#home` | `LoadHub` + `DashboardAnalytics` | Dashboard with 30-day analytics |
| `#entries` | `LoadHub` | Load list, `?status=` filter, cursor pagination |
| `#load` | `NewLoad` + `MeasurementEntry` + `LoadSummary` | Create or edit a draft load |
| `#bill/:id` | `BillView` | Bill preview, finalize, PDF/Excel/share |
| `#products` | `ProductSettings` | Admin only; stone rates and royalty |
| `#profile` | `BusinessSetup` | Admin only; business profile and logo |
| `#references` | `SettingsScreen` | Admin only; saved trucks and destinations |
| `#requirements` | `LoadingListScreen` | Loading requirement lists |
| `#settings/...` | `AccountSettings` | Account, team members, password, delete |

`WorkspaceShell.jsx` provides the header, drawer and bottom navigation. Until the business has a name and at least one stone rate, the app redirects to setup (`#profile`, then `#products`). Unsaved load drafts are kept in `localStorage` (`utils/pilotDraft.js`) and offered for recovery.

## 6. Calculations and Documents

- **Server authority:** `Backend/utils/pilotCalculations.js` validates every measurement row and computes totals. Area per row is L x W x quantity; values are summed unrounded and rounded half-up to 2 decimals once.
- **Client parity:** `Frontend/src/utils/loadMath.js`, `billData.js` and `fractionParser.js` mirror the server math for live previews; `tests/calculationParity.test.js` guards parity.
- **Exports:** `pilotExports.js` (buyer PDF, buyer Excel, driver PDF via `ledgerPdf.js` and SheetJS), `a4InvoiceModel.js` / `a4InvoicePagination.js` / `a4InvoiceRender.js` (printable A4 invoice), `generateLoadingListPdf.js` / `generateLoadingListExcel.js`, and `shareFiles.js` (Web Share API).

## 7. Configuration

| Area | Variables |
| --- | --- |
| Backend server | `PORT`, `NODE_ENV`, `APP_ORIGIN`, `TRUST_PROXY`, `SERVE_FRONTEND`, `UPLOAD_DIR` |
| Database | `DATABASE_URL` (session pooler), `DIRECT_URL`, `TEST_DATABASE_URL`, `TEST_DIRECT_URL` |
| Google sign-in | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` |
| Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Frontend | `VITE_API_BASE_URL` (default `/api`) |

## 8. Testing

- Backend: `npm test` runs `node --test --test-concurrency=1 tests/*.test.js` against `TEST_DATABASE_URL`.
- Frontend: `node --test` suites in `Frontend/tests` and `Frontend/src/utils/*.test.js`; `npm run lint` runs oxlint.

See [DESIGN.md](DESIGN.md) for the design system and [BUSINESS-WORKFLOWS.md](BUSINESS-WORKFLOWS.md) for business flows.
