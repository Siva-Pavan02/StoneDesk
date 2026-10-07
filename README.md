# StoneDesk

StoneDesk is a mobile-first B2B digital dispatch and ledger application designed specifically for granite quarry operations. It replaces traditional pen-and-paper tally sheets with a rapid-entry digital interface, enabling supervisors to log stone measurements, auto-calculate square footage, apply localized pricing, and instantly generate PDF/Excel invoices for buyers and transit slips for drivers.

## Tech Stack
* **Frontend:** React.js (Vite), Tailwind CSS v4
* **Backend:** Node.js, Express.js
* **Database:** Supabase PostgreSQL (Prisma)

## Prerequisites
* Node.js 22.12+
* Supabase project (session pooler connection URL, port 5432)

## Environment Variables
Create a `.env` file in the `server/` directory:
```env
PORT=5000
DATABASE_URL=postgresql://postgres.PROJECT:PASSWORD@POOLER_HOST:5432/postgres?schema=public
```

## Local Development Setup

**1. Start the Backend Server**
```bash
cd server
npm install
npx prisma db push
npm run dev
```
*Server will start on http://localhost:5000*

**2. Start the Frontend Client**
```bash
cd client
npm install
npm run dev
```
*Client will start on http://localhost:5173*

## Database migration and testing

Run `npx prisma generate` after schema changes. `npm test` in `server` creates a unique temporary PostgreSQL schema per integration suite and drops only that schema afterward. Set `TEST_DATABASE_URL` to a separate test project if preferred. Credentials remain server-only. Existing MongoDB records are not automatically copied by `db push`; retain backups and migrate historical records separately before retiring their database.

After pushing the schema to Supabase, run `node scripts/protectDatabase.js` from `server` to enable RLS and revoke direct `anon`/`authenticated` table access. The Express backend uses the server-only database role and handles authorization. Never put DATABASE_URL in frontend environment files.
