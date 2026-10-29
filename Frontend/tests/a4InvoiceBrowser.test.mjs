/**
 * Real Chromium A4/100% validation; starts an isolated local Vite server, does
 * not contact production services. HTML/PDF/screenshots are written to TEMP,
 * except INVOICE_PUBLISH_SAMPLE=1 also writes the requested sample PDF to public/.
 */
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.INVOICE_ARTIFACT_DIR || path.join(os.tmpdir(), `StoneDesk-A4-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(out, { recursive: true });

async function playwrightDirectory() {
  if (process.env.INTERFACE_PLAYWRIGHT_DIR) return process.env.INTERFACE_PLAYWRIGHT_DIR;
  const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'npm-cache', '_npx');
  for (const item of await readdir(cache, { withFileTypes: true })) {
    const candidate = path.join(cache, item.name, 'node_modules', 'playwright');
    if (existsSync(path.join(candidate, 'index.mjs'))) return candidate;
  }
  throw new Error('Browser validation needs Playwright; set INTERFACE_PLAYWRIGHT_DIR to its installation.');
}

const { chromium } = await import(pathToFileURL(path.join(await playwrightDirectory(), 'index.mjs')).href);
const executable = process.env.INTERFACE_CHROME_PATH || [
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].find(existsSync);
assert.ok(executable, 'Installed Chrome is required.');

async function inspectPdf(bytes, name, expectedPages) {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const pdf = await task.promise;
  assert.equal(pdf.numPages, expectedPages, `${name}: physical A4 page count`);
  const contents = [];
  for (let index = 1; index <= pdf.numPages; index++) {
    const page = await pdf.getPage(index);
    const viewport = page.getViewport({ scale: 1 });
    assert.ok(Math.abs(viewport.width - 595.28) < 1 && Math.abs(viewport.height - 841.89) < 1, `${name}: page ${index} must be A4 portrait`);
    const textItems = (await page.getTextContent()).items;
    const text = textItems.map(item => item.str).join(' ');
    assert.ok(text.length > 80, `${name}: page ${index} must have selectable text`);
    // No per-page footer line. The continuation note belongs on every page but the
    // last, so it is counted afterwards instead of being forbidden here.
    assert.ok(!/Page \d+ of \d+/.test(text), `${name}: page ${index} must not carry a per-page footer`);
    assert.ok(!/All amounts in INR|Dimensions in feet ·/.test(text), `${name}: page ${index} must not carry the footer line`);
    assert.equal(text.includes('Continued on the next page'), index < pdf.numPages, `${name}: page ${index} continuation note`);
    // Text must remain within the printable area, never past the 8 mm margin floor.
    const margin = 8 * 72 / 25.4;
    const outside = textItems.filter(item => item.str.trim() &&
      (item.transform[4] < margin - 1.1 || item.transform[4] + item.width > viewport.width - margin + 1.1));
    assert.deepEqual(outside.map(item => item.str), [], `${name}: page ${index} has clipped or off-margin text`);
    contents.push(text);
    const big = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(Math.ceil(big.width), Math.ceil(big.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: big }).promise;
    await writeFile(path.join(out, `${name}-pdf-page-${index}.png`), canvas.toBuffer('image/png'));
  }
  await task.destroy();
  return contents;
}

function browserFixture() {
  const sample = sampleA4Invoice();
  return { ...sample, mode: 'production', status: 'Dispatched', invoiceNumber: 'TEST-A4-PRODUCTION',
    seller: { name: 'Test stone supplier', location: 'Mock yard', signatoryName: 'Example signatory' } };
}

function varyingFixture(count) {
  const fixture = browserFixture();
  const sample = fixture.groups;
  fixture.groups = Array.from({ length: count }, (_, index) => {
    const original = sample[index % sample.length];
    const length = [1, 2, 4, 7, 3, 5][index % 6];
    const chosen = index % 9 === 0 ? original.entries.filter(entry => entry.type === 'top') : original.entries;
    return { id: index + 1, entries: chosen.slice(0, length).map((entry, j) => ({ ...entry, id: `${index + 1}-${j + 1}` })) };
  });
  return fixture;
}

function oversizedFixture(regular, top) {
  const fixture = browserFixture(), entries = fixture.groups[0].entries;
  fixture.groups = [{ id: 1, entries: [
    ...Array.from({ length: regular }, (_, index) => ({ ...entries[index % 4], id: `r-${index}` })),
    ...Array.from({ length: top }, (_, index) => ({ ...entries[4 + index % 3], id: `t-${index}` })),
  ] }];
  return fixture;
}

async function renderProductionCase(page, base, name, input, options = {}) {
  await page.goto(`${base}/sample_invoice_24_rows.html`, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async data => {
    const [{ prepareA4Invoice }, { measureA4Copy, planA4CopyMeasured }, { renderA4Invoice }] = await Promise.all([
      import('/src/utils/a4InvoiceModel.js'), import('/src/utils/a4InvoiceMeasure.js'), import('/src/utils/a4InvoiceRender.js'),
    ]);
    const model = prepareA4Invoice(data);
    if (model.warnings.length) throw new Error(model.warnings.join(' / '));
    // The one measured plan the app preview, print and PDF share for this copy.
    const { gap, normalCapacity, finalCapacity, pageHeight, headerHeight, noticeHeight, finalHeight } = await measureA4Copy(model, 'buyer');
    const pages = await planA4CopyMeasured(model, 'buyer');
    document.body.innerHTML = renderA4Invoice(model, pages);
    return { pages: pages.length, geometry: { gap, normalCapacity, finalCapacity, pageHeight, headerHeight, noticeHeight, finalHeight },
      columns: pages.map(p => p.columns.map(column => column.map(fragment => ({ id: fragment.group.id, from: fragment.from, to: fragment.to })))),
      summaryPage: pages.findIndex(page => page.final) + 1, expectedEntries: model.groups.reduce((n, group) => n + group.entries.length, 0) };
  }, input);
  assert.ok(result.pages >= 1 && result.summaryPage === result.pages, `${name}: final summary must be on the last page`);
  const inspection = await page.evaluate(() => {
    const sheets = [...document.querySelectorAll('.sample-sheet')];
    return { count: sheets.length,
      entries: document.querySelectorAll('.row-table tr[data-entry-id]').length,
      entryIds: [...document.querySelectorAll('.row-table tr[data-entry-id]')].map(row => row.dataset.entryId),
      groupTotals: document.querySelectorAll('.row-table tr[data-total-row]').length,
      groupCount: new Set([...document.querySelectorAll('.row-block h3')].map(h => h.firstChild.textContent.trim())).size,
      regularSubtotals: document.querySelectorAll('.row-table tr[data-subtotal="regular"]').length,
      topSubtotals: document.querySelectorAll('.row-table tr[data-subtotal="top"]').length,
      summaryCount: document.querySelectorAll('.invoice-summary').length,
      signCount: document.querySelectorAll('.closing').length,
      // The reference header sits on page 1; minimal continued header on subsequent pages.
      identityPages: sheets.map(sheet => sheet.querySelectorAll('.invoice-header').length),
      continuedPages: sheets.map(sheet => sheet.querySelectorAll('.invoice-continued-header').length),
      managerFacts: sheets.map(sheet => [...sheet.querySelectorAll('.invoice-facts dt')].filter(dt => dt.textContent.trim() === 'Manager').length),
      footers: document.querySelectorAll('.page-foot').length,
      // The continuation note sits on every page but the last.
      notes: sheets.map(sheet => sheet.querySelectorAll('.continuation').length),
      finalSections: sheets.map(sheet => sheet.querySelectorAll('.final-section').length),
      sheets: sheets.map(sheet => {
        const sheetRect = sheet.getBoundingClientRect();
        const detail = sheet.querySelector('.detail-columns');
        // Rows must stay above the closing block, or within the sheet when the page has none.
        const closing = sheet.querySelector('.invoice-summary, .closing-totals, .closing');
        const below = closing ? closing.getBoundingClientRect() : { top: sheetRect.bottom };
        const closingElem = sheet.querySelector('.closing');
        const contentBottom = Math.max(detail ? detail.getBoundingClientRect().bottom : 0, closingElem ? closingElem.getBoundingClientRect().bottom : 0);
        const blocks = [...sheet.querySelectorAll('.row-block')];
        const overflowedCells = [...sheet.querySelectorAll('.row-table .num, .settlement dd, .headline-stat dd, .business-name')]
          .filter(cell => cell.scrollWidth > cell.clientWidth + 1).map(cell => cell.textContent.trim()).slice(0, 4);
        const clippedGlyphs = [...sheet.querySelectorAll('.row-table .num, .settlement dd, .headline-stat dd, .business-name')]
          .filter(cell => {
            const range = document.createRange(); range.selectNodeContents(cell);
            const text = range.getBoundingClientRect(), box = cell.getBoundingClientRect();
            return text.left < box.left - 1 || text.right > box.right + 1;
          }).map(cell => cell.textContent.trim()).slice(0, 4);
        return { width: sheetRect.width, height: sheetRect.height, padding: parseFloat(getComputedStyle(sheet).paddingLeft),
          detailWidth: detail ? detail.getBoundingClientRect().width : 0, contentWithinSheet: contentBottom <= sheetRect.bottom + 1,
          groupsClearOfSummary: blocks.every(block => block.getBoundingClientRect().bottom <= below.top + 1),
          columnWidths: detail ? getComputedStyle(detail).gridTemplateColumns.split(' ').map(Number) : [], overflowedCells, clippedGlyphs };
      }) };
  });
  assert.equal(inspection.count, result.pages, `${name}: prepared screen pages`);
  assert.equal(inspection.entries, result.expectedEntries, `${name}: no entry lost or duplicated`);
  assert.equal(new Set(inspection.entryIds).size, inspection.entryIds.length, `${name}: entry IDs unique`);
  assert.equal(inspection.summaryCount, 1);
  assert.equal(inspection.signCount, 1);
  assert.deepEqual(inspection.identityPages, [1, ...Array(result.pages - 1).fill(0)], `${name}: one header on page 1 only`);
  assert.deepEqual(inspection.continuedPages, [0, ...Array(result.pages - 1).fill(1)], `${name}: continued header on page 2+`);
  assert.deepEqual(inspection.managerFacts, [1, ...Array(result.pages - 1).fill(0)], `${name}: the Manager fact on page 1 only`);
  assert.equal(inspection.footers, 0, `${name}: no per-page footer strip`);
  assert.deepEqual(inspection.notes, [...Array(result.pages - 1).fill(1), 0], `${name}: continuation note on every page but the last`);
  assert.deepEqual(inspection.finalSections, [...Array(result.pages - 1).fill(0), 1], `${name}: final section on the last page only`);
  assert.equal(inspection.groupTotals, 0, `${name}: no combined per-group Total row`);
  assert.equal(inspection.regularSubtotals + inspection.topSubtotals > 0, true, `${name}: Reg total / Top total rows are rendered`);
  assert.ok(inspection.sheets.every(sheet => sheet.contentWithinSheet && sheet.groupsClearOfSummary), `${name}: no rows overlapping the closing block or past the sheet: ${JSON.stringify(inspection.sheets)}`);
  assert.ok(inspection.sheets.every(sheet => sheet.height <= 1123.3), `${name}: an A4 sheet grew past its physical page height`);
  // 12 mm or 8 mm margins on a 210 mm sheet
  const mm = 96 / 25.4;
  assert.ok(inspection.sheets.every(sheet => !sheet.detailWidth || ((Math.abs(sheet.padding - 12 * mm) < 0.6 || Math.abs(sheet.padding - 8 * mm) < 0.6) &&
    (Math.abs(sheet.detailWidth - 186 * mm) < 1.5 || Math.abs(sheet.detailWidth - 194 * mm) < 1.5))),
    `${name}: sheets must use valid margins (12mm or 8mm): ${JSON.stringify(inspection.sheets.map(({ padding, detailWidth }) => ({ padding, detailWidth })))}`);
  assert.ok(inspection.sheets.every(sheet => sheet.overflowedCells.length === 0), `${name}: an amount or area overflows its column: ${JSON.stringify(inspection.sheets)}`);
  assert.ok(inspection.sheets.every(sheet => sheet.clippedGlyphs.length === 0), `${name}: numeric glyphs overflow their cells: ${JSON.stringify(inspection.sheets)}`);
  if (options.logoFallback) {
    assert.equal(await page.locator('.logo-placeholder').count(), 1,
      `${name}: the logo area appears once, in the page 1 identity block`);
    assert.equal(await page.locator('.sample-sheet').first().locator('.invoice-header .logo-placeholder').count(), 1,
      `${name}: the logo area sits on page 1`);
  }
  if (options.summaryOnly) assert.deepEqual(result.columns.at(-1), [[], [], []], `${name}: needs a dedicated summary page`);
  if (options.oversized) {
    assert.ok(result.columns.flatMap(p => p.flat()).filter(part => part.id === 1).length > 1, `${name}: the oversized group must repeat its heading`);
    assert.equal(inspection.regularSubtotals, 1, `${name}: the split group shows one Reg total row, with its last Regular entry`);
    assert.equal(inspection.topSubtotals, 1, `${name}: the split group shows one Top total row, on its last fragment only`);
  }
  if (options.shot) for (let i = 1; i <= result.pages; i++) await page.locator('.sample-sheet').nth(i - 1).screenshot({ path: path.join(out, `${name}-screen-page-${i}.png`) });
  const bytes = await page.pdf({ format: 'A4', preferCSSPageSize: true, scale: 1, printBackground: true, displayHeaderFooter: false,
    margin: { top: '0', right: '0', bottom: '0', left: '0' } });
  await writeFile(path.join(out, `${name}.pdf`), bytes);
  const pageText = await inspectPdf(bytes, name, result.pages);
  assert.equal(pageText.filter(text => text.includes('NET PAYABLE')).length, 1, `${name}: PDF summary exactly once`);
  if (name === 'long-identity-and-money') {
    const all = pageText.join(' ');
    assert.ok(all.includes('Material total') && !all.includes('Top material amount') && !/Rates? \/ sq ft/.test(all), 'Printed payment summary shows one Material total line and no rate row');
  }
  // The main header is on page 1; subsequent pages have minimal Continued label.
  const squashed = text => text.replace(/\s+/g, '').toUpperCase();
  assert.ok(squashed(pageText[0]).includes('MANAGER'), `${name}: page 1 PDF carries the Manager fact`);
  for (let i = 1; i < pageText.length; i++) {
    assert.ok(squashed(pageText[i]).includes('CONTINUED'), `${name}: page ${i + 1} PDF carries the Continued label`);
    assert.ok(!squashed(pageText[i]).includes('MANAGER'), `${name}: page ${i + 1} PDF does not repeat the Manager fact`);
  }
  assert.ok(!/Regular subtotal|Top subtotal/.test(pageText.join(' ')), `${name}: PDF uses the Reg total / Top total wording`);
  console.log('CASE', name, JSON.stringify({ pages: result.pages, entries: inspection.entries, summaryPage: result.summaryPage,
    groups: result.columns.map(columns => columns.map(column => column.map(part => part.id))), geometry: result.geometry }));
  return result;
}

async function main() {
  const vite = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false });
  let browser;
  try {
    await vite.listen();
    const base = `http://127.0.0.1:${vite.httpServer.address().port}`;
    browser = await chromium.launch({ executablePath: executable, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
    page.on('pageerror', error => { throw error; });
    await page.goto(`${base}/sample_invoice_24_rows.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // The agreed distribution (.agents/tasks/reference-invoice-format FEAT-000): two A4
    // pages, groups 1-15 as 5/5/5, then 16-24 as 3/3/3 with the final section.
    const SAMPLE_PAGES = 2;
    assert.equal(await page.locator('.sample-sheet').count(), SAMPLE_PAGES);
    const sampleLayout = await page.evaluate(() => [...document.querySelectorAll('.sample-sheet')].map(sheet => {
      const columns = [...sheet.querySelectorAll('.detail-column')];
      const sheetRect = sheet.getBoundingClientRect();
      const closing = sheet.querySelector('.invoice-summary');
      const area = closing ? closing.getBoundingClientRect() : { top: sheetRect.bottom };
      const last = (sheet.querySelector('.closing') || sheet.querySelector('.detail-columns')).getBoundingClientRect();
      return { groups: columns.map(column => [...column.querySelectorAll('.row-block h3')].map(h => Number(h.firstChild.textContent.trim()))),
        columns: getComputedStyle(sheet.querySelector('.detail-columns')).gridTemplateColumns,
        identity: sheet.querySelectorAll('.invoice-header').length,
        continued: sheet.querySelectorAll('.invoice-continued-header').length,
        footers: sheet.querySelectorAll('.page-foot').length,
        notes: sheet.querySelectorAll('.continuation').length, finals: sheet.querySelectorAll('.final-section').length,
        width: sheetRect.width, height: sheetRect.height, contentBottom: last.bottom - sheetRect.top,
        overflow: columns.some(column => [...column.querySelectorAll('.row-block')].some(block => block.getBoundingClientRect().bottom > area.top + 1)) };
    }));
    assert.deepEqual(sampleLayout.map(item => item.groups), [
      [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12, 13, 14, 15], [16, 17, 18, 19, 20]],
      [[21], [22], [23], [24]],
    ]);
    assert.ok(sampleLayout.every(item => !item.overflow));
    assert.deepEqual(sampleLayout.map(item => item.identity), [1, 0], 'Sample header on page 1 only');
    assert.deepEqual(sampleLayout.map(item => item.continued), [0, 1], 'Minimal continued header on page 2');
    assert.deepEqual(sampleLayout.map(item => item.notes), [...Array(SAMPLE_PAGES - 1).fill(1), 0], 'Continuation note on every sample page but the last');
    assert.deepEqual(sampleLayout.map(item => item.finals), [...Array(SAMPLE_PAGES - 1).fill(0), 1], 'Final section on the last sample page only');
    assert.ok(sampleLayout.every(item => item.footers === 0 && item.contentBottom <= item.height + 1), 'Sample pages carry no footer and stay within the sheet');
    for (let i = 1; i <= SAMPLE_PAGES; i++) await page.locator('.sample-sheet').nth(i - 1).screenshot({ path: path.join(out, `sample-screen-page-${i}.png`) });
    const pdfBytes = await page.pdf({ format: 'A4', preferCSSPageSize: true, scale: 1, printBackground: true, displayHeaderFooter: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    const pdfPath = process.env.INVOICE_PUBLISH_SAMPLE === '1'
      ? path.join(root, 'public/sample_invoice_24_rows.pdf') : path.join(out, 'sample_invoice_24_rows.pdf');
    await writeFile(pdfPath, pdfBytes);
    const sampleText = await inspectPdf(pdfBytes, 'sample', SAMPLE_PAGES);
    // Letter-spaced uppercase headings extract as split glyphs ("PAY M E N T"), so compare without spaces.
    assert.equal(sampleText.filter(text => text.replace(/\s+/g, '').includes('PAYMENTSUMMARY')).length, 1);
    assert.equal(sampleText.filter(text => text.toUpperCase().includes('RUPEES TWO LAKH')).length, 1);
    assert.equal(sampleText.filter(text => text.toUpperCase().replace(/\s+/g, '').includes('NOTVALIDFORPAYMENT')).length, 1);
    // Unified summary: one Material total and Net payable (no Regular/Top amount split).
    assert.ok(['₹221,515.00', '₹222,015.00'].every(amount => sampleText.at(-1).includes(amount)),
      'All final payment amounts must remain selectable and legible in the PDF');
    console.log('SAMPLE', JSON.stringify({ pages: sampleText.length, layout: sampleLayout, pdf: pdfPath }));
    if (process.env.INVOICE_REFERENCE_PDF) {
      await inspectPdf(await readFile(process.env.INVOICE_REFERENCE_PDF), 'approved-reference', SAMPLE_PAGES);
      for (let index = 1; index <= SAMPLE_PAGES; index++) {
        const reference = await readFile(path.join(out, `approved-reference-pdf-page-${index}.png`));
        const recreated = await readFile(path.join(out, `sample-pdf-page-${index}.png`));
        assert.ok(reference.equals(recreated), `Page ${index} must match the approved PDF pixel for pixel`);
      }
      console.log('REFERENCE_PDF', process.env.INVOICE_REFERENCE_PDF);
    }

    // Exercise the actual vector exporter, not just Chrome's print-to-PDF path.
    for (const copy of ['buyer', 'driver']) for (const tier of ['pass3', 'pass4']) {
      const probe = await page.evaluate(async ({ input, copy, tier }) => {
        const { prepareA4Invoice, projectCopy } = await import('/src/utils/a4InvoiceModel.js');
        const { measureA4Copy, mountA4Host } = await import('/src/utils/a4InvoiceMeasure.js');
        const { planFromMeasurements } = await import('/src/utils/a4InvoicePagination.js');
        const { renderA4MeasureSheet, renderA4Invoice } = await import('/src/utils/a4InvoiceRender.js');
        const { a4InvoicePdf } = await import('/src/utils/a4InvoicePdf.js');
        const model = projectCopy(prepareA4Invoice(input), copy);
        const measured = await measureA4Copy(model, copy, { tier, columnCount: 4 });
        const pages = planFromMeasurements(model, measured.units, { ...measured, singlePageOnly: true }, { columns: 4 }).map(p => ({ ...p, tier }));
        const geometry = host => {
          const sheet = host.querySelector('.sample-sheet');
          return { padding: parseFloat(getComputedStyle(sheet).paddingLeft), width: sheet.querySelector('.detail-columns').getBoundingClientRect().width,
            font: parseFloat(getComputedStyle(sheet.querySelector('.row-table')).fontSize) };
        };
        const planning = mountA4Host(document, renderA4MeasureSheet(model, copy, measured.units, 'probe', tier, 4));
        const planningGeometry = geometry(planning); planning.remove();
        document.body.innerHTML = renderA4Invoice(model, pages, copy);
        const previewGeometry = geometry(document);
        let exportGeometry;
        const append = document.body.appendChild;
        document.body.appendChild = function(node) {
          const result = append.call(this, node);
          if (node.querySelector?.('.row-table')) exportGeometry = geometry(node);
          return result;
        };
        let pdf;
        try { pdf = await a4InvoicePdf(model, pages, copy); }
        finally { document.body.appendChild = append; }
        return { planningGeometry, previewGeometry, exportGeometry, pages: pages.length,
          reclaimed: measured.continuationFinalCapacity > measured.finalCapacity,
          finalRows: pages.at(-1).columns.flat().length,
          bytes: Array.from(new Uint8Array(await pdf.blob.arrayBuffer())) };
      }, { input: oversizedFixture(80, 20), copy, tier });
      assert.deepEqual(probe.exportGeometry, probe.planningGeometry, `${copy}/${tier}: PDF/planning geometry`);
      assert.deepEqual(probe.previewGeometry, probe.planningGeometry, `${copy}/${tier}: preview/planning geometry`);
      assert.ok(Math.abs(probe.exportGeometry.padding - 8 * 96 / 25.4) < .1);
      assert.ok(probe.exportGeometry.font >= 10, 'Minimum 7.5pt measurement font');
      assert.ok(probe.reclaimed && probe.finalRows > 0);
      const bytes = new Uint8Array(probe.bytes);
      await writeFile(path.join(out, `${copy}-${tier}-vector.pdf`), bytes);
      const text = await inspectPdf(bytes, `${copy}-${tier}-vector`, probe.pages);
      assert.equal(text.join(' ').replace(/\s/g, '').includes('NETPAYABLE'), copy === 'buyer');
      const printed = await page.pdf({ format: 'A4', preferCSSPageSize: true, scale: 1, printBackground: true, displayHeaderFooter: false });
      const printText = await inspectPdf(printed, `${copy}-${tier}-print`, probe.pages);
      // Chrome paints flex siblings in a different PDF extraction order. Compare
      // per-page glyph counts; DOM assertions separately verify serial/row order.
      const glyphs = value => [...value.replace(/\s/g, '')].sort().join('');
      assert.deepEqual(text.map(glyphs), printText.map(glyphs), `${copy}/${tier}: identical text on each generated/printed page`);
      console.log('VECTOR', copy, tier, probe.pages, JSON.stringify(probe.exportGeometry));
    }

    // Exercise saved unit/mixed inventory through the same model, preview and real PDF exporter.
    for (const kind of ['unit', 'mixed']) for (const copy of ['buyer', 'driver']) {
      const result = await page.evaluate(async ({ kind, copy }) => {
        const { a4InvoiceFromDispatch, projectCopy } = await import('/src/utils/a4InvoiceModel.js');
        const { planA4CopyMeasured } = await import('/src/utils/a4InvoiceMeasure.js');
        const { renderA4Invoice } = await import('/src/utils/a4InvoiceRender.js');
        const { a4InvoicePdf } = await import('/src/utils/a4InvoicePdf.js');
        const inventory = [{ stoneType: 'Ceramic basin', finish: '', rateUnit: 'UNIT', ratePerSqFt: 2500, measurementRows: [{ rowNo: 1, quantity: 5, category: 'Regular', lineTotal: 12500 }] }];
        if (kind === 'mixed') inventory.push({ stoneType: 'Granite', finish: 'Polished', ratePerSqFt: 40, measurementRows: [{ rowNo: 2, lengthFt: 3, widthFt: 2, quantity: 19, category: 'Regular', lineTotal: 4560 }] });
        const model = projectCopy(a4InvoiceFromDispatch({ inventory, status: 'Dispatched', date: '2026-10-22', dispatchSlipNumber: 'AUDIT-UNIT', partyName: 'Test buyer', supervisor: 'Manager', logistics: { truckNumber: 'TEST', buyerDestination: 'Yard' }, businessSnapshot: { businessName: 'Test supplier' }, summary: { loadingAndRoyaltyFees: 0 } }), copy);
        const before = JSON.stringify(model);
        const pages = await planA4CopyMeasured(model, copy);
        document.body.innerHTML = renderA4Invoice(model, pages, copy);
        const sheet = document.querySelector('.sample-sheet');
        const pdf = await a4InvoicePdf(model, pages, copy);
        return { anchored: Math.abs(sheet.querySelector('.final-section').getBoundingClientRect().bottom - sheet.querySelector('.page-body').getBoundingClientRect().bottom) < 1, pages: pages.length, text: document.body.innerText, unchanged: before === JSON.stringify(model), fits: sheet.querySelector('.page-body').getBoundingClientRect().bottom <= sheet.getBoundingClientRect().bottom + 1, bytes: Array.from(new Uint8Array(await pdf.blob.arrayBuffer())) };
      }, { kind, copy });
      assert.equal(result.pages, 1); assert.ok(result.fits && result.unchanged && result.anchored);
      assert.match(result.text, /Ceramic basin/);
      assert.equal(result.text.includes('₹'), copy === 'buyer');
      const bytes = new Uint8Array(result.bytes);
      await writeFile(path.join(out, `${kind}-${copy}.pdf`), bytes);
      const text = await inspectPdf(bytes, `${kind}-${copy}`, 1);
      const print = await inspectPdf(await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true }), `${kind}-${copy}-print`, 1);
      const glyphs = values => [...values.join('').replace(/\s/g, '')].sort().join('');
      assert.equal(glyphs(text), glyphs(print));
    }
    for (const copy of ['buyer', 'driver']) {
      const message = await page.evaluate(async ({ input, copy }) => {
        const { prepareA4Invoice, projectCopy } = await import('/src/utils/a4InvoiceModel.js');
        const { planA4CopyMeasured } = await import('/src/utils/a4InvoiceMeasure.js');
        try { await planA4CopyMeasured(projectCopy(prepareA4Invoice(input), copy), copy); return ''; }
        catch (error) { return error.message; }
      }, { input: oversizedFixture(600, 0), copy });
      assert.match(message, /cannot fit on one A4 page/);
    }

    const one = browserFixture(); one.groups = one.groups.slice(0, 1);
    await renderProductionCase(page, base, 'single-group', one, { shot: true });
    const small = varyingFixture(4);
    small.groups[1].entries = small.groups[1].entries.filter(entry => entry.type === 'top');
    if (!small.groups[1].entries.length) small.groups[1].entries = [{ ...sampleA4Invoice().groups[0].entries[4], id: 'top-only' }];
    await renderProductionCase(page, base, 'varying-small', small);
    await renderProductionCase(page, base, 'more-than-24', varyingFixture(37), { shot: true });
    await renderProductionCase(page, base, 'oversized-group', oversizedFixture(96, 18), { shot: true, oversized: true });
    await renderProductionCase(page, base, 'summary-reservation', oversizedFixture(29, 3), { shot: true });

    const long = varyingFixture(2);
    long.seller.name = 'A very long but real stone supplier name for a working yard and every branch location';
    long.invoiceNumber = 'REFERENCE-WITH-NO-TRUNCATION-2026-' + 'ABC123'.repeat(13);
    long.groups[0].entries[0].ratePerSqFt = '25000.25';
    await renderProductionCase(page, base, 'long-identity-and-money', long, { shot: true });
    const largeMoney = varyingFixture(2);
    largeMoney.groups[0].entries[0].ratePerSqFt = '25000000.25';
    await renderProductionCase(page, base, 'billion-scale-line-amount', largeMoney, { shot: true });
    const manyLargeMoney = oversizedFixture(64, 10);
    manyLargeMoney.groups[0].entries.forEach(entry => { entry.ratePerSqFt = '25000000.25'; });
    await renderProductionCase(page, base, 'wrapped-amounts-across-pages', manyLargeMoney, { oversized: true });
    const unreadableLogo = varyingFixture(1);
    unreadableLogo.seller.logo = 'data:image/png;base64,AAAA';
    await renderProductionCase(page, base, 'unreadable-saved-logo', unreadableLogo, { logoFallback: true });

    await page.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], nextCursor: null }) }));
    await page.goto(`${base}/sample_invoice_24_rows.html`);
    await page.evaluate(async () => {
      const { default: RefreshRuntime } = await import('/@react-refresh');
      RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const { default: React } = await import('/node_modules/.vite/deps/react.js'); const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { default: LoadingListScreen } = await import('/src/components/LoadingListScreen.jsx');
      document.body.innerHTML = '<div id="loading-audit"></div>';
      ReactDOM.createRoot(document.getElementById('loading-audit')).render(React.createElement(LoadingListScreen, { onClose() {}, settings: { stoneRates: [], savedDestinations: [] } }));
    });
    await page.getByLabel('Product type', { exact: true }).selectOption('UNIT');
    assert.equal(await page.locator('#requirement-length').count(), 0);
    await page.locator('#requirement-quantity').fill('2');
    await page.getByRole('button', { name: 'Add Requirement', exact: true }).click();
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Load unit', exact: true }).click();
    await page.getByText('1 Excess', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Custom', exact: true }).count(), 0);
    await page.getByRole('button', { name: /^Edit .*units$/ }).click();
    await page.locator('#requirement-quantity').fill('5');
    await page.getByRole('button', { name: 'Update requirement', exact: true }).click();
    await page.getByText('2 items', { exact: true }).waitFor();
    await page.unroute('**/api/**');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/sample_invoice_24_rows.html`, { waitUntil: 'domcontentloaded' });
    const mobile = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
      columns: getComputedStyle(document.querySelector('.detail-columns')).gridTemplateColumns.split(' ').length,
      offenders: [...document.body.querySelectorAll('*')].filter(element => element.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 10).map(element => ({ tag: element.tagName, className: element.getAttribute('class'), right: Math.round(element.getBoundingClientRect().right) })) }));
    console.log('MOBILE GEOMETRY', JSON.stringify(mobile));
    assert.ok(mobile.scroll <= mobile.client + 1, 'Mobile screen preview must not cause page-wide horizontal scrolling.');
    assert.equal(mobile.columns, 4, 'Mobile preview retains the four-column printable canvas.');
    const mobileBounds = await page.locator('.sample-sheet').evaluateAll(sheets => sheets.map(sheet => { const r = sheet.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, contentBottom: sheet.querySelector('.page-body').getBoundingClientRect().bottom }; }));
    mobileBounds.forEach((bounds, i) => { assert.ok(bounds.contentBottom <= bounds.bottom + 1); if (i) assert.ok(bounds.top >= mobileBounds[i - 1].bottom + 19, 'Mobile sheets must not overlap'); });
    const mobilePdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, scale: 1, printBackground: true, displayHeaderFooter: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    await inspectPdf(mobilePdf, 'mobile-print-still-a4', SAMPLE_PAGES);
    console.log('MOBILE', JSON.stringify(mobile));
  } finally { await browser?.close(); await vite.close(); }
  console.log(`A4 artifacts: ${out}`);
}

await main();