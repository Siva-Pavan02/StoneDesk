# Single-business pilot

The default app now opens business setup, followed by products and rates and a mobile home screen. It has no login. The server binds to `127.0.0.1` by default; keep it on a private machine/network. Do not expose this pilot publicly without authentication. Setting `HOST` explicitly changes the server binding.

## Run locally (PowerShell)

Start MongoDB. In a terminal opened in `server`:

```powershell
npm install
$env:MONGODB_URI='mongodb://127.0.0.1:27017/granitesync'
npm start
```

In another terminal opened in `client`:

```powershell
npm install
$env:VITE_API_BASE_URL='/api'
npm run dev -- --host 127.0.0.1
```

Open the Vite URL. The development proxy forwards `/api` and `/uploads` to port 5000. Set `API_PROXY_TARGET` before starting Vite to use another backend. For a production build, set `VITE_API_BASE_URL` at build time and provide an equivalent private reverse proxy if using `/api`.

## Using the pilot

1. Save a business name and optionally an address, phone, and PNG/JPEG logo up to 2 MB.
2. Add at least one product, finish, and price per square foot. New settings have zero loading/royalty charges; existing settings retain their saved value.
3. Start New Load. Enter party, truck, date, destination, and supervisor. Enter length and width in feet (fractions supported), quantity, Regular/TOP, and rate. Use Add row for each size. TOP receives the same default product rate.
4. Review totals. Save draft to resume later, or finalize to lock financial values and business branding. Final bills provide PDF/Excel downloads and native sharing, plus driver slips without prices.

The phone keeps one incomplete load, including the measurement row being entered. Browser storage is a recovery copy, not a server backup. Successful saves clear that copy; saved drafts remain in recent loads. Final saving requires the server. Native file sharing requires a supporting mobile browser and secure context; use downloads otherwise. Sharing opens the phone's chooser, where the user selects WhatsApp.

## Data and compatibility

- Business fields extend the existing `MasterSettings` record at `unit_04`.
- Quantity rows extend `Dispatch.inventory` alongside legacy `pieces`. There is no mandatory backfill or rewrite of existing bills.
- The server recomputes row areas and amounts, group area/amount, piece counts, charges, and payable totals. Areas and money are rounded to two decimals; group amounts sum rounded row amounts.
- Draft creation accepts `clientRequestId` for retry-safe saves. Finalization is retry-safe and uses conditional updates so a concurrent draft save cannot alter a finalized bill.
- Finalization embeds a branding snapshot, including normalized PNG bytes. Editing/deleting a catalogue product or changing business branding does not change existing finalized bills.
- `/profile` and `/logo` extend `/api/master-settings/:quarryId`. Logo upload sends the raw image body with `Content-Type: image/png` or `image/jpeg`. Files are decoded, normalized, and stored under `server/uploads`, or `UPLOAD_DIR` if configured. Back up MongoDB and this persistent upload directory together.
- PDFs contain the frozen logo and business text. Excel workbooks contain frozen business text and numeric financial cells; the existing SheetJS writer does not embed logo images. New export headers are English; the mobile interface shows one selected language at a time. Use the header button to switch between English and Telugu; the choice is remembered on the device. Legacy localized exporters remain available.

## Validation

```powershell
# client
npm run build
npm run lint
node --test tests/*.test.js src/utils/*.test.js

# server (MongoDB must be running)
$env:NODE_ENV='test'
npm test
```

Server tests use dedicated `granitesync_test` and `granitesync_pilot_test` databases and must never target production data. The pilot integration test uses and removes a temporary logo directory. Tests run sequentially to avoid collisions in the existing shared test database.

Verified during implementation: 56 client tests and 39 server tests passed; production build succeeded. The new pilot components produce no lint warnings; existing components retain their prior warnings. Mobile setup, entry, draft resume, finalization, and failure/retry recovery were checked at 320px and 390px widths against the separate `granitesync_pilot_preview` database. Buyer/driver PDFs and a five-page buyer bill were rendered and inspected. Native WhatsApp sending was not performed; sharing availability depends on the phone/browser.
