---
description: "Use when editing StoneDesk Express routes, controllers, Prisma queries, auth or the mock API. Covers tenant scoping, error format, dispatch draft rules and mock parity."
applyTo: "Backend/**"
---
# StoneDesk backend conventions

## Tenant safety
- Every Prisma query is scoped by `organizationId: req.user.organizationId`. Look up records with `findFirst({ where: { id, organizationId } })`, never `findUnique({ where: { id } })` alone.
- Return 404 (not 403) for records in another organization.

## Responses and errors
- Errors are JSON `{ error: 'message' }`. Validation failures are 400, conflicts 409.
- Wrap handlers in `try { … } catch (err) { next(err); }` so `utils/errorHandler.js` formats unexpected errors.
- Messages are shown to users: short, plain, no internal details.

## Dispatch rules (`controllers/dispatchController.js`)
- `POST /dispatches` is idempotent on `clientRequestId`; a replay returns the existing record.
- `DELETE /dispatches/:id`: any role may delete a `Draft`; only Admin may delete a finalized invoice (403). Roles are checked in the controller.
- `PATCH /dispatches/:id/status`: Dispatched->Delivered (Admin, Dispatcher); Delivered->Dispatched Admin only (403); everything else 400; stale `updatedAt` 409. Rules live in `utils/dispatchStatus.js`, shared with the mock.
- Only `Draft` can be updated (400 otherwise). Updates use `updateMany` with `updatedAt` to detect concurrent edits (409).
- List endpoints return `LIST_FIELDS` only; single-record and write endpoints return the full record. The frontend relies on this.
- Totals are computed server-side; never trust client totals.
- Every dispatch write (create, draft update, finalize, revise) remembers the truck and destination in `MasterSettings.savedTrucks`/`savedDestinations` via `utils/savedReferences.js` (newest first, deduped, capped at 500, version-guarded). It never fails the dispatch save. Truck/destination delete endpoints match with the same dedupe key. The mock mirrors it.
- `POST /master-settings/:id/stone-rates` is allowed for Admin and Manager (`YardManager`) via `utils/roles.js` (`requireProductCreator`, registered before `allowRoles('Admin')`); editing/removing products stays Admin-only.
- Snapshots store `businessSnapshot.logo = { sha256, width, height, bytes }`; never inline logo bytes. Revisions do not copy `businessSnapshot`. Logo objects live at `org/<organizationId>/<sha256>.png` (`utils/logoStorage.js`), keyed by the session organization.

## Mock API
- `mock/server.js` must mirror status codes and response shapes of the real controllers. Update both in the same change.

## Tests
- `npm test` needs `TEST_DATABASE_URL` in `.env.test`. Tests create and drop their own schema; never point them at a shared database.
