# Product Requirements Document (PRD): StoneDesk

## 1. Product Overview
StoneDesk modernizes B2B granite supply chain logistics. It provides a frictionless, mobile-optimized point-of-loading interface for quarry supervisors in Kadapa, India, to log outgoing inventory, calculate complex dimensional pricing, and share formatted invoices via WhatsApp.

## 2. Target Audience & Environment
* **Primary User:** Quarry Loading Supervisor.
* **Environment:** Outdoors, extreme sunlight, high screen glare, dusty hands. 
* **Tech Literacy:** Low to moderate. Requires a zero-learning-curve, "fat-finger proof" interface.

## 3. Core Features
* **Rapid Measurement Ledger:** A built-in calculator where supervisors input `Length` x `Width` and the app calculates the square footage based on `(L * W)`.
* **Fraction Input Chips:** Quick-tap buttons (`+ ¼`, `+ ½`, `+ ¾`) appended to measurement inputs to avoid mobile keyboard decimal entry.
* **Inline Rate Adjustment:** Ability to override default pricing per square foot dynamically on the loading screen.
* **Dual Document Generation:**
  * **Driver Transit Slip:** PDF containing vehicle details, destination, and stone dimensions/pieces (Prices Hidden).
  * **Buyer Financial Invoice:** PDF/Excel document containing all dimensions, localized pricing, and total payable amounts.
* **WhatsApp Integration:** One-tap export to share the generated document via native device sharing (Web Share API).

## 4. Localization Strategy
* **Primary UI:** English (Bold, 16px).
* **Secondary UI:** Telugu (12px, gray) positioned directly beneath English labels for supervisor ease of use.
* **Buyer Exports:** Invoices generated for Tamil Nadu buyers should support English/Tamil bilingual headers.
