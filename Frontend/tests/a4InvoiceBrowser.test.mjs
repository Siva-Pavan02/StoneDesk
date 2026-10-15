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
    assert.ok(text.includes(`Page ${index} of ${pdf.numPages}`), `${name}: page ${index} footer is missing`);
    // Chrome positions glyphs a fraction of a point beyond the CSS margin;
    // text must still remain in the printable area, never past the paper edge.
    const margin = 12 * 72 / 25.4;
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
    const [{ prepareA4Invoice }, { paginateA4Invoice }, { renderA4Invoice }] = await Promise.all([
      import('/src/utils/a4InvoiceModel.js'), import('/src/utils/a4InvoicePagination.js'), import('/src/utils/a4InvoiceRender.js'),
    ]);
    const invoice = prepareA4Invoice(data);
    if (invoice.warnings.length) throw new Error(invoice.warnings.join(' / '));
    const { model, pages, geometry } = await paginateA4Invoice(invoice);
    document.body.innerHTML = renderA4Invoice(model, pages);
    return { pages: pages.length, geometry, columns: pages.map(p => p.columns.map(column => column.map(fragment => ({ id: fragment.group.id, from: fragment.from, to: fragment.to })))),
      summaryPage: pages.findIndex(page => page.summary) + 1, expectedEntries: model.groups.reduce((n, group) => n + group.entries.length, 0) };
  }, input);
  assert.ok(result.pages >= 1 && result.summaryPage === result.pages, `${name}: final summary must be on the last page`);
  const inspection = await page.evaluate(() => {
    const sheets = [...document.querySelectorAll('.sample-sheet')];
    return { count: sheets.length,
      entries: document.querySelectorAll('.row-table tr[data-entry-id]').length,
      entryIds: [...document.querySelectorAll('.row-table tr[data-entry-id]')].map(row => row.dataset.entryId),
      groupTotals: document.querySelectorAll('.row-table tr.total').length,
      regularSubtotals: document.querySelectorAll('.row-table tr[data-subtotal="regular"]').length,
      summaryCount: document.querySelectorAll('.invoice-summary').length,
      signCount: document.querySelectorAll('.closing').length,
      allRefsVisible: [...document.querySelectorAll('.invoice-reference')].every(node => node.textContent.includes(document.querySelector('.invoice-reference').textContent)),
      sheets: sheets.map(sheet => {
        const sheetRect = sheet.getBoundingClientRect();
        const detail = sheet.querySelector('.detail-columns');
        const below = sheet.querySelector('.invoice-summary, .continuation').getBoundingClientRect();
        const foot = sheet.querySelector('.page-foot').getBoundingClientRect();
        const blocks = [...sheet.querySelectorAll('.row-block')];
        const overflowedCells = [...sheet.querySelectorAll('.row-table .num, .settlement dd, .headline-stat dd')]
          .filter(cell => cell.scrollWidth > cell.clientWidth + 1).map(cell => cell.textContent.trim()).slice(0, 4);
        const clippedGlyphs = [...sheet.querySelectorAll('.row-table .num, .settlement dd, .headline-stat dd')]
          .filter(cell => {
            const range = document.createRange(); range.selectNodeContents(cell);
            const text = range.getBoundingClientRect(), box = cell.getBoundingClientRect();
            return text.left < box.left - 1 || text.right > box.right + 1;
          }).map(cell => cell.textContent.trim()).slice(0, 4);
        return { width: sheetRect.width, height: sheetRect.height, footerWithinSheet: foot.bottom <= sheetRect.bottom + 1,
          groupsClearOfSummary: blocks.every(block => block.getBoundingClientRect().bottom <= below.top + 1),
          columnWidths: getComputedStyle(detail).gridTemplateColumns.split(' ').map(Number), overflowedCells, clippedGlyphs };
      }) };
  });
  assert.equal(inspection.count, result.pages, `${name}: prepared screen pages`);
  assert.equal(inspection.entries, result.expectedEntries, `${name}: no entry lost or duplicated`);
  assert.equal(new Set(inspection.entryIds).size, inspection.entryIds.length, `${name}: entry IDs unique`);
  assert.equal(inspection.summaryCount, 1);
  assert.equal(inspection.signCount, 1);
  assert.ok(inspection.allRefsVisible, `${name}: full reference repeated on each page`);
  assert.ok(inspection.sheets.every(sheet => sheet.footerWithinSheet && sheet.groupsClearOfSummary), `${name}: no overlapping summary or footer: ${JSON.stringify(inspection.sheets)}`);
  assert.ok(inspection.sheets.every(sheet => sheet.height <= 1123.3), `${name}: an A4 sheet grew past its physical page height`);
  assert.ok(inspection.sheets.every(sheet => sheet.overflowedCells.length === 0), `${name}: an amount or area overflows its column: ${JSON.stringify(inspection.sheets)}`);
  assert.ok(inspection.sheets.every(sheet => sheet.clippedGlyphs.length === 0), `${name}: numeric glyphs overflow their cells: ${JSON.stringify(inspection.sheets)}`);
  if (options.logoFallback) {
    assert.equal(await page.locator('.logo-placeholder[aria-label="Business logo placeholder"]').count(), result.pages,
      `${name}: an unreadable saved logo must use the printed placeholder on every page`);
  }
  if (options.summaryOnly) assert.deepEqual(result.columns.at(-1), [[], [], []], `${name}: needs a dedicated summary page`);
  if (options.oversized) {
    assert.ok(result.columns.flatMap(p => p.flat()).filter(part => part.id === 1).length > 1, `${name}: the oversized group must repeat its heading`);
    assert.equal(inspection.groupTotals, 0, `${name}: rows show Regular / Top subtotals, not a combined row total`);
    assert.equal(inspection.regularSubtotals, 1, `${name}: the Regular subtotal must not repeat on continuation fragments`);
  }
  if (options.shot) for (let i = 1; i <= result.pages; i++) await page.locator('.sample-sheet').nth(i - 1).screenshot({ path: path.join(out, `${name}-screen-page-${i}.png`) });
  const bytes = await page.pdf({ format: 'A4', preferCSSPageSize: true, scale: 1, printBackground: true, displayHeaderFooter: false,
    margin: { top: '0', right: '0', bottom: '0', left: '0' } });
  await writeFile(path.join(out, `${name}.pdf`), bytes);
  const pageText = await inspectPdf(bytes, name, result.pages);
  assert.equal(pageText.filter(text => text.includes('NET PAYABLE')).length, 1, `${name}: PDF summary exactly once`);
  if (name === 'long-identity-and-money') {
    assert.ok(pageText.join(' ').includes('Top material amount') && !/Rates? \/ sq ft/.test(pageText.join(' ')), 'Printed payment summary shows the material / top split and no rate row');
  }
  if (options.oversized) assert.equal(pageText.join(' ').match(/Regular subtotal/g)?.length, 1);
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
    assert.equal(await page.locator('.sample-sheet').count(), 3);
    const sampleLayout = await page.evaluate(() => [...document.querySelectorAll('.sample-sheet')].map(sheet => {
      const columns = [...sheet.querySelectorAll('.detail-column')];
      const foot = sheet.querySelector('.page-foot').getBoundingClientRect();
      const sheetRect = sheet.getBoundingClientRect();
      const area = sheet.querySelector('.invoice-summary, .continuation').getBoundingClientRect();
      return { groups: columns.map(column => [...column.querySelectorAll('.row-block h3')].map(h => Number(h.firstChild.textContent.trim()))),
        columns: getComputedStyle(sheet.querySelector('.detail-columns')).gridTemplateColumns,
        width: sheetRect.width, height: sheetRect.height, contentBottom: foot.bottom - sheetRect.top,
        overflow: columns.some(column => [...column.querySelectorAll('.row-block')].some(block => block.getBoundingClientRect().bottom > area.top + 1)) };
    }));
    assert.deepEqual(sampleLayout.map(item => item.groups), [
      [[1, 2, 3], [4, 5, 6], [7, 8, 9]], [[10, 11, 12], [13, 14, 15], [16, 17, 18]], [[19, 20], [21, 22], [23, 24]],
    ]);
    assert.ok(sampleLayout.every(item => !item.overflow));
    for (let i = 1; i <= 3; i++) await page.locator('.sample-sheet').nth(i - 1).screenshot({ path: path.join(out, `sample-screen-page-${i}.png`) });
    const pdfBytes = await page.pdf({ format: 'A4', preferCSSPageSize: true, scale: 1, printBackground: true, displayHeaderFooter: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    const pdfPath = process.env.INVOICE_PUBLISH_SAMPLE === '1'
      ? path.join(root, 'public/sample_invoice_24_rows.pdf') : path.join(out, 'sample_invoice_24_rows.pdf');
    await writeFile(pdfPath, pdfBytes);
    const sampleText = await inspectPdf(pdfBytes, 'sample', 3);
    assert.equal(sampleText.filter(text => text.includes('PAYMENT SUMMARY')).length, 1);
    assert.equal(sampleText.filter(text => text.includes('Rupees Two Lakh')).length, 1);
    assert.equal(sampleText.filter(text => text.includes('Not valid for payment')).length, 1);
    assert.ok(['₹126,580.00', '₹94,935.00', '₹222,015.00'].every(amount => sampleText[2].includes(amount)),
      'All final payment amounts must remain selectable and legible in the PDF');
    console.log('SAMPLE', JSON.stringify({ pages: sampleText.length, layout: sampleLayout, pdf: pdfPath }));
    if (process.env.INVOICE_REFERENCE_PDF) {
      await inspectPdf(await readFile(process.env.INVOICE_REFERENCE_PDF), 'approved-reference', 3);
      for (let index = 1; index <= 3; index++) {
        const reference = await readFile(path.join(out, `approved-reference-pdf-page-${index}.png`));
        const recreated = await readFile(path.join(out, `sample-pdf-page-${index}.png`));
        assert.ok(reference.equals(recreated), `Page ${index} must match the approved PDF pixel for pixel`);
      }
      console.log('REFERENCE_PDF', process.env.INVOICE_REFERENCE_PDF);
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

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/sample_invoice_24_rows.html`, { waitUntil: 'domcontentloaded' });
    const mobile = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
      columns: getComputedStyle(document.querySelector('.detail-columns')).gridTemplateColumns.split(' ').length,
      offenders: [...document.body.querySelectorAll('*')].filter(element => element.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 10).map(element => ({ tag: element.tagName, className: element.getAttribute('class'), right: Math.round(element.getBoundingClientRect().right) })) }));
    console.log('MOBILE GEOMETRY', JSON.stringify(mobile));
    assert.ok(mobile.scroll <= mobile.client + 1, 'Mobile screen preview must not cause page-wide horizontal scrolling.');
    assert.equal(mobile.columns, 1, 'Mobile screen preview should stack columns.');
    const mobilePdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, scale: 1, printBackground: true, displayHeaderFooter: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    await inspectPdf(mobilePdf, 'mobile-print-still-a4', 3);
    console.log('MOBILE', JSON.stringify(mobile));
  } finally { await browser?.close(); await vite.close(); }
  console.log(`A4 artifacts: ${out}`);
}

await main();