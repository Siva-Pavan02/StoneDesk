import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareA4Invoice, sampleA4Invoice, projectCopy } from '../src/utils/a4InvoiceModel.js';
import { renderA4Invoice } from '../src/utils/a4InvoiceRender.js';
import { planSynthetic } from './helpers/a4Generators.js';

const bill = readFileSync(new URL('../src/components/pilot/BillView.jsx', import.meta.url), 'utf8');

// Req 1.9, 2.3: the bill screen offers exactly the two A4 copies, buyer first and selected on open.
test('BillView offers exactly Buyer invoice PDF and Driver slip PDF, buyer selected on open', () => {
  const options = bill.match(/const COPY_OPTIONS = \[([\s\S]*?)\n\];/);
  assert.ok(options, 'COPY_OPTIONS list is present');
  const values = [...options[1].matchAll(/^\s*\['(\w+)', '([^']+)'/gm)].map(match => [match[1], match[2]]);
  assert.deepEqual(values, [['buyer', 'Buyer invoice PDF'], ['driver', 'Driver slip PDF']]);
  assert.match(bill, /useState\('buyer'\)/);
  assert.doesNotMatch(bill, /excel|xlsx|\.html'|value="pdf"/i);
});

// Req 1.9, 2.1, 2.2, 2.4: one measured A4 plan per copy drives preview, print and PDF.
test('BillView drives preview, PDF and print from the selected copy through the A4 engine', () => {
  assert.doesNotMatch(bill, /driverPdf|buyerExcel|pilotExports/);
  assert.match(bill, /projectCopy\(model, copy\)/);
  // The measured planner, awaited once per copy, never the superseded deterministic one.
  assert.match(bill, /await planA4CopyMeasured\(copyModel, copy\)/);
  assert.doesNotMatch(bill, /planA4Copy\(/);
  assert.match(bill, /renderA4Invoice\(preview\.copies\[copy\]\.model, preview\.copies\[copy\]\.pages, copy, previewId\)/);
  // Print and export reuse the preview's plan and only measure when it is not ready yet.
  assert.equal((bill.match(/currentInvoice\?\.preview \|\| await planPreview\(/g) || []).length, 2);
  assert.match(bill, /startPrint\(\{[^}]*copy \}\)/);
  assert.match(bill, /printCopyHtml\(planned\.model, start\.copy, invoiceCss, planned\.copies\[start\.copy\]\.pages\)/);
  // The PDF module (and jsPDF) loads on demand, is awaited, and draws the shared plan.
  assert.match(bill, /await import\('\.\.\/\.\.\/utils\/a4InvoicePdf\.js'\)/);
  assert.match(bill, /await a4InvoicePdf\(copyModel, pages, kind, billFilename\(/);
  assert.doesNotMatch(bill, /^import \{ a4InvoicePdf \}/m);
  // Print blocked falls back to the selected copy's PDF.
  assert.match(bill, /printFallback && [\s\S]*?onClick=\{\(\) => exportFile\(copy\)\}/);
  // Warnings pause export for every copy, before anything is planned or built.
  assert.match(bill, /if \(model\.warnings\.length\) \{ setExportWarnings\(model\.warnings\); return; \}\s*const planned = currentInvoice\?\.preview \|\| await planPreview\(model\);/);
  assert.match(bill, /download did not complete/);
});

// Req 2.1, 2.2: the plan BillView hands to the preview is the one print and the PDF draw.
test('the per-copy plan feeds the preview with the reference page structure', () => {
  const model = prepareA4Invoice(sampleA4Invoice());
  for (const copy of ['buyer', 'driver']) {
    const copyModel = projectCopy(model, copy);
    const pages = planSynthetic(copyModel, copy);
    const html = renderA4Invoice(copyModel, pages, copy, `t-${copy}`);
    assert.equal((html.match(/class="paper sample-sheet"/g) || []).length, pages.length, `${copy} preview pages`);
    assert.equal((html.match(/data-page="/g) || []).length, pages.length, `${copy} numbered pages`);
    // The reference format: a header on every page, the note on every page but the last.
    assert.equal((html.match(/<header class="invoice-header">/g) || []).length, pages.length, `${copy} headers`);
    assert.equal((html.match(/class="continuation"/g) || []).length, pages.length - 1, `${copy} continuation notes`);
    assert.equal((html.match(/class="final-section"/g) || []).length, 1, `${copy} final section`);
    // Every group of the plan is rendered in its planned column, in order.
    const planned = pages.map(page => page.columns.map(column => column.map(fragment => fragment.group.id)));
    const rendered = html.split('<article ').slice(1).map(sheet => sheet.split('<div class="detail-column">').slice(1)
      .map(column => [...column.matchAll(/data-group="([^"]+)"/g)].map(match => Number(match[1]))));
    assert.deepEqual(rendered, planned, `${copy} rendered columns follow the plan`);
  }
});
