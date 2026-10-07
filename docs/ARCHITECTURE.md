# Technical Architecture Blueprint

## 1. Directory Structure
```text
/stonedesk
  /client                 # Vite + React + Tailwind v4
    /src
      /components         # Modular UI (LogisticsCard, RapidEntryRow)
      /context            # MasterDataContext (Settings state)
  /server                 # Node.js + Express
    /config
      db.js               # Mongoose connection logic
    /models               # Database schemas
    /routes               # API endpoints
```

## 2. Database Schema (MongoDB / Mongoose)

### MasterSettings Collection
Maintains dynamic dropdowns and defaults.
* `quarryId` (String, unique)
* `savedTrucks` (Array of Strings)
* `savedDestinations` (Array of Strings)
* `stoneRates` (Array of Objects: `stoneType`, `finish`, `defaultRate`)

### Dispatch Collection
Maintains immutable financial records of every loaded truck.
* `dispatchSlipNumber` (String, unique, indexed)
* `date` (Date, indexed)
* `logistics`: `{ truckNumber, buyerDestination }`
* `inventory`: Array of grouped stones.
  * `stoneType`, `surfaceFinish`, `ratePerSqFt`, `lineTotal`, `totalSqFt`
  * `pieces`: Array of individual slabs `{ lengthFt, widthFt, sqFt }`
* `summary`: `{ totalDispatchVolumeSqFt, netBillableAmount }`

## 3. UI/UX Design System
* **Framework:** Tailwind CSS v4.
* **Theme:** Material Card layout. 
* **Background:** Light neutral gray (`bg-gray-50`) to reduce eye strain.
* **Cards:** Pure white (`bg-white`) with subtle shadows (`shadow-sm`) and generous padding (`p-4` or `16px`).
* **Inputs:** Pure white backgrounds with distinct 2px borders (`border-gray-300`, `focus:ring-2 focus:ring-primary`).
* **Strict Constraint:** No dark mode. Maximum contrast required for outdoor visibility.
