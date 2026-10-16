# Approved A4 invoice — validation

**Deliverables:** [self-contained HTML](public/sample_invoice_24_rows.html) and [rendered three-page PDF](public/sample_invoice_24_rows.pdf). Both use the same renderer, fixture and stylesheet as the saved-bill preview and portable HTML/print exports. The previous buyer PDF, driver slip and XLSX exports retain their existing formats.

| Check | Verified result |
| --- | --- |
| Sample data | 24 numbered groups; 168 actual entries; 336 pieces; regular area 3,164.50 sq ft, Top area 2,373.375 sq ft, exact combined area 5,537.875 sq ft. |
| Totals | Regular ₹126,580.00; Top ₹94,935.00; material ₹221,515.00; loading/royalty ₹500.00; net ₹222,015.00. Displayed areas round to two decimals; aggregate math uses unrounded measurements. |
| Physical A4 print | **Three** 595.28 × 841.89 pt pages. Columns: 1–3 / 4–6 / 7–9; 10–12 / 13–15 / 16–18; 19–20 / 21–22 / 23–24. Summary, amount in words and sign-off appear exactly once, on page three. |
| Reference fidelity | All three PDF pages, rasterized at 1.5× using the tested Chrome installation, have **zero differing pixels** from pages printed from the supplied approved HTML. Page-three payment amounts remain selectable and inside the 12 mm printable margins. |
| Variable saved invoices | Real browser measurement and physical PDFs cover single and multiple groups, 37 groups, one 114-entry group split over two pages, a dedicated summary page, long business identity/reference, billion-scale wrapped amounts and a damaged-logo fallback. Every entry is present once, no totals repeat, and numeric text stays inside its cell and the printable page. |
| Responsive behavior | 390 px screen preview does not scroll horizontally; printing from that viewport still gives three A4 pages with three print columns. Full interface audit (at the time also run in a second language, since removed; the interface is now English only): **540/540** checks at 320, 390, 768, 1024 and 1440 px, including downloaded standalone HTML, browser print PDFs, existing buyer/driver PDFs and XLSX downloads. |
| Automated checks | **30/30** frontend Node tests, production build, and lint all pass; lint reports pre-existing warnings outside the A4 invoice files. |

To reproduce the sample, run `npm run invoice:sample` from the frontend directory. Run `node tests/a4InvoiceBrowser.test.mjs` with locally installed Chrome and Playwright to inspect generated A4 PDFs and screenshots; setting `INVOICE_REFERENCE_PDF` to a print of the approved source also enforces pixel-for-pixel page comparison. The exported HTML opens and prints without network access. In a browser print dialog, use A4, 100% scale, background graphics, and turn off browser headers and footers.