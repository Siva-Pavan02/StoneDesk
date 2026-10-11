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
- Only `Draft` can be updated (400 otherwise). Updates use `updateMany` with `updatedAt` to detect concurrent edits (409).
- List endpoints return `LIST_FIELDS` only; single-record and write endpoints return the full record. The frontend relies on this.
- Totals are computed server-side; never trust client totals.

## Mock API
- `mock/server.js` must mirror status codes and response shapes of the real controllers. Update both in the same change.

## Tests
- `npm test` needs `TEST_DATABASE_URL` in `.env.test`. Tests create and drop their own schema; never point them at a shared database.
