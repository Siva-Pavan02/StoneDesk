# StoneDesk

StoneDesk is a mobile-first B2B digital dispatch and ledger application designed specifically for granite quarry operations. It replaces traditional pen-and-paper tally sheets with a rapid-entry digital interface, enabling supervisors to log stone measurements, auto-calculate square footage, apply localized pricing, and instantly generate PDF/Excel invoices for buyers and transit slips for drivers.

## Tech Stack
* **Frontend:** React.js (Vite), Tailwind CSS v4
* **Backend:** Node.js, Express.js
* **Database:** Supabase PostgreSQL (Prisma)

## Prerequisites
* Node.js 22.12+
* Supabase project (session pooler connection URL, port 5432)

## Project Structure
```
Backend/    Express API, Prisma schema, tests, mock server (mock/)
Frontend/   React + Vite client
docs/       PRD, architecture, design and UX notes
```

## Environment Variables
Copy `Backend/.env.example` to `Backend/.env` and fill it in:
```env
PORT=5000
APP_ORIGIN=http://localhost:5173
DATABASE_URL="postgresql://postgres.PROJECT:PASSWORD@POOLER_HOST:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.PROJECT:PASSWORD@POOLER_HOST:5432/postgres"

# Upstash Redis (optional locally; falls back to in-memory rate limiting)
UPSTASH_REDIS_REST_URL=https://your-db-name.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token

# SMTP (password reset emails)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_FROM="StoneDesk <noreply@stonedesk.app>"
```

The frontend reads `Frontend/.env.example` (`VITE_API_BASE_URL=/api`); by default Vite proxies `/api` to `http://localhost:5000`.

## Local Development Setup

**1. Start the Backend Server**
```bash
cd Backend
npm install
npx prisma db push
npm run dev
```
*Server will start on http://localhost:5000*

**2. Start the Frontend Client**
```bash
cd Frontend
npm install
npm run dev
```
*Client will start on http://localhost:5173*

## Mock API (no database needed)

A JSON-file backed mock of the API lives in `Backend/mock/server.js`. It uses the real calculation code and mirrors the real routes, validation and roles.

```bash
cd Backend
npm install
npm run mock          # http://localhost:5001, data in Backend/mock/mock-data.json
```

Point the frontend at it with `Frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5001/api
```
Restart `npm run dev` after changing `.env`. Delete `Backend/mock/mock-data.json` to reset the data. Seeded users: `admin@example.test` and `dispatcher@example.test` (any password of 12+ characters). Logo upload and password-reset emails are not available in mock mode.

## Scripts

| Where | Command | Purpose |
| --- | --- | --- |
| Backend | `npm run dev` | API with auto-reload |
| Backend | `npm test` | Backend test suite (needs a test database, see `.env.test.example`) |
| Backend | `npm run db:check` | Verify the database connection |
| Backend | `npm run mock` | Start the mock API |
| Frontend | `npm run dev` / `build` / `preview` | Vite dev server / production build / preview |
| Frontend | `npm run lint` | Lint with oxlint |

## Database migration and testing

Run `npx prisma generate` after schema changes. Credentials remain server-only.

After pushing the schema to Supabase, run `node scripts/protectDatabase.js` from `Backend` to enable RLS and revoke direct `anon`/`authenticated` table access. The Express backend uses the server-only database role and handles authorization. Never put DATABASE_URL in frontend environment files.

