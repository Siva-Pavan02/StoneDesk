import { prepareA4Invoice } from './a4InvoiceModel.js';
import { renderA4Page } from './a4InvoiceRender.js';
import { LANDING_SAMPLE_GEOMETRY, recordedSamplePages } from './a4InvoiceSampleGeometry.js';

// Public landing demo only: fictional, frozen data rendered by the real A4 invoice
// renderer, so the preview always matches the invoice users get in the app.
// Totals: 43 pieces, 268.5 sq ft, Regular ₹13,440, Top ₹3,744, loading ₹1,200, net ₹18,384.
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const group = (id, topQuantity) => ({
  id,
  entries: [
    { id: `${id}-1`, type: 'regular', lengthFt: '4', widthFt: '2', quantity: 5, ratePerSqFt: '64.00' },
    { id: `${id}-2`, type: 'regular', lengthFt: '3', widthFt: '2', quantity: 5, ratePerSqFt: '64.00' },
    { id: `${id}-3`, type: 'top', lengthFt: '3', widthFt: '1.5', quantity: topQuantity, ratePerSqFt: '64.00' },
  ],
});

export const LANDING_SAMPLE_INPUT = deepFreeze({
  mode: 'sample', currency: 'INR', invoiceNumber: 'SAMPLE-001', invoiceDate: '2026-10-08', status: 'SAMPLE',
  seller: { name: 'Sample Stone Supplies', location: 'Demo location, India', contactLine: 'Illustrative business' },
  party: 'SAMPLE BUYER', lorryNumber: 'SAMPLE-LORRY', destination: 'SAMPLE DESTINATION', supervisor: 'SAMPLE OPERATOR',
  loadingRoyalty: '1200.00',
  groups: [group(1, 5), group(2, 4), group(3, 4)],
});

let cachedModel = null;

export function landingSampleModel() {
  if (cachedModel) return cachedModel;
  const model = prepareA4Invoice(structuredClone(LANDING_SAMPLE_INPUT));
  if (model.warnings.length) throw new Error(`Landing sample invoice is inconsistent: ${model.warnings.join(' ')}`);
  cachedModel = model;
  return model;
}

// The recorded geometry of this fixed sample puts each group in its own column
// of a single final page; anything else means the geometry no longer matches it.
export function landingSamplePage(model) {
  const pages = recordedSamplePages(model, LANDING_SAMPLE_GEOMETRY);
  if (pages.length !== 1) throw new Error(`Landing sample invoice needs a single page, planned ${pages.length}.`);
  return pages[0];
}

// renderA4Page (not renderA4Invoice) avoids a nested <main> inside the landing page.
// Distinct prefixes keep element ids unique when several copies are mounted.
// `responsive` adds the preview container class, so the dialog variant stacks
// its columns on a narrow screen; the scaled hero frame keeps the 210 mm sheet.
export function landingSampleHtml(prefix, { responsive = false } = {}) {
  const model = landingSampleModel();
  return `<div class="a4-invoice${responsive ? ' sample-pages' : ''}" data-sample="landing">${renderA4Page(model, landingSamplePage(model), 1, 1, 'buyer', prefix)}</div>`;
}
