import { AREA_ROUNDING_NOTE, formatA4Dimension, formatA4Money, formatA4Number, formatA4Rate } from './a4InvoiceModel.js';

export function escapeA4Text(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function idPrefix(value) {
  return `invoice-${String(value || 'document').replace(/[^a-zA-Z0-9_-]/g, '') || 'document'}`;
}

const number = value => escapeA4Text(formatA4Number(value));
const money = value => escapeA4Text(formatA4Money(value));
const entryRow = entry => `<tr data-kind="${entry.type}" data-entry-id="${escapeA4Text(entry.id)}"><th class="type${entry.type === 'top' ? ' top' : ''}" scope="row"${entry.type === 'regular' ? ' aria-label="Regular material"' : ''}>${entry.type === 'top' ? 'Top' : ''}</th><td class="dim">${escapeA4Text(formatA4Dimension(entry.lengthFt))}</td><td class="dim">${escapeA4Text(formatA4Dimension(entry.widthFt))}</td><td class="qty">${entry.quantity}</td><td class="num">${number(entry.area)}</td></tr>`;
// Group total row: pieces and area only; Type, L and W are covered by the label.
const totalRow = values => `<tr class="total"><th colspan="3" scope="row">Total</th><td class="qty">${values.pieces}</td><td class="num">${number(values.area)}</td></tr>`;

// A fragment is a half-open range of actual entries; the group total appears
// only on the fragment containing the group's final real entry.
export function renderA4Group(group, from = 0, to = group.entries.length, prefix = 'document') {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > group.entries.length || to <= from) throw new Error(`Invalid fragment of group ${group.id}.`);
  const id = `${idPrefix(prefix)}-row-${group.id}-${from}`;
  const rows = [];
  for (let index = from; index < to; index++) rows.push(entryRow(group.entries[index]));
  return `<section class="row-block" id="${id}" aria-labelledby="${id}-heading"><h3 id="${id}-heading">${group.id}${from ? '<span class="continuation-marker">(continued)</span>' : ''}</h3><div class="row-table-wrap"><table class="row-table"><caption class="sr-only">Measurements for group ${group.id}${from ? ', continued' : ''}; dimensions in feet</caption><colgroup><col class="col-type"><col class="col-l"><col class="col-w"><col class="col-qty"><col class="col-area"></colgroup><thead><tr><th scope="col">Type</th><th class="dim" scope="col">L (ft)</th><th class="dim" scope="col">W (ft)</th><th class="qty" scope="col">Qty</th><th class="num" scope="col">Sq ft</th></tr></thead><tbody>${rows.join('')}</tbody>${to === group.entries.length ? `<tfoot>${totalRow(group.total)}</tfoot>` : ''}</table></div></section>`;
}

function renderHeader(model) {
  const seller = model.seller;
  const logo = seller.logo
    ? `<div role="img" aria-label="Business logo" class="logo-placeholder"><img src="${escapeA4Text(seller.logo)}" alt=""></div>`
    : '<div role="img" aria-label="Business logo placeholder" class="logo-placeholder">LOGO</div>';
  const contact = [seller.location, seller.contactLine, seller.phone ? `<span class="phone">${escapeA4Text(seller.phone)}</span>` : '']
    .filter(Boolean).map(value => value === seller.location || value === seller.contactLine ? escapeA4Text(value) : value).join('<br>');
  const facts = [['Party', model.party], ['Lorry no.', model.lorryNumber], ['Destination', model.destination], ['Supervisor', model.supervisor]];
  const state = model.mode === 'sample' ? 'SAMPLE' : model.status === 'Dispatched' ? 'IN TRANSIT' : model.status.toUpperCase();
  return `<header class="invoice-header"><div class="business-panel">${logo}<div class="business-copy"><h1 class="business-name">${escapeA4Text(seller.name)}</h1>${contact ? `<p class="business-contact">${contact}</p>` : ''}</div></div><div class="invoice-panel"><div class="invoice-topline"><h2 class="invoice-kind">${escapeA4Text(model.title)}</h2><div class="invoice-state"><time datetime="${escapeA4Text(model.invoiceDate.datetime)}">${escapeA4Text(model.invoiceDate.label)}</time><span class="status">${escapeA4Text(state)}</span></div></div><p class="invoice-reference">No. ${escapeA4Text(model.invoiceNumber)}${model.mode === 'sample' ? ' · Fictional data — not for payment' : ''}</p><dl class="invoice-facts">${facts.map(([label, value], i) => `<div><dt>${label}</dt><dd${i === 1 ? ' class="mono"' : ''}>${escapeA4Text(value)}</dd></div>`).join('')}</dl></div></header>`;
}

function renderSummary(model, prefix, pick) {
  const totals = model.totals, id = idPrefix(prefix);
  const rates = [...new Set(model.groups.flatMap(group => group.entries.map(entry => entry.ratePerSqFt)))];
  const rateRow = model.mode === 'production' ? `<div class="settlement-row settlement-rate"><dt>${escapeA4Text(pick(rates.length === 1 ? 'Rate / sq ft' : 'Rates / sq ft', rates.length === 1 ? 'చ.అ. ధర' : 'చ.అ. ధరలు'))}</dt><dd data-rate="sq-ft">${rates.map(rate => rate == null ? escapeA4Text(pick('Not recorded', 'నమోదు కాలేదు')) : escapeA4Text(formatA4Rate(rate))).join(' · ')}</dd></div>` : '';
  return `<section class="invoice-summary" aria-label="Order and payment summary"><div class="order-overview"><h2 class="summary-title" id="${id}-order-heading">Order summary</h2><dl class="headline-totals" aria-labelledby="${id}-order-heading"><div class="headline-stat"><dt>Total pieces</dt><dd data-total="pieces">${totals.pieces}</dd></div><div class="headline-stat area-stat"><dt>Total area · sq ft</dt><dd data-total="area">${number(totals.area)}</dd></div></dl><dl class="material-total"><div><dt>Material total</dt><dd data-total="material">${money(totals.materialTotal)}</dd></div></dl></div><div class="settlement-overview"><h2 class="summary-title" id="${id}-payment-heading">Payment summary</h2><dl class="settlement" aria-labelledby="${id}-payment-heading"><div class="settlement-row"><dt>Material amount</dt><dd data-amount="material">${money(totals.materialTotal)}</dd></div>${rateRow}<div class="settlement-row"><dt>Loading / royalty</dt><dd>${money(model.loadingRoyalty)}</dd></div><div class="settlement-net"><dt>Net payable</dt><dd data-total="net">${money(totals.netPayable)}</dd></div></dl></div></section>`;
}

