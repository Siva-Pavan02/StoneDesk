import { INVOICE_FONT_FAMILY } from './a4InvoiceFonts.js';
import { COLUMNS, COPIES, baseColumnsForSNo, capacitiesFrom, planFromMeasurements, splitOversizedUnits, wholeGroupUnits } from './a4InvoicePagination.js';
import { renderA4MeasureSheet } from './a4InvoiceRender.js';

// Browser only. Measures one copy at real A4 print geometry in an offscreen host
// (the reference's #invoice-measure-host), independent of the viewport and of a
// stacked narrow-screen preview, and feeds the reference planner.

const OVERSIZED = 'A measurement group is taller than a usable column';

/** Waits for the invoice faces (400/600/700); never throws. */
export async function invoiceFontsReady(doc = document) {
  try {
    const fonts = doc?.fonts;
    if (!fonts) return;
    await Promise.all([400, 600, 700].map(weight => fonts.load(`${weight} 12px "${INVOICE_FONT_FAMILY}"`, '0₹×').catch(() => [])));
    await fonts.ready;
  } catch {
    // Measuring with a fallback face is still complete; it is never clipped.
  }
}

/** Appends `html` (renderer output, already escaped) in a hidden A4 host. */
export function mountA4Host(doc, html) {
  const host = doc.createElement('div');
  host.className = 'a4-invoice a4-measure-host';
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML = html;
  doc.body.appendChild(host);
  return host;
}

// Border-box height plus vertical margins (the reference's outsideHeight).
function outsideHeight(view, element) {
  const style = view.getComputedStyle(element);
  return element.getBoundingClientRect().height + (parseFloat(style.marginBlockStart) || 0) + (parseFloat(style.marginBlockEnd) || 0);
}

// Per block: every body row with its height, and `head` = the rest of the block
// (heading, table header and any trailing border), so that
// head + sum(row heights) equals the measured block height.
function rowLayout(block, unit) {
  const rows = [...block.querySelectorAll('tbody > tr')];
  let index = unit.from;
  const measured = rows.map(row => {
    const height = row.getBoundingClientRect().height;
    return row.dataset.subtotal ? { height, kind: 'sub', of: row.dataset.subtotal } : { height, kind: 'entry', index: index++ };
  });
  const total = measured.reduce((sum, row) => sum + row.height, 0);
  return { head: block.getBoundingClientRect().height - total, rows: measured };
}

// One synchronous pass: mount, read, remove. No await in between.
function measurePass(doc, model, copy, units, tier = '', columnCount = COLUMNS) {
  const view = doc.defaultView;
  const host = mountA4Host(doc, renderA4MeasureSheet(model, copy, units, `measure-${copy}`, tier, columnCount));
  try {
    const blocks = [...host.querySelectorAll('.row-block')];
    if (blocks.length !== units.length) throw new Error('Invalid group measurements');
    const widthFits = [...host.querySelectorAll('.row-table th, .row-table td, .product-summary-quantity, .product-summary-rate')].every(cell => {
      const range = doc.createRange(); range.selectNodeContents(cell);
      const text = range.getBoundingClientRect(), box = cell.getBoundingClientRect();
      return !cell.textContent.trim() || (text.left >= box.left - 1 && text.right <= box.right + 1);
    });
    const heights = blocks.map(block => block.getBoundingClientRect().height);
    const gap = blocks.length > 1 ? parseFloat(view.getComputedStyle(blocks[0]).marginBlockEnd) || 0 : 8;
    const pageHeight = host.querySelector('.page-height-ruler').getBoundingClientRect().height;
    const headerHeight = outsideHeight(view, host.querySelector('.invoice-header'));
    const continuationHeaderHeight = outsideHeight(view, host.querySelector('.invoice-continued-header'));
    const finalHeight = outsideHeight(view, host.querySelector('.final-section'));
    const noticeHeight = outsideHeight(view, host.querySelector('.continuation'));
    const { normalCapacity, finalCapacity } = capacitiesFrom({ pageHeight, headerHeight, noticeHeight, finalHeight });
    const continued = capacitiesFrom({ pageHeight, headerHeight: continuationHeaderHeight, noticeHeight, finalHeight });
    const rowLayouts = blocks.map((block, i) => rowLayout(block, units[i]));
    return { widthFits, continuationHeaderHeight, continuationNormalCapacity: continued.normalCapacity, continuationFinalCapacity: continued.finalCapacity, units, heights, gap, normalCapacity, finalCapacity, pageHeight, headerHeight, noticeHeight, finalHeight, rowLayouts, tier, columnCount };
  } finally {
    host.remove();
  }
}

/**
 * Measures `model` (already projected to `copy`). Groups taller than a column are
 * split at entry boundaries and measured again; ordinary groups stay whole.
 */
export async function measureA4Copy(model, copy, { doc = document, tier = '', columnCount } = {}) {
  if (!COPIES.includes(copy)) throw new Error('Copy must be buyer or driver.');
  await invoiceFontsReady(doc);
  const targetCol = columnCount ?? baseColumnsForSNo(model?.groups?.length || 0);
  let result = measurePass(doc, model, copy, wholeGroupUnits(model), tier, targetCol);
  const tooTall = ({ heights, normalCapacity }) => heights.some(height => height > normalCapacity + 0.01);
  if (tooTall(result)) {
    const units = splitOversizedUnits(result.units, result.heights, result.rowLayouts, result.normalCapacity);
    result = measurePass(doc, model, copy, units, tier, targetCol);
    if (tooTall(result)) throw new Error(OVERSIZED);
  }
  return result;
}

/** The measured page plan of one copy, shared by preview, print and PDF. Uses controlled multi-pass single-page fitting. */
export async function planA4CopyMeasured(model, copy, opts) {
  const TIERS = ['', 'pass2', 'pass3', 'pass4'];
  for (const columnCount of [2, 3, 4, 5]) {
    for (const tier of TIERS) {
      let measured;
      try { measured = await measureA4Copy(model, copy, { ...opts, tier, columnCount }); }
      catch (error) { if (error.message === OVERSIZED) continue; throw error; }
      if (!measured.widthFits) continue;
      const plan = planFromMeasurements(model, measured.units, { ...measured, singlePageOnly: true }, { columns: columnCount });
      if (!plan) continue;
      if (tier) plan.forEach(page => { page.tier = tier; });
      return plan;
    }
  }
  throw new Error('Invoice cannot fit on one A4 page within 5 columns, 8 mm margins and 7.5 pt text. No rows were omitted.');
}
