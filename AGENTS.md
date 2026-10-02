# AI Agent Instructions & System Prompt

When operating in this workspace, you must adhere strictly to the following rules:

## 1. Code Generation Rules
* **No Truncation:** Always output full, complete code files. Never use `// rest of code here` or `...` placeholders.
* **Tailwind v4 Strict:** Use Tailwind v4 syntax exclusively. Rely on `@import "tailwindcss";` in the CSS file. Do not generate outdated `tailwind.config.js` patterns unless specifically required by a third-party plugin.
* **Component Modularity:** Break complex React UI into smaller, reusable components.

## 2. UI/UX Directives (Crucial for Target Audience)
* **Mobile-First Only:** Design strictly for mobile screens. Do not optimize for desktop dashboards.
* **Outdoor Readability:** The app is used in extreme sunlight. Strictly enforce:
  * Backgrounds: `bg-gray-50`.
  * Cards: `bg-white shadow-sm`.
  * Inputs: 2px borders (`border-gray-300`), large touch targets (minimum `h-12` or `h-14`).
  * No dark mode. No low-contrast text.
* **Localization:** All primary input labels and buttons must feature English text, accompanied by smaller Telugu text directly beneath it (e.g., `<span className="text-gray-500 text-xs">లారీ నంబర్</span>`).

## 3. Database & State Rules
* **Never alter MongoDB schemas** without explicit human approval. 
* Financial calculations (Square Footage, Line Totals, Net Payable) must be strictly computed and stored as static numbers in the database for immutable auditing, not solely calculated on the frontend.
