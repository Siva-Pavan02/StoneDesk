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
Create a `.env` file in the `server/` directory:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/granitesync?appName=GraniteSync
```

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
