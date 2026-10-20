import { INVOICE_FONT_FAMILY } from './a4InvoiceFonts.js';
import { COPIES, capacitiesFrom, planFromMeasurements, splitOversizedUnits, wholeGroupUnits } from './a4InvoicePagination.js';
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
function measurePass(doc, model, copy, units) {
  const view = doc.defaultView;
  const host = mountA4Host(doc, renderA4MeasureSheet(model, copy, units, `measure-${copy}`));
  try {
    const blocks = [...host.querySelectorAll('.row-block')];
    if (blocks.length !== units.length) throw new Error('Invalid group measurements');
    const heights = blocks.map(block => block.getBoundingClientRect().height);
    const gap = blocks.length > 1 ? parseFloat(view.getComputedStyle(blocks[0]).marginBlockEnd) || 0 : 8;
    const pageHeight = host.querySelector('.page-height-ruler').getBoundingClientRect().height;
    const headerHeight = outsideHeight(view, host.querySelector('.invoice-header'));
    const finalHeight = outsideHeight(view, host.querySelector('.final-section'));
    const noticeHeight = outsideHeight(view, host.querySelector('.continuation'));
    const { normalCapacity, finalCapacity } = capacitiesFrom({ pageHeight, headerHeight, noticeHeight, finalHeight });
    const rowLayouts = blocks.map((block, i) => rowLayout(block, units[i]));
    return { units, heights, gap, normalCapacity, finalCapacity, pageHeight, headerHeight, noticeHeight, finalHeight, rowLayouts };
  } finally {
    host.remove();
  }
}

/**
 * Measures `model` (already projected to `copy`). Groups taller than a column are
 * split at entry boundaries and measured again; ordinary groups stay whole.
 */
export async function measureA4Copy(model, copy, { doc = document } = {}) {
  if (!COPIES.includes(copy)) throw new Error('Copy must be buyer or driver.');
  await invoiceFontsReady(doc);
  let result = measurePass(doc, model, copy, wholeGroupUnits(model));
  const tooTall = ({ heights, normalCapacity }) => heights.some(height => height > normalCapacity + 0.01);
  if (tooTall(result)) {
    const units = splitOversizedUnits(result.units, result.heights, result.rowLayouts, result.normalCapacity);
    result = measurePass(doc, model, copy, units);
    if (tooTall(result)) throw new Error(OVERSIZED);
  }
  const { rowLayouts: _rowLayouts, ...measurements } = result;
  return measurements;
}

/** The measured page plan of one copy, shared by preview, print and PDF. */
export async function planA4CopyMeasured(model, copy, opts) {
  const measured = await measureA4Copy(model, copy, opts);
  return planFromMeasurements(model, measured.units, measured);
}
