# GraniteSync

GraniteSync is a mobile-first B2B digital dispatch and ledger application designed specifically for granite quarry operations. It replaces traditional pen-and-paper tally sheets with a rapid-entry digital interface, enabling supervisors to log stone measurements, auto-calculate square footage, apply localized pricing, and instantly generate PDF/Excel invoices for buyers and transit slips for drivers.

## Tech Stack
* **Frontend:** React.js (Vite), Tailwind CSS v4
* **Backend:** Node.js, Express.js
* **Database:** MongoDB Atlas (Mongoose)

## Prerequisites
* Node.js (v18+)
* MongoDB Atlas Cluster (Connection URI required)

## Environment Variables
Copy `server/.env.example` to `server/.env` and fill in the MongoDB URI and the public frontend origin. Never commit `.env` files or put secrets in client-side variables. The client uses `/api` by default; set `VITE_API_BASE_URL` at build time only when the API is hosted on a different origin. Vite embeds `VITE_*` values in the public bundle, so they must not contain credentials or secrets.

## Local Development Setup

**1. Start the Backend Server**
```bash
cd server
npm install
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
