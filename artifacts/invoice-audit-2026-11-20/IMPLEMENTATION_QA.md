# Invoice accounting implementation QA — 21 November 2026

## Scope and result

The invoice money, payment idempotency, revision/delete locking, future-date analytics, and payment statement contracts in `IMPLEMENTATION_PLAN_REVISED.md` are implemented. No production database migration or deployment was performed.

## Reconciliation checked locally

For version-2 invoices, each row charge is rounded half up to paise from its exact area or unit quantity and rate. Rounded row charges are summed; the paise-normalized fee is then added. Received is the sum of recorded payments, balance is `max(total - received, 0)`, and excess is `max(received - total, 0)`. Version-1 stored invoices are not rewritten.

In the isolated localhost mock flow, an ₹8,008.00 invoice received one ₹100.25 payment. Invoice UI and statement API both showed received ₹100.25 and balance ₹7,907.75. The payment list contained one row. The statement response was HTTP 200; its PDF export button completed without an in-page error.

## Automated gates

| Gate | Result |
| --- | --- |
| Backend `npm test` | 219/219 passed |
| Frontend `npm test` | 250/250 passed |
| Frontend `npm run build` | Passed |
| `git diff --check` | Passed |
| Graphify update | Rebuilt successfully; code graph refreshed. SQL files were skipped because the optional `tree_sitter_sql` parser is absent. |

The backend integration tests use a disposable local PostgreSQL database and include idempotent replay, UUID conflicts, concurrent payment/revision behavior, tenant isolation, statement snapshot, malformed version-2 money, and read-only audit behavior.

## Browser QA on localhost

- [375 px payments](browser-qa-payments-375.png): two KPI columns on the first row and three on the second; no horizontal overflow.
- [768 px payments](browser-qa-payments-768.png): complete KPI labels and party balance visible; no horizontal overflow.
- [desktop payments](browser-qa-payments-desktop.png): all five KPIs visible in one row. Chrome rendered a 1,600 px viewport despite a 1,440 px request.
- Console errors: none on the payments page. Three observed API requests (`auth/session`, `master-settings`, `dispatches/analytics`) all returned 200.

No committed screenshot baseline exists, so visual regression is **inconclusive**. This pass did not collect Core Web Vitals or an axe-core accessibility result.

## Remaining release gates

1. Run the read-only legacy money audit against the intended database and review fractional legacy totals, excess payments, and incomplete revision events. Keep the output private.
2. Take a database backup, review and approve the additive SQL, apply it to the intended database, generate Prisma Client, and run `protectDatabase.js` before a coordinated backend/frontend deployment. Do not use `migrate deploy` on the unbaselined database.
3. Run the plan's 30-sample warmed analytics p95 comparison on a preview environment. The historical baseline cannot be recreated from the current checkout.
4. Perform a full preview browser pass with a visual baseline, Core Web Vitals, accessibility checks, and a real invoice/payment/PDF reconciliation against the preview database.

**Release verdict: DO NOT SHIP yet.** Local code gates are passing, but database rollout and preview validation remain required.
