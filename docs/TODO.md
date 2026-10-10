# StoneDesk Development Roadmap

## Phase 1: Environment Setup (Completed)
- [x] Initialize Node/Express backend (`Backend/`).
- [x] Initialize Vite/React frontend (`Frontend/`).
- [x] Configure Tailwind CSS v4 and daisyUI 5.
- [x] Connect Supabase PostgreSQL through Prisma.

## Phase 2: Backend API and Database (Completed)
- [x] Prisma models: `MasterSettings`, `User`, `Session`, `PasswordResetToken`, `Dispatch`, `LoadingList`, `AuditLog`.
- [x] Master settings API `/api/master-settings/:quarryId` (profile, logo, trucks, destinations, stone rates, royalty).
- [x] Dispatch API `/api/dispatches` (draft, update, finalize, delivery status, cursor list, analytics, slip lookup).
- [x] Loading list API `/api/loading-lists`.
- [x] Server-side calculation and validation (`utils/pilotCalculations.js`).

## Phase 3: Accounts, Organizations and Security (Completed)
- [x] Email/password signup and login with cookie sessions.
- [x] Create or join an organization by shareable code; roles Admin, Yard Manager, Dispatcher.
- [x] Team management: change role, pause access.
- [x] Google sign-in through Supabase PKCE with password-confirmed linking.
- [x] Password reset by email; account and organization deletion.
- [x] Rate limiting, CSP and security headers, origin check, audit log, RLS script.

## Phase 4: Frontend Workspace (Completed)
- [x] Landing page and sign-in dialog.
- [x] Business setup and products/rates onboarding.
- [x] Saved trucks and destinations screen.
- [x] New load with measurement entry, fractions, quantity and categories.
- [x] Load list, search, status filter and dashboard analytics.
- [x] Local draft recovery.
- [x] Loading requirements screen.
- [x] English and Telugu interface.

## Phase 5: Document Generation and Export (Completed)
- [x] Buyer invoice PDF and Excel (jsPDF, AutoTable, SheetJS).
- [x] Driver transit slip without prices.
- [x] Printable A4 invoice with pagination.
- [x] Loading list PDF and Excel.
- [x] Native sharing through the Web Share API.

## Phase 6: Open Items
- [ ] Remove or archive legacy components not used by the app: `DispatchTracker.jsx`, `DispatchHistory.jsx`, `LanguageToggle.jsx` and unused `components/dispatch/*` files (keep `FractionChips.jsx`, used by `LoadingListScreen.jsx`).
- [ ] Decide whether `lib/api.js` and `lib/loadingListApi.js` should move to `lib/pilotApi.js`.
- [ ] Bilingual English/Tamil headers for buyer exports (listed in the PRD, not implemented).
- [ ] Production deployment and environment documentation.
