import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareA4Invoice, projectCopy, sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { renderStandaloneA4Invoice } from '../src/utils/a4InvoiceRender.js';
import { printCopyHtml, printToWindow, startPrint } from '../src/utils/printInvoice.js';
import { planSynthetic } from './helpers/a4Generators.js';

const CSS = '.a4-invoice{}';
const prepared = () => prepareA4Invoice(sampleA4Invoice());
// The measured plan Print/PDF receives from the preview, computed here without a DOM.
const planFor = (model, copy) => planSynthetic(projectCopy(model, copy), copy);

// Minimal fake of a print window: records the written HTML and print calls.
function fakeWindow() {
  const written = [];
  const win = {
    closed: false, printed: 0,
    document: { readyState: 'complete', images: [], open() {}, write(html) { written.push(html); }, close() {} },
    focus() {}, print() { win.printed += 1; },
  };
  return { win, html: () => written.join('') };
}

test('startPrint with warnings never opens a window, for either copy', () => {
  for (const copy of ['buyer', 'driver']) {
    let opened = 0;
    const model = { ...prepared(), warnings: ['Rate missing on row 3'] };
    const start = startPrint({ record: {}, buildModel: () => model, openWindow: () => { opened += 1; return fakeWindow().win; }, copy });
    assert.equal(start.status, 'warnings');
    assert.equal(start.copy, copy);
    assert.deepEqual(start.warnings, ['Rate missing on row 3']);
    assert.equal(opened, 0);
  }
});

test('startPrint returns blocked when the popup is suppressed', () => {
  const model = prepared();
  assert.equal(startPrint({ record: {}, buildModel: () => model, openWindow: () => null, copy: 'driver' }).status, 'blocked');
  assert.equal(startPrint({ record: {}, buildModel: () => model, openWindow: () => { throw new Error('blocked'); } }).status, 'blocked');
});

test('startPrint opens a window for the selected copy and rejects unknown copies before opening', () => {
  const model = prepared();
  const { win } = fakeWindow();
  const start = startPrint({ record: {}, buildModel: () => model, openWindow: () => win, copy: 'driver' });
  assert.equal(start.status, 'opened');
  assert.equal(start.copy, 'driver');
  assert.equal(start.printWindow, win);
  assert.equal(startPrint({ record: {}, buildModel: () => model, openWindow: () => win }).copy, 'buyer');
  let opened = 0;
  assert.throws(() => startPrint({ record: {}, buildModel: () => model, openWindow: () => { opened += 1; return win; }, copy: 'ledger' }), /Unknown bill copy/);
  assert.equal(opened, 0);
});

test('print HTML is the standalone copy rendered from the measured plan it is given', () => {
  const model = prepared();
  for (const copy of ['buyer', 'driver']) {
    const copyModel = projectCopy(model, copy);
    const pages = planFor(model, copy);
    assert.equal(printCopyHtml(model, copy, CSS, pages), renderStandaloneA4Invoice(copyModel, pages, CSS, copy));
  }
});

test('the measured plan is required: no copy is printed from a guessed pagination', () => {
  const model = prepared();
  const pages = planFor(model, 'buyer');
  for (const bad of [undefined, null, [], 'pages', {}]) {
    assert.throws(() => printCopyHtml(model, 'buyer', CSS, bad), /measured page plan/);
  }
  assert.throws(() => printCopyHtml(model, 'seller', CSS, pages), /Unknown bill copy/);
});

test('driver print HTML carries the same pages and no rupee value, and reaches the print dialog', async () => {
  const model = prepared();
  const driverModel = projectCopy(model, 'driver');
  const pages = planFor(model, 'driver');
  const expected = renderStandaloneA4Invoice(driverModel, pages, CSS, 'driver');
  const html = printCopyHtml(model, 'driver', CSS, pages);
  assert.equal(html, expected);
  assert.ok(!html.includes('₹'));
  assert.doesNotMatch(html, /Payment summary|Material total|Net payable|Bank details|Amount in words/);
  assert.equal((html.match(/class="paper sample-sheet"/g) || []).length, pages.length);
  // Header on every page, the continuation note on every page but the last.
  assert.equal((html.match(/<header class="invoice-header">/g) || []).length, pages.length);
  assert.equal((html.match(/class="continuation"/g) || []).length, pages.length - 1);

  const { win, html: written } = fakeWindow();
  const start = startPrint({ record: {}, buildModel: () => model, openWindow: () => win, copy: 'driver' });
  await printToWindow(start.printWindow, printCopyHtml(start.model, start.copy, CSS, pages), { waitMs: 50 });
  assert.equal(written(), expected);
  assert.equal(win.printed, 1);
});
