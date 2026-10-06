# GraniteSync

Mobile-first stone loading records, immutable bills, branded PDF/Excel exports, and price-free driver slips. One business workspace with an English/Telugu language switch.

## Run locally

Use Node.js 22.12 or newer and a running MongoDB instance. Run `npm ci` in both `server` and `client`.

Configure `server/.env` locally:

```dotenv
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/granitesync
APP_ORIGIN=http://localhost:5173
```

Run `npm run dev` in each directory. The client proxies `/api` and `/uploads` to port 5000. For other ports, set `API_PROXY_TARGET` on Vite and match `APP_ORIGIN` to the browser origin. Set `VITE_API_BASE_URL=/api` to use the same-origin proxy.

The first account becomes the business administrator. Subsequent sign-ups wait for administrator approval in Settings. Administrators manage products, branding, and staff; yard managers prepare drafts; dispatchers and administrators finalize loads and mark delivery. All approved staff access the same business records.

Passwords require 12–128 characters and use salted scrypt hashes. HttpOnly cookie sessions expire after 12 hours. Password changes revoke existing sessions. Google, phone OTP, email verification, and email password recovery are not configured.

## Daily workflow

1. Create the administrator account, enter business details, and add at least one product and rate.
2. Select **New Load**, enter party and vehicle details, then dimensions, quantities, Regular/TOP categories, and optional charges.
3. Review and save a draft or finalize. Finalized measurements, prices, totals, and branding are locked.
4. Reopen an invoice to share or download PDF, Excel, or the driver PDF. Sharing uses the device share sheet where supported, with download fallback.

Unfinished entry is kept on the current browser. Saving, finalizing, and generating bills require connectivity. Exports use stored values; historical bills remain independent of profile or product edits. Units are feet, square feet, and INR. GST details are profile information only; taxes, payments, inventory, and weight calculations are outside this pilot.

## Private hosting

Keep the pilot private. Use HTTPS and `NODE_ENV=production` with an explicit `APP_ORIGIN`. Serve client and API on the same origin. Production cookies require HTTPS. Persist and back up MongoDB and `server/uploads` together; `UPLOAD_DIR` can select another persistent directory. Do not commit credentials or environment files. Login throttling is process-local, suitable for a single server instance.

## Validation

```powershell
cd server
npm test
cd ../client
node --test tests/*.test.js src/utils/*.test.js
npm run lint
npm run build
```

Server integration tests require local MongoDB and use named test databases. Never point tests at business databases.

See [UX-SPEC.md](UX-SPEC.md) for journeys and screens and [DESIGN.md](DESIGN.md) for the mobile design system.
