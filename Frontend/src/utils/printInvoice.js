// Pure decision + window-driving logic for the A4 Print/PDF action.
// Kept free of React and module-level DOM access so it can be unit tested with fakes.

/**
 * Synchronous first step of Print/PDF. Must run inside the user's click handler
 * before any `await`, so the popup blocker sees the window.open as user-initiated.
 * Warnings are checked BEFORE opening, so no window is ever opened and then closed
 * just because the invoice needs review.
 *
 * @returns {{status:'warnings', warnings:string[], model:object}
 *   | {status:'blocked', model:object}
 *   | {status:'opened', model:object, printWindow:Window}}
 */
export function startPrint({ record, buildModel, openWindow }) {
  const model = buildModel(record);
  const warnings = Array.isArray(model?.warnings) ? model.warnings.filter(Boolean).map(String) : [];
  if (warnings.length) return { status: 'warnings', warnings, model };
  let printWindow = null;
  try { printWindow = openWindow(); } catch { printWindow = null; }
  if (!printWindow) return { status: 'blocked', model };
  return { status: 'opened', model, printWindow };
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
