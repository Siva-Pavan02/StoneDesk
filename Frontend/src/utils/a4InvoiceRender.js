import { SAMPLE_BANK_NAMES, SAMPLE_BANK_PAIRS, a4StatusLabel, bankDetailPairs, bankDetailSegments, formatA4Dimension, formatA4Money, formatA4Number, formatA4Rate } from './a4InvoiceModel.js';
import { COLUMNS, fragmentRows } from './a4InvoicePagination.js';

// Markup of the user's reference invoice (sample_invoice_space_optimized.html):
// the header on every page, three measurement columns with Reg total / Top total
// rows, a continuation note on every page but the last, and the order/payment
// summary on the final page only. Pages come from the measured plan
// (a4InvoicePagination.js). Decorative pseudo-elements of the reference are real
// aria-hidden elements here (.group-rule, .column-rule) so the PDF exporter can
// measure them, and the bank label colon is literal text.

export function escapeA4Text(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function idPrefix(value) {
  return `invoice-${String(value || 'document').replace(/[^a-zA-Z0-9_-]/g, '') || 'document'}`;
}

function assertCopy(copy) {
  if (copy !== 'buyer' && copy !== 'driver') throw new Error('Copy must be buyer or driver.');
}

const number = value => escapeA4Text(formatA4Number(value));
const money = value => escapeA4Text(formatA4Money(value));
const TIMES = '<td aria-hidden="true" class="operator-cell times-cell">×</td>';
const EQUALS = '<td aria-hidden="true" class="operator-cell equals-cell">=</td>';
const COLGROUP = '<colgroup><col class="col-type"><col class="col-l"><col class="col-times"><col class="col-w"><col class="col-equals"><col class="col-qty"><col class="col-area"></colgroup>';
const THEAD = '<thead><tr><th scope="col">Type</th><th class="dim" scope="col">L (ft)</th><th aria-hidden="true" class="operator-cell times-cell"></th><th class="dim" scope="col">W (ft)</th><th aria-hidden="true" class="operator-cell equals-cell"></th><th class="qty" scope="col">Qty</th><th class="num" scope="col">Sq ft</th></tr></thead>';

export function continuationText(copy) {
  assertCopy(copy);
  return copy === 'buyer'
    ? 'Continued on the next page. Order totals and payment summary appear on the final page.'
    : 'Continued on the next page. Order totals appear on the final page.';
}

function entryRow(entry) {
  const type = entry.type === 'top' ? '<th class="type top" scope="row">Top</th>' : '<th aria-label="Regular material" class="type" scope="row"></th>';
  return `<tr data-kind="${entry.type === 'top' ? 'top' : 'regular'}" data-entry-id="${escapeA4Text(entry.id)}">${type}<td class="dim">${escapeA4Text(formatA4Dimension(entry.lengthFt))}</td>${TIMES}<td class="dim">${escapeA4Text(formatA4Dimension(entry.widthFt))}</td>${EQUALS}<td class="qty">${entry.quantity}</td><td class="num">${number(entry.area)}</td></tr>`;
}

function subtotalRow(group, of) {
  const totals = group[of];
  return `<tr class="sub" data-subtotal="${of}"><th colspan="5" scope="row">${of === 'regular' ? 'Reg total' : 'Top total'}</th><td class="qty">${totals.pieces}</td><td class="num">${number(totals.area)}</td></tr>`;
}

// A fragment is the half-open entry range [from, to) of one group (Regular first,
// then Top). Tables carry no rate or amount on either copy.
export function renderA4Group(group, from = 0, to = group.entries.length, copy = 'buyer', prefix = 'document') {
  assertCopy(copy);
  const rows = fragmentRows(group, from, to)
    .map(row => row.kind === 'entry' ? entryRow(row.entry) : subtotalRow(group, row.of)).join('');
  const id = `${idPrefix(prefix)}-row-${group.id}-${from}`;
  const continued = from > 0;
  return `<section aria-labelledby="${id}-heading" class="row-block" id="${id}" data-group="${group.id}" data-from="${from}" data-to="${to}">`
    + `<h3 id="${id}-heading"><span class="serial-badge">${group.id}</span>${continued ? '<span class="continuation-marker">conti</span>' : ''}<span class="group-rule" aria-hidden="true"></span></h3>`
    + `<table class="row-table"><caption class="sr-only">Measurements for group ${group.id}${continued ? ', continued' : ''}; dimensions in feet and areas in square feet</caption>`
    + `${COLGROUP}${THEAD}<tbody>${rows}</tbody></table></section>`;
}

// Identical on every page of a copy.
export function renderA4Header(model) {
  const seller = model.seller;
  const logo = seller.logo
    ? `<div aria-label="Business logo" class="logo-placeholder has-logo" role="img"><img src="${escapeA4Text(seller.logo)}" alt=""></div>`
    : '<div aria-label="Business logo placeholder" class="logo-placeholder" role="img">LOGO</div>';
  const contact = [seller.location && escapeA4Text(seller.location), seller.contactLine && escapeA4Text(seller.contactLine),
    seller.phone && `<span class="phone">${escapeA4Text(seller.phone)}</span>`].filter(Boolean).join('<br>');
  const facts = [['Party', model.party, ''], ['Lorry no.', model.lorryNumber, ' class="mono"'], ['Destination', model.destination, ''], ['Manager', model.supervisor, '']];
  return '<header class="invoice-header">'
    + `<div class="business-panel">${logo}<div class="business-copy"><h1 class="business-name">${escapeA4Text(seller.name)}</h1>${contact ? `<p class="business-contact">${contact}</p>` : ''}</div></div>`
    + '<div class="invoice-panel">'
    + `<div class="invoice-topline"><h2 class="invoice-kind">${escapeA4Text(model.title)}</h2><div class="invoice-state"><time datetime="${escapeA4Text(model.invoiceDate.datetime)}">${escapeA4Text(model.invoiceDate.label)}</time><span class="status">${escapeA4Text(a4StatusLabel(model))}</span></div></div>`
    + `<p class="invoice-reference">No. ${escapeA4Text(model.invoiceNumber)}${model.mode === 'sample' ? ' · Fictional data — not for payment' : ''}</p>`
    + `<dl class="invoice-facts">${facts.map(([label, value, cls]) => `<div><dt>${label}</dt><dd${cls}>${escapeA4Text(value)}</dd></div>`).join('')}</dl>`
    + '</div></header>';
}

/** Minimal continued header for emergency page 2+ (no repeated business header/metadata). */
export function renderA4ContinuedHeader() {
  return '<header class="invoice-continued-header"><span class="continued-label">Continued</span></header>';
}

// Pieces and area only: shared by both copies.
function orderOverview(model, id, withMaterial) {
  const totals = model.totals;
  return `<div class="order-overview"><h2 class="summary-title" id="${id}-order-heading">Order summary</h2>`
    + `<dl aria-labelledby="${id}-order-heading" class="headline-totals"><div class="headline-stat"><dt>Total pieces</dt><dd data-total="pieces">${totals.pieces}</dd></div><div class="headline-stat area-stat"><dt>Total area · sq ft</dt><dd data-total="area">${number(totals.area)}</dd></div></dl>`
    + (withMaterial ? `<dl class="material-total"><div><dt>Material total</dt><dd data-total="material">${money(totals.materialTotal)}</dd></div></dl>` : '')
    + '</div>';
}

function renderSign(model) {
  const sign = model.mode === 'sample'
    ? '<strong>Sample only</strong><span>Not valid for payment</span>'
    : `${model.seller.signatoryName ? `<strong>${escapeA4Text(model.seller.signatoryName)}</strong>` : ''}<span>Authorized signatory</span>`;
  return `<div class="sign">${sign}</div>`;
}

// Buyer copy only. Sample: the reference placeholders; production: label/value
// pairs when every segment has one, otherwise one plain line; omitted when empty.
function renderBank(model, id) {
  const sample = model.mode === 'sample';
  const text = typeof model.seller.bankDetails === 'string' ? model.seller.bankDetails.trim() : '';
  if (!sample && !text) return '';
  const pairs = sample ? SAMPLE_BANK_PAIRS : bankDetailPairs(text);
  const body = pairs
    ? `<dl class="bank-fields">${pairs.map(([label, value], index) => {
      const name = sample ? ` aria-label="${escapeA4Text(SAMPLE_BANK_NAMES[index])}" title="${escapeA4Text(SAMPLE_BANK_NAMES[index])}"` : '';
      return `<div><dt${name}>${escapeA4Text(label)}:</dt><dd>${escapeA4Text(value)}</dd></div>`;
    }).join('')}</dl>`
    : `<p class="bank-text">${escapeA4Text(bankDetailSegments(text).join(' · '))}</p>`;
  return `<section aria-labelledby="${id}-bank-heading" class="bank-details"><div class="bank-head"><h2 class="bank-heading" id="${id}-bank-heading">Bank details</h2>${sample ? '<p class="bank-note">Preview placeholders only</p>' : ''}</div>${body}</section>`;
}

function renderProducts(model, id) {
  if (!model.products?.length) return '';
  return `<section class="product-summary" aria-labelledby="${id}-products-heading"><h2 class="summary-title" id="${id}-products-heading">Product Summary</h2>`
    + model.products.map(product => `<div class="product-summary-row"><span class="product-summary-name">${escapeA4Text([product.stoneType, product.finish].filter(Boolean).join(' · '))}</span><span class="product-summary-quantity">${product.quantity} pcs</span><span class="product-summary-rate">${product.ratePerSqFt == null ? '—' : `${formatA4Rate(product.ratePerSqFt).replace(/\.00$/, '')}/sq ft`}</span></div>`).join('')
    + '</section>';
}

// Buyer: order and payment summary, amount in words, bank details and signature.
// Driver: pieces and area, then the signature; it reads no money, words or bank field.
function renderFinal(model, copy, prefix) {
  const id = idPrefix(prefix);
  if (copy === 'driver') {
    return '<div class="final-section">'
      + `<section aria-label="Order summary" class="invoice-summary driver-summary">${orderOverview(model, id, false)}</section>`
      + `<section aria-label="Authorization" class="closing"><div class="footer-details">${renderSign(model)}</div></section>`
      + '</div>';
  }
  const totals = model.totals;
  return '<div class="final-section">'
    + renderProducts(model, id)
    + `<section aria-label="Order and payment summary" class="invoice-summary">${orderOverview(model, id, true)}`
    + `<div class="settlement-overview"><h2 class="summary-title" id="${id}-payment-heading">Payment summary</h2>`
    + `<dl aria-labelledby="${id}-payment-heading" class="settlement"><div class="settlement-row"><dt>Material total</dt><dd data-amount="material">${money(totals.materialTotal)}</dd></div><div class="settlement-row"><dt>Loading / royalty</dt><dd data-amount="loading">${money(model.loadingRoyalty)}</dd></div><div class="settlement-net"><dt>Net payable</dt><dd data-total="net">${money(totals.netPayable)}</dd></div></dl></div>`
    + '</section>'
    + `<section aria-label="Amount in words, optional bank details and authorization" class="closing"><div class="closing-notes"><div class="words-line"><p class="label">Amount in words</p><p class="amount-in-words">${escapeA4Text(model.amountWords)}</p></div></div>`
    + `<div class="footer-details">${renderBank(model, id)}${renderSign(model)}</div></section>`
    + '</div>';
}

const RULE = '<span class="column-rule" aria-hidden="true"></span>';

function renderColumns(columns, copy, prefix) {
  return `<section aria-label="Invoice measurement columns" class="detail-columns">${columns.map((column, index) => `<div class="detail-column">${index ? RULE : ''}${column.map(({ group, from, to }) => renderA4Group(group, from, to, copy, prefix)).join('')}</div>`).join('')}</section>`;
}

export function renderA4Page(model, page, pageNumber, pageCount, copy = 'buyer', prefix = 'document') {
  assertCopy(copy);
  const hasRows = page.columns.some(column => column.length);
  const density = page.tier ? ` density-${page.tier}` : '';
  return `<article aria-label="${escapeA4Text(model.title)} page ${pageNumber} of ${pageCount}" class="paper sample-sheet${density}" data-page="${pageNumber}"><div class="page-body">`
    + (pageNumber === 1 ? renderA4Header(model) : renderA4ContinuedHeader())
    + (hasRows ? renderColumns(page.columns, copy, prefix) : '')
    + (page.final ? renderFinal(model, copy, prefix) : `<p class="continuation">${continuationText(copy)}</p>`)
    + '</div></article>';
}

function assertPages(pages) {
  if (!pages?.length || pages.some(page => !Array.isArray(page?.columns) || page.columns.length !== COLUMNS)) throw new Error('The invoice needs complete, paginated columns.');
  if (pages.filter(page => page.final).length !== 1 || !pages.at(-1).final) throw new Error('The invoice summary must appear once on the final page.');
}

/** The page articles only (used by the PDF export host). */
export function renderA4Pages(model, pages, copy = 'buyer', prefix = 'document') {
  assertCopy(copy);
  assertPages(pages);
  return pages.map((page, i) => renderA4Page(model, page, i + 1, pages.length, copy, prefix)).join('');
}

export function renderA4Invoice(model, pages, copy = 'buyer', prefix = 'document') {
  const articles = renderA4Pages(model, pages, copy, prefix);
  return `<main aria-label="${escapeA4Text(model.title)}" class="a4-invoice sample-pages" data-page-count="${pages.length}" data-group-count="${model.groups.length}">${articles}</main>`;
}

export function renderStandaloneA4Invoice(model, pages, css, copy = 'buyer') {
  if (!css || /<\/style/i.test(css)) throw new Error('A safe inline invoice stylesheet is required.');
  const html = renderA4Invoice(model, pages, copy, 'document');
  return `<!doctype html><html lang="en-IN" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeA4Text(model.title)} — ${escapeA4Text(model.invoiceNumber)}</title><style>${css}</style></head><body class="a4-body">${html}</body></html>`;
}

/**
 * One A4 sheet for the measure host: the header, every unit in the first column
 * (columns 2..COLUMNS empty, with their rules), the final section and the
 * continuation note, followed by the 272.5 mm page-height ruler.
 */
export function renderA4MeasureSheet(model, copy, units, prefix = 'measure', tier = '') {
  assertCopy(copy);
  const blocks = units.map(({ group, from, to }) => renderA4Group(group, from, to, copy, prefix)).join('');
  const emptyColumns = Array.from({ length: COLUMNS - 1 }, () => `<div class="detail-column">${RULE}</div>`).join('');
  const density = tier ? ` density-${tier}` : '';
  return `<article class="paper sample-sheet${density}" data-measure="${copy}"><div class="page-body">`
    + renderA4Header(model)
    + `<section aria-label="Invoice measurement columns" class="detail-columns"><div class="detail-column">${blocks}</div>${emptyColumns}</section>`
    + renderA4ContinuedHeader()
    + renderFinal(model, copy, prefix)
    + `<p class="continuation">${continuationText(copy)}</p>`
    + '</div></article><div class="page-height-ruler"></div>';
}
