// Pure decision + window-driving logic for the A4 Print/PDF action.
// Kept free of React and module-level DOM access so it can be unit tested with fakes.
import { projectCopy } from './a4InvoiceModel.js';
import { renderStandaloneA4Invoice } from './a4InvoiceRender.js';

const COPIES = ['buyer', 'driver'];

/**
 * Synchronous first step of Print/PDF for the selected copy. Must run inside the
 * user's click handler before any `await`, so the popup blocker sees the
 * window.open as user-initiated. Warnings are checked BEFORE opening, so no window
 * is ever opened and then closed just because the invoice needs review. An unknown
 * copy throws before any window is opened.
 *
 * `model` is the unprojected (buyer) model; `copy` says which copy will be printed.
 *
 * @returns {{status:'warnings', copy:string, warnings:string[], model:object}
 *   | {status:'blocked', copy:string, model:object}
 *   | {status:'opened', copy:string, model:object, printWindow:Window}}
 */
export function startPrint({ record, buildModel, openWindow, copy = 'buyer' }) {
  if (!COPIES.includes(copy)) throw new Error(`Unknown bill copy "${copy}". Expected "buyer" or "driver".`);
  const model = buildModel(record);
  const warnings = Array.isArray(model?.warnings) ? model.warnings.filter(Boolean).map(String) : [];
  if (warnings.length) return { status: 'warnings', copy, warnings, model };
  let printWindow = null;
  try { printWindow = openWindow(); } catch { printWindow = null; }
  if (!printWindow) return { status: 'blocked', copy, model };
  return { status: 'opened', copy, model, printWindow };
}

/**
 * Standalone print HTML of one copy. The model is projected with `projectCopy`
 * and rendered with `pages`, the measured plan the preview and the PDF use for
 * that copy. The plan is required: pagination is measured in the browser
 * (a4InvoiceMeasure.js), so this module never computes one of its own.
 */
export function printCopyHtml(model, copy, css, pages) {
  if (!COPIES.includes(copy)) throw new Error(`Unknown bill copy "${copy}". Expected "buyer" or "driver".`);
  if (!Array.isArray(pages) || !pages.length) throw new Error('The measured page plan of this copy is required for printing.');
  return renderStandaloneA4Invoice(projectCopy(model, copy), pages, css, copy);
}

// Resolves when `promise` settles or the shared deadline passes, whichever is first.
function untilDeadline(promise, deadline) {
  const remaining = Math.max(0, deadline - Date.now());
  return Promise.race([
    Promise.resolve(promise).catch(() => {}),
    new Promise(resolve => setTimeout(resolve, remaining)),
  ]);
}

/**
 * Writes the standalone invoice into an already-open window, waits (bounded) for
 * load, fonts and images, then opens the print dialog. Throws if printing cannot
 * start; the caller closes the window and reports a retry message.
 */
export async function printToWindow(printWindow, html, { waitMs = 2000 } = {}) {
  const deadline = Date.now() + waitMs;
  const doc = printWindow?.document;
  if (!doc) throw new Error('Print window is not available.');
  doc.open(); doc.write(html); doc.close();
  if (doc.readyState && doc.readyState !== 'complete' && typeof printWindow.addEventListener === 'function') {
    await untilDeadline(new Promise(resolve => printWindow.addEventListener('load', resolve, { once: true })), deadline);
  }
  if (doc.fonts?.ready) await untilDeadline(doc.fonts.ready, deadline);
  const images = Array.from(doc.images || []);
  await untilDeadline(Promise.all(images.map(image => typeof image?.decode === 'function' ? image.decode().catch(() => {}) : null)), deadline);
  if (printWindow.closed) throw new Error('The print window was closed before printing.');
  printWindow.focus?.();
  if (typeof printWindow.print !== 'function') throw new Error('This browser cannot open the print dialog.');
  printWindow.print();
}
