# Product Requirements Document (PRD): StoneDesk

## 1. Product Overview
StoneDesk modernizes B2B granite supply chain logistics. It is a mobile-first, multi-tenant web app where quarry and yard businesses in Kadapa, India, log outgoing truck loads, calculate dimensional pricing, and share invoices and driver slips (for example via WhatsApp through native sharing).

## 2. Target Audience and Environment
* **Organization:** A stone business with its own profile, logo, rates and team. Data is isolated per organization.
* **Roles:**
  * **Admin:** creates the business, manages profile, products and rates, truck and destination suggestions, and team access.
  * **Dispatcher:** records, finalizes and delivers loads.
  * **Manager:** records load drafts and loading requirements and adds products; cannot finalize.
* **Suggestions:** truck numbers and destinations are remembered automatically from saved loads; there are no separate Trucks or Destinations pages.
* **Environment:** Outdoors, extreme sunlight, high screen glare, dusty hands.
* **Tech Literacy:** Low to moderate. Requires a zero-learning-curve, "fat-finger proof" interface.

## 3. Core Features
* **Accounts and teams:** Email/password or Google sign-in. Create a business or join one with its organization code. Admins change roles and pause access.
* **Business setup:** Profile (name, address, phone, GST, trade license), logo, products with stone type, finish and rate, and a default royalty / loading fee.
* **Rapid Measurement Ledger:** Rows of `Length` x `Width` x `Quantity` grouped by product, with Regular/TOP category. Square footage and amounts are calculated live and verified on the server.
* **Per-load rates:** Each product group carries its own rate per square foot, prefilled from the product's default rate.
* **Fraction Input:** Fraction entry for dimensions to avoid mobile keyboard decimal entry.
* **Load lifecycle:** Draft, Dispatched (finalized) and Delivered, with safe retries and protection against conflicting edits.
* **Dual Document Generation:**
  * **Driver Transit Slip:** PDF with vehicle details, destination and stone dimensions/pieces (prices hidden).
  * **Buyer Financial Invoice:** PDF, Excel and printable A4 invoice with dimensions, pricing and total payable amount.
* **Sharing:** One-tap sharing of generated files through the Web Share API (WhatsApp and other apps).
* **Loading requirements:** Lists of required sizes and quantities with loaded pieces and balance, exportable to PDF and Excel.
* **Dashboard:** Load list with search and status filter, plus 30-day analytics (status counts, daily totals, top destinations).
* **Draft recovery:** Unsaved load input is kept on the device and can be resumed.

## 4. Localization Strategy
* **Interface:** English only.
* **Buyer Exports:** Invoices for Tamil Nadu buyers should support English/Tamil bilingual headers (planned, not implemented).

## 5. Non-Functional Requirements
* Server is the authority for all financial calculations and permissions.
* Strong passwords, rate-limited auth, httpOnly session cookies and per-organization data isolation.
* Usable at 320px width, 48px touch targets, visible focus and reduced-motion support.
