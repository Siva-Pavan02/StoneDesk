# Database efficiency review

Target: ui-ux at 3883840, with pre-existing frontend changes preserved.
Scope: request-time Prisma calls in Backend controllers, routes and middleware. No database/schema, environment, infrastructure, financial logic or API contract changes.

## A — confirmed, fixed

- Session discovery and authenticated middleware fetched all 12 User scalar fields plus Session metadata. Select only the 8 user fields consumed by authorization, publicUser and linked-account deletion. Password hashes/salts and user timestamps are no longer fetched on this path; no session scalar fields are returned to application code. Prisma may still select internal relation keys. Query count unchanged.
- GET /auth/users fetched all 12 User scalar fields and discarded four while formatting the response. Select the same 8 required fields. Ordering, tenant scope, full list and response shape unchanged. Query count unchanged.
- Signup's duplicate-email existence check fetched the complete User row. Select id only (12 fields to 1). Same conflict response and query count.

These are structural reductions, not measured latency or SQL-byte benchmarks. No N+1 loop was found in the inspected request handlers. Relation includes do not by themselves establish N+1 behavior.

## Access map and bounds

- Auth: indexed unique email/provider identity/token lookups; a fresh session/user read per authenticated request. Password verification still fetches credentials on its own paths. No cross-request auth cache added.
- Staff list: intentionally remains a complete organization-scoped list; no pagination in current API. Silently capping it would hide members.
- Invitations: active list capped at 50; redemption uses conditional claim and user creation in one transaction.
- Dispatch: summary-only list capped at 50 + one sentinel; date-window analytics capped at 20,000 + one sentinel. Detail/write responses intentionally include full inventory and revision history. Draft/finalize/revise/status writes retain optimistic concurrency predicates.
- Loading lists: bounded summary queries with cursor validation; detail/update reads need requirements for current contracts.
- Settings: single-organization reads; mutation retries remain version guarded. Saved references avoid writes for existing values and retry at most three times.
- Payments: full history intentionally retained because existing responses return all payments and calculate balances over them. Payment creation retains tenant-scoped FOR UPDATE, balance check and insert in the same transaction. No aggregation/rounding rewrite.
- Audit logs: one insert per audited event; errors/warnings are failure diagnostics, not verbose success/query logging. No logging removed.
- Connections: one CommonJS Prisma instance; Express import has no eager connect/listen; long-lived server connects once and disconnects on shutdown. No per-request connect/disconnect.

## B — deferred, requires evidence or contract decision

- Case-insensitive substring search (including JSON logistics): inspect realistic EXPLAIN plans before adding trigram/expression indexes.
- List sorting: existing organization/date and organization/status/createdAt indexes cover specific paths, but unfiltered createdAt listing and loading-list sort may benefit from different indexes. Need cardinality, plans, and write-cost evidence; no indexes added or removed.
- Large staff/payment histories and growing revision JSON: need usage metrics and explicit pagination/history contract design. No silent truncation.
- Analytics aggregation: bounded already; SQL aggregation would need parity evidence for Kolkata boundaries, malformed summaries and rounding.
- Settings version rereads and parallel dispatch/settings lookups: eliminating reads can alter concurrency timing or trade new-save latency for replay efficiency. No speculative rewrite.
- Local DATABASE_URL uses port 6543 and pgbouncer=true, but does not have an explicitly verified 1–2 connection limit. Size the per-instance pool against the deployment concurrency and provider connection budget; deployed environment not inspected or changed.
- Real payment concurrency and query-plan performance require a disposable database; local test database port refused connections.

## C — not introduced

Cross-request authorization caches, denormalized financial totals, blanket indexes, Prisma upgrades, and pool tuning without capacity evidence.

## Verification

- Prisma validate: PASS.
- All DB-free backend suites: 96 passed, including 3 new projection regressions.
- Relevant frontend auth/Google/request-dedup/role tests: 25 passed.
- Frontend production build: PASS with the existing user edits.
- npm test: SKIPPED — test database unavailable (local ECONNREFUSED). No live database tests or writes performed.
- Production latency, actual SQL query count/bytes, index plans and financial concurrency: NOT VERIFIED.
