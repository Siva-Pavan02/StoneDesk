# StoneDesk Development Roadmap

## Phase 1: Environment Setup (Completed)
- [x] Initialize Node/Express backend.
- [x] Initialize Vite/React frontend.
- [x] Configure Tailwind CSS v4.
- [x] Connect Supabase PostgreSQL database.

## Phase 2: Backend API & Database
- [ ] Implement `MasterSettings.js` schema.
- [ ] Implement `Dispatch.js` schema.
- [ ] Create `GET /api/settings` route to fetch defaults.
- [ ] Create `POST /api/settings` route to update defaults.
- [ ] Create `POST /api/dispatch` route to save final tally sheets.

## Phase 3: Frontend - Master Settings Page
- [ ] Build UI for `MasterSettings.jsx` (Manage Trucks, Destinations, Rates).
- [ ] Connect Settings UI to the `GET/POST /api/settings` endpoints.
- [ ] Wrap React app in a Context Provider to make settings available globally.

## Phase 4: Frontend - The Dispatch Form
- [ ] Build `LogisticsCard.jsx` (Auto-complete for Truck and Destination).
- [ ] Build `RapidEntryRow.jsx` (Length, Width inputs, + Add Piece button).
- [ ] Implement Quick Fraction Chips (`+ ¼`, `+ ½`, `+ ¾`) logic.
- [ ] Build `StoneLedger.jsx` (Running list of added pieces, subtotal calc).
- [ ] Build `StickyFooter.jsx` (Grand total, primary action buttons).

## Phase 5: Document Generation & Export
- [ ] Integrate `jspdf` and `jspdf-autotable` for PDF generation.
- [ ] Integrate `xlsx` for Excel ledger generation.
- [ ] Create "Driver Slip" export logic (Prices hidden).
- [ ] Create "Buyer Invoice" export logic (Full financials).
- [ ] Implement native Web Share API for the "Share to WhatsApp" button.