function renderClosing(model) {
  // Bank / UPI line appears only when the snapshot carries a non-empty value.
  const bankDetails = typeof model.seller.bankDetails === 'string' ? model.seller.bankDetails.trim() : '';
  const bank = bankDetails ? `<p class="label bank-label">Bank / UPI details</p><p class="bank-details">${escapeA4Text(bankDetails)}</p>` : '';
  return `<section class="closing" aria-label="Amount in words and authorization"><div><p class="label">Amount in words</p><p class="amount-in-words">${escapeA4Text(model.amountWords)}</p>${bank}<p class="rounding-note">${escapeA4Text(AREA_ROUNDING_NOTE)}</p></div><div class="sign">${model.mode === 'sample' ? '<strong>Sample only</strong><span>Not valid for payment</span>' : `${model.seller.signatoryName ? `<strong>${escapeA4Text(model.seller.signatoryName)}</strong>` : ''}<span>Authorized signatory</span>`}</div></section>`;
}

function pageGroups(page) { return page.columns.flatMap(column => column.map(fragment => fragment.group.id)); }

function renderNote(model, page) {
  if (model.mode !== 'sample') return '';
  const ids = pageGroups(page);
  const rates = new Set(model.groups.flatMap(group => group.entries.map(entry => entry.ratePerSqFt)));
  const rate = rates.size === 1 && !rates.has(null) ? ` · Sample rate ${money([...rates][0])} / sq ft` : '';
  return `<p class="sample-note">Illustrative measurements${rate}${ids.length ? ` · Groups ${ids[0]}–${ids.at(-1)}` : ''}</p>`;
}

function renderFooter(model, pageNumber, pageCount) {
  const left = model.mode === 'sample' ? 'SAMPLE · FICTIONAL DATA · NOT FOR PAYMENT' : 'BUYER INVOICE';
  return `<footer class="page-foot"><strong>${left}</strong><span>All amounts in INR · Dimensions in feet</span><span class="page-number">Page ${pageNumber} of ${pageCount}</span></footer>`;
}

export function renderA4Page(model, page, pageNumber, pageCount, prefix = 'document', pick = en => en) {
  const ids = pageGroups(page);
  return `<article class="paper sample-sheet" aria-label="${escapeA4Text(model.title)} page ${pageNumber} of ${pageCount}">${renderHeader(model)}${renderNote(model, page)}<section class="detail-columns" aria-label="${ids.length ? `Measurement groups ${ids[0]} to ${ids.at(-1)}` : 'No measurement groups on this summary page'}">${page.columns.map(column => `<div class="detail-column">${column.map(({ group, from, to }) => renderA4Group(group, from, to, prefix)).join('')}</div>`).join('')}</section>${page.summary ? `${renderSummary(model, prefix, pick)}${renderClosing(model)}` : '<p class="continuation">Continued on the next page. Order totals and payment summary appear on the final page.</p>'}${renderFooter(model, pageNumber, pageCount)}</article>`;
}

export function renderA4Invoice(model, pages, prefix = 'document', pick = en => en) {
  if (!pages?.length || pages.some(page => !Array.isArray(page.columns) || page.columns.length !== 3)) throw new Error('The invoice needs complete, paginated columns.');
  if (pages.filter(page => page.summary).length !== 1 || !pages.at(-1).summary) throw new Error('The invoice summary must appear once on the final page.');
  return `<main class="a4-invoice" aria-label="${escapeA4Text(model.title)}">${pages.map((page, i) => renderA4Page(model, page, i + 1, pages.length, prefix, pick)).join('')}</main>`;
}

export function renderStandaloneA4Invoice(model, pages, css, pick = en => en) {
  if (!css || /<\/style/i.test(css)) throw new Error('A safe inline invoice stylesheet is required.');
  const html = renderA4Invoice(model, pages, 'document', pick);
  return `<!doctype html><html lang="en-IN" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeA4Text(model.title)} — ${escapeA4Text(model.invoiceNumber)}</title><style>${css}</style></head><body class="a4-body">${html}</body></html>`;
}

export function fixedSampleA4Pages(model) {
  if (model.mode !== 'sample' || model.groups.length !== 24 || model.groups.some((group, index) => group.id !== index + 1 || group.entries.length !== 7)) throw new Error('The approved sample requires its exact 24 numbered groups of seven entries.');
  const arrange = layout => ({ columns: layout.map(column => column.map(id => ({ group: model.groups[id - 1], from: 0, to: 7 }))), summary: false });
  const pages = [arrange([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    arrange([[10, 11, 12], [13, 14, 15], [16, 17, 18]]),
    arrange([[19, 20], [21, 22], [23, 24]])];
  pages.at(-1).summary = true;
  return pages;
}