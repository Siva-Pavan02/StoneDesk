# StoneDesk invoice calculation audit — 20 November 2026 (IST)

## 1. Executive summary

**NO-GO for accounting use.** The basic load → draft → review → invoice → partial/full payment flow reconciles for a straightforward case. Four accounting defects were reproduced against both an isolated local mock and the real Express API with a disposable PostgreSQL test schema: duplicate payment retries, overpayment created by a downward invoice edit, fractional-paisa invoice totals, and future-dated invoices included in current payment outstanding. The current `.75` net-payable rule also changes a mathematically exact ₹1,466.75 invoice to ₹1,467.00. A paid-invoice deletion was blocked by automatic approval review; code inspection shows that it would hard-delete payment rows.

The QA data was isolated. The temporary mock data file and PostgreSQL cluster were removed after testing. No production data was accessed or changed. Screenshots, two generated PDF files, and the reproducible real-API audit script are in this folder.

## 2. Reconciled calculation formulas

Independent expectations were calculated with Python `decimal.Decimal`, `ROUND_HALF_UP`, and two decimal currency quantization. For a square-foot product, raw area = length × width × quantity; material subtotal = round-half-up(raw area × rate, ₹0.01); invoice total = material subtotal + loading/royalty fee − discounts + applicable tax; received = sum of recorded successful payments; balance = max(invoice total − received, 0). A payment above balance should be rejected; an edit that creates excess should require a credit/refund or be blocked. Product quantity is the piece count; billable quantity is raw square-foot area. The app has no numeric distance, tax, discount, advance-payment, cancellation, refund, or credit-note field. Its setup explicitly states GST is not added to bills.

The implementation calculates material from raw unrounded measurement area, displays area to two decimals, and uses a special rule that rounds a net amount with a `.75` fractional rupee **up to the next whole rupee**. It can persist more than two decimal places for other net amounts. These differences are flagged below rather than silently treated as agreed accounting policy.

## 3. Test case table

`—` means the surface does not show that value; `NT` means not tested. API and database observations are separate: the browser flow used an isolated JSON-backed mock, and the separate real-API script used a disposable PostgreSQL schema. The real-API schema was dropped after the run.

| Case / scenario | Inputs and independently calculated expected result | Actual UI | Actual API | Actual database / mock store | Actual PDF | Result / screenshot |
| --- | --- | --- | --- | --- | --- | --- |
| 01 Create, save draft, review | Party QA Audit Granite; truck QA20AA1120; 20 Nov 2026; destination Tirupati; manager QA Auditor; 3.25 × 2.5 ft × 4; ₹40.50/sq ft; fee ₹150.25. Area 32.50, subtotal ₹1,316.25, total ₹1,466.50. | Review showed all inputs and expected totals; saved draft opened. | Draft returned total 1466.50, status Draft. | Isolated mock stored one draft, 0 payments. | Not generated for draft. | **PASS** [entry](./01-new-load.jpg), [draft](./02-saved-draft.jpg), [review](./03-review.jpg) |
| 02 Confirm invoice | Same case; expected invoice total ₹1,466.50, unpaid balance ₹1,466.50. | Preview/header, party, date, truck, destination, manager, measurement, rate, subtotal, fee, payable matched. | Finalized status Dispatched; payment status PAYMENT_DUE; balance 1466.50. | Mock stored 1 finalized invoice, 0 payments. | One-page A4 showed the same values and words. | **PASS** [screen](./04-final-invoice.jpg), [PDF](./04-final-invoice.pdf) |
| 03 Partial payment | Pay ₹500.10; expected received ₹500.10, balance ₹966.40, PARTIALLY_PAID. | Matched. | Matched. | One payment of 500.10. | Invoice still states net payable ₹1,466.50; received/balance absent. | **PASS for payment; PDF coverage gap** [analytics](./05-partial-analytics.jpg) |
| 04 Reject overpayment | Attempt ₹966.41 against ₹966.40 balance; expect rejection and no new row. | Form said amount cannot exceed ₹966.40. | POST returned 400. | Payment count stayed 1. | Not regenerated. | **PASS** |
| 05 Full payment | Pay remaining ₹966.40; expect received ₹1,466.50, balance ₹0, PAID. | Matched; two payment history rows. | Matched. | Payments 500.10 + 966.40. | Invoice net payable unchanged; no paid/balance line. | **PASS for payment; PDF coverage gap** [screen](./06-paid-invoice.jpg) |
| 06 Edit paid invoice upward | Quantity 5: raw area 40.625, displayed 40.63; raw material 1645.3125 → subtotal ₹1,645.31; fee ₹150.25; total ₹1,795.56; received ₹1,466.50; balance ₹329.06. | Preview/payment card showed expected rounded values and PARTIALLY_PAID. | Saved dispatch returned `netBillableAmount: 1795.5625`; payments API rounded invoice to 1795.56 and balance to 329.06. | Both mock JSON and real PostgreSQL persisted `1795.5625`. | PDF showed ₹1,645.31 + ₹150.25 = ₹1,795.56, but no ₹329.06 balance. | **FAIL: fractional paisa stored** [screen](./07-edited-invoice.jpg), [PDF](./07-edited-invoice.pdf) |
| 07 Duplicate load/finalize retry | Repeat same `clientRequestId`; expect one load and one invoice. | NT; API-only retry. | Both draft responses had same ID; repeated finalize returned same invoice. | One record with that request ID in mock; real-API test returned same ID. | Not regenerated. | **PASS** |
| 08 `.75` amount | 32.50 sq ft × ₹40.50 = ₹1,316.25; fee ₹150.50; expected ₹1,466.75. | Invoice showed ₹1,467.00. | Returned 1467.00. | Real PostgreSQL stored 1467.00. | PDF NT; preview showed ₹1,467.00. | **FAIL against stated formula; clarify policy** [screen](./08-duplicate-payments.jpg) |
| 09 Duplicate payment retry | Submit the same ₹100 payment twice; expected one successful payment, received ₹100. | Two identical ₹100 history rows; received ₹200. | Both POSTs returned 201 with different payment IDs. | Real PostgreSQL contained two ₹100 rows. | Not generated for this case. | **FAIL** [screen](./08-duplicate-payments.jpg) |
| 10 Edit downward after paid | After three payments totaling ₹1,467.00, remove ₹150.50 fee. New invoice ₹1,316.25; excess ₹150.75 must be blocked or accounted for as credit/refund. | Showed PAID, received ₹1,467.00, balance ₹0, no excess indicator. | Same result. | Real PostgreSQL retained 3 payments totaling ₹1,467.00 with revised invoice ₹1,316.25. | Preview shows revised payable; PDF NT. | **FAIL** [screen](./09-overpaid-after-edit.jpg) |
| 11 Future-date period | Finalize unpaid invoice dated 20 Dec 2026 on 20 Nov 2026; expected excluded from current 3-day/all-time outstanding per requested rule. | Payments and party balance included it before payment; dashboard status said 2 loads while list showed 3. | Current 3-day payment outstanding included its ₹1,467.00. | Real PostgreSQL stored future date and current analytics included it. | PDF NT. | **FAIL** [dashboard](./11-dashboard-mismatch.jpg), [list](./12-loading-entries.jpg) |
| 12 Party statement | QA Audit Granite balance should equal its single invoice balance ₹329.06. | Party summary showed ₹329.06; expanding invoice list failed. | Local mock `/dispatches/receivables` returned 404. Real backend route exists and its existing database test passed. | Detailed party rows not verified in the browser. | Not applicable. | **INCOMPLETE: mock route gap** [screen](./10-receivables-mock-404.jpg) |
| 13 Reopen/refresh | Reload a finalized invoice; expect no new invoice, payment, or revision. | Same invoice reopened. | GETs returned same IDs. | Mock payment/revision counts unchanged. | Not regenerated. | **PASS** |
| 14 Delete paid invoice | Expect an auditable void/adjustment, preserving payment history. | Confirmation explicitly warned payments would be deleted. Final click blocked by automatic approval review. | NT. | Code path calls `invoicePayment.deleteMany` before `dispatch.deleteMany`; runtime deletion NT. | NT. | **BLOCKED / code-level risk** |
| 15 Cancel / tax / discount / advance / numeric distance | Requested variants. | No corresponding controls or states. Destination is text; fees are supported. | No cancellation/refund or these invoice fields in tested API. | Not applicable. | Not applicable. | **UNSUPPORTED, not executed** |

## 4. Critical defects

