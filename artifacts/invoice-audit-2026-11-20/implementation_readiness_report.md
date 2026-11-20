# Elephant Goldfish Model implementation readiness review

Target: `IMPLEMENTATION_PLAN.md` (initial draft). Reviewers: implementation readiness, codebase details, and style. All three ran with fresh conversation contexts and read their assigned persona, standard where applicable, target, and code context. No source code was changed during this review.

## Findings accepted for the revision

1. **Blocker — no exact write allowlist or checkpoints.** The draft identified subsystems but left file choices and intermediate verification to the implementer. Add a repository-relative file inventory and buildable phases.
2. **Major — version-2 money lacked enforcement details.** Define row and group totals for both `measurementRows` and legacy `pieces`, a concrete paise limit, accepted payment JSON type and cap, a shared validator, and error behavior on malformed stored data.
3. **Major — revision/deletion race behavior needed complete transaction boundaries.** Put organization lookup, row lock, stale check, status/role check, payment sum, update/delete, and revision metadata in one transaction. Remove the payment deletion branch.
4. **Major — future cash could disappear.** Current receipt CTEs join the same finalized invoice CTE as balances. Split all-finalized receipt scope from date-eligible invoice scope; filter the separate receivables endpoint too.
5. **Major — paid completion events were ambiguous.** Name issue/revision timestamp fields, define the version-2 event records and the version-1 reconstruction rule, state event tie order, defer early completion to invoice date, and report unprovable legacy events without inventing dates.
6. **Major — payment statement needed a full interface.** Define route, response, transaction snapshot, UI entry point, PDF generator, filename, error handling, and current-revision scope.
7. **Major — UI and helper dependencies were missing.** Include `paymentSummary.js`, deletion confirmation and error paths, all list/analytics/PDF readers, mock parity, and targeted tests.
8. **Minor — wording and gates.** State that amounts with fractional paise are rejected before formatting, name the measured request duration and p95 calculation, and group acceptance checks.

## Resolution

All findings above are accepted for the revised plan. The user already requested that the suggestions be incorporated, so the plan is being revised directly. A second pass will check that the accepted contracts appear in the final artifact.

## Second pass

The fresh implementation-readiness reviewer found three remaining gaps, all incorporated into `IMPLEMENTATION_PLAN_REVISED.md`:

1. Revision requires a client `updatedAt` token and must check it after locking the dispatch, then compare the new total with committed receipts and write the revision in the same transaction.
2. Deletion must block every payment-bearing invoice, including partially paid invoices and anomalous drafts; non-admin finalized deletions retain the existing `403` precedence.
3. The idempotency SQL must be safe after test `db push`: the Prisma field is native UUID, and the SQL uses idempotent column/index creation with a column-type check.