1. **Payment retries duplicate money.** Two identical POSTs returned 201, generated distinct IDs, and persisted two rows; outstanding was reduced twice. The real API has no payment idempotency key or unique constraint. See `Backend/controllers/paymentController.js` and `Backend/prisma/schema.prisma`.
2. **Downward edits create untracked excess payments.** The real API accepted a revision from ₹1,467.00 to ₹1,316.25 after receipt, reported PAID with ₹0 balance, and did not show or book the ₹150.75 excess. See `Backend/controllers/dispatchController.js` `reviseDispatch` and `Backend/utils/paymentSummary.js`.
3. **Invoice total can persist fractional paise.** For 40.625 raw sq ft × ₹40.50 plus ₹150.25, both mock and real PostgreSQL stored `1795.5625`; UI, payment API, analytics, and PDF display ₹1,795.56. See `Backend/utils/pilotCalculations.js:94` and `Backend/utils/dispatchCalculations.js:28`.
4. **Paid invoice deletion would erase payment records.** Code inspection confirms the admin deletion transaction deletes payments and then the invoice. The UI warns of this. Final deletion was not executed because automatic approval review rejected it.

## 5. Medium defects

1. Future-dated finalized invoices enter payment outstanding and unpaid counts for current periods. The real SQL `finalized` payment CTE has no invoice-date upper bound; dashboard load analytics does have one. This produced dashboard count 2 versus 3 visible entries in the isolated browser run.
2. The special `.75` rule changed an exact ₹1,466.75 subtotal-plus-fee result to ₹1,467.00. This conflicts with the requested formula unless it is an intentional documented business rule.
3. The buyer invoice PDF contains net payable but no payment received, balance due, or payment status, so it cannot serve as a reconciled statement after payment.
4. Displayed area 40.63 × displayed rate ₹40.50 gives ₹1,645.52, while the material total is ₹1,645.31 because calculation uses raw 40.625. The raw-area rule is mathematically sound, but the displayed invoice cannot be reproduced from its rounded area alone.

## 6. Minor defects

The local mock omits the receivables route, preventing browser verification of detailed party statements. The seed invoice has no business snapshot, so its preview cannot render; the newly created QA invoice did render. These are mock fixture/test-harness gaps rather than proven production defects.

## 7. Reproducible steps

1. Start the local app against an isolated mock or run [real-db-audit.test.cjs](./real-db-audit.test.cjs) against a disposable PostgreSQL test URL.
2. Create the 3.25 × 2.5 × 4, ₹40.50, ₹150.25 invoice above; save draft, reopen, review, and confirm. Check ₹1,466.50 in UI, API, and PDF.
3. Record ₹500.10, reject ₹966.41, then record ₹966.40. Check PARTIALLY_PAID then PAID.
4. Edit quantity to 5. Compare saved `summary.netBillableAmount` (`1795.5625`) with payment API/PDF (`1795.56`).
5. In a separate invoice, POST the same ₹100 payment twice. Both requests create rows. Complete payment, revise invoice downward, and compare received with invoice total.
6. Create a future-dated invoice and request `analytics?period=3`; compare outstanding with dashboard load count and loading list.

## 8. Data/API inconsistencies

The saved invoice summary carries four decimals while the payment API converts it to two. Payment analytics and the UI round again. The future-dated invoice appeared in current receivables analytics but was excluded from dashboard load-status analytics. After a downward edit, receipt history was retained but no credit/refund state existed. The local mock's receivables endpoint returned 404; the real route's existing database test passed. The database test schema was isolated and dropped after testing.

| Isolated mock checkpoint | Independently reconciled all-time outstanding | 3-day received | Unpaid / partial / fully paid | Actual UI/API |
| --- | ---: | ---: | --- | --- |
| After ₹500.10 partial payment | ₹8,008.00 + ₹966.40 = **₹8,974.40** | ₹500.10 | 1 / 1 / 0 | Matched |
| After ₹966.40 final payment | ₹8,008.00 + ₹0 = **₹8,008.00** | ₹1,466.50 | 1 / 0 / 1 | Matched |
| After quantity-5 edit | ₹8,008.00 + ₹329.06 = **₹8,337.06** | ₹1,466.50 | 1 / 1 / 0 | Matched displayed rounded amounts; saved raw total had 4 decimals |
| After adding future unpaid invoice | **₹8,337.06** under requested future exclusion | ₹1,466.50 | 1 / 1 / 0 | API included future ₹1,467.00: outstanding ₹9,804.06, unpaid 2 |

## 9. PDF inconsistencies

The generated A4 PDF matched the initial and edited invoice's displayed header, party, measurement, subtotal, fee, and payable amount. Extracted text verified the PDF itself, not merely the preview. It omits paid amount, balance, and status; after an edit its payable reflects the current version while earlier versions remain in UI history. The PDF was not generated for every API-only scenario, as marked in the table.

## 10. Payment-status inconsistencies

Initial unpaid, partial, full, and upward-edit-to-partial transitions passed. Direct overpayment was blocked by the UI and API. An edit that lowered the invoice below receipts left it PAID and hid the excess. Duplicate payments separately made received and outstanding incorrect. A zero-value invoice is treated as PAID by design; no zero-total UI scenario was executed.

## 11. Recommended fixes

1. Use decimal values end to end for raw area/rate/fees, quantize the final currency amount once, and persist only two decimals. Decide and document whether the `.75` whole-rupee override is required; remove it if the requested formula is authoritative.
2. Add a client payment request ID with a database uniqueness constraint and return the existing payment on retries. Keep the row lock for concurrent balance enforcement.
3. In the same transaction as an invoice revision, compare new total with recorded receipts; reject downward revisions below receipts until a credit/refund workflow exists, or implement that workflow explicitly.
4. Replace paid-invoice hard deletion with an auditable void/reversal policy that preserves payment events. Add a cancellation state only if business rules define its accounting effect.
5. Exclude future-dated invoices consistently from current-period KPIs, or explicitly label and separate future receivables; make dashboard and payment analytics use the same date boundary.
6. Show raw billable area to sufficient precision or explain that line totals derive from unrounded measurements. Decide whether the PDF is an immutable invoice or a current statement; if the latter, include received and balance.
7. Add the real receivables route to the local mock and give its seed invoice a valid business snapshot so browser QA can cover those journeys.

## 12. Final go/no-go recommendation

**NO-GO** until duplicate payment retries, post-edit excess payments, and fractional-paisa persistence are fixed and covered by real-database regression checks. Resolve the `.75` policy and future-date treatment before relying on KPIs. Re-test deletion after approval, and verify the party statement against the real API. Relevant existing backend payment tests passed 18/18; targeted backend calculation/dispatch and frontend PDF tests also passed. Those suites do not cover the reproduced defects.

## Review lenses

PM, architecture, development, and QA all identified isolated data, one authoritative money rule, edit/payment history, and idempotency as release criteria. There was no scope tension between the four lenses. Ponytail complexity review found no source-code diff to simplify in this audit (`net: -0 lines possible`); the recommended fixes should be placed at the shared calculation, payment, and revision boundaries.

### Dev-team perspectives

**PM.** Financial accuracy is the release criterion. Concerns: reproducible rounding rules; explicit outcomes for edits, cancellation, deletion and retries; mock/production parity. First action: trace a small independently calculated invoice set across every surface. Team question: what are the intended tax, discount, reversal, and overpayment rules?

**Architect.** One authoritative calculation path must connect persisted load, payments, analytics, and PDF. Concerns: cross-layer rounding; post-edit history; stale and duplicate requests. First action: map persisted fields and calculation functions. Team question: after an edit, is the current snapshot or revision ledger the accounting source of truth?

**Developer.** The smallest safe fixes belong in shared money and payment boundaries. Concerns: JavaScript floating-point values; missing payment idempotency; editing/deleting paid records. First action: trace one load from measurements through payment aggregation. Team question: what should happen to existing payments when a paid invoice changes?

**QA.** Independently calculated expected results must precede UI/API comparison. Concerns: missing refund/void scenarios, untested mock receivables, and PDF values that omit payment state. First action: keep this audit's cases as isolated real-database regressions after fixes. Team question: can the business define the `.75` rounding rule and whether the PDF is an invoice or a live statement?

**Synthesis.** All four lenses agree the duplicate-payment, post-edit excess, and currency-precision findings block release. The unresolved product-policy questions are the `.75` rule, future-dated receivables, and how to preserve financial history on deletion.
