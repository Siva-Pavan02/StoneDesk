import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { jsPDF } from 'jspdf';
import { INVOICE_FONT_FACES, pdfFontStyle } from '../src/utils/a4InvoiceFonts.js';
import { arrayBufferToBase64, loadInvoicePdfFonts } from '../src/utils/a4InvoicePdfFonts.js';
import { a4InvoicePdf, collectA4PdfPages, paintA4Pdf } from '../src/utils/a4InvoicePdf.js';
import { prepareA4Invoice, projectCopy, sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { testLogo } from './invoiceFixtures.js';

// Vector PDF export: the embedded Noto Sans faces, the jsPDF painter and the
// orchestrator's guards. The DOM collector itself needs a browser and is
// checked in tests/a4InvoiceBrowser.test.mjs; here the painter is fed synthetic
// operations of the same shape collectA4PdfPages produces.

const FONT_DIR = new URL('../public/fonts/', import.meta.url);
const fontBytes = face => readFileSync(new URL(face.file, FONT_DIR));
const fontFaces = () => INVOICE_FONT_FACES.map(face => ({ ...face, base64: fontBytes(face).toString('base64') }));

const A4_POINTS = { width: 595.28, height: 841.89 };
const ink = [36, 36, 36];

function textOp(text, x, y, options = {}) {
  return { type: 'text', text, x, y, size: 8, style: 'normal', color: ink, charSpace: 0, width: null, words: [], ...options };
}

async function readPdf(doc) {
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  const raw = Buffer.from(bytes).toString('latin1');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // pdf.js takes ownership of the buffer it is given, so it reads a copy.
  const file = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false, isEvalSupported: false }).promise;
  const pages = [];
  for (let number = 1; number <= file.numPages; number++) {
    const page = await file.getPage(number);
    const content = await page.getTextContent();
    const operators = await page.getOperatorList();
    pages.push({
      viewport: page.getViewport({ scale: 1 }),
      // pdf.js synthesises whitespace items between runs; only drawn runs matter.
      items: content.items.filter(item => /\S/.test(item.str || '')).map(item => ({ text: item.str, x: item.transform[4], y: item.transform[5] })),
      text: content.items.map(item => item.str).join(' '),
      images: operators.fnArray.filter(fn => fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject || fn === pdfjs.OPS.paintJpegXObject).length,
    });
  }
  return { pages, raw };
}

test('the embedded invoice faces exist and cover the invoice glyphs', () => {
  const license = readFileSync(new URL('OFL.txt', FONT_DIR), 'utf8');
  assert.match(license, /SIL Open Font License/);
  assert.equal(INVOICE_FONT_FACES.length, 3);
  for (const face of INVOICE_FONT_FACES) {
    const bytes = fontBytes(face);
    assert.ok(bytes.length > 100_000, `${face.file} is a real font file`);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.addFileToVFS(face.file, bytes.toString('base64'));
    doc.addFont(face.file, 'InvoiceSans', face.style);
    doc.setFont('InvoiceSans', face.style);
    const codeMap = doc.getFont().metadata.cmap.unicode.codeMap;
    for (const glyph of ['₹', '×', '=', '¼', '½', '¾', '·', '—', '’', '0', '9', 'M']) {
      assert.ok(codeMap[glyph.codePointAt(0)] > 0, `${face.file} has a glyph for ${glyph}`);
    }
  }
});

test('pdfFontStyle maps CSS weights to the three embedded faces', () => {
  assert.equal(pdfFontStyle(400), 'normal');
  assert.equal(pdfFontStyle('500'), 'normal');
  assert.equal(pdfFontStyle(600), 'semibold');
  assert.equal(pdfFontStyle(700), 'bold');
  assert.equal(pdfFontStyle('800'), 'bold');
  assert.equal(pdfFontStyle('bold'), 'bold');
  assert.equal(pdfFontStyle('normal'), 'normal');
});

test('arrayBufferToBase64 round-trips font bytes', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 65, 66]);
  assert.equal(arrayBufferToBase64(bytes), Buffer.from(bytes).toString('base64'));
  assert.equal(arrayBufferToBase64(bytes.buffer), Buffer.from(bytes).toString('base64'));
  const long = new Uint8Array(70_000).map((_, index) => index % 251);
  assert.equal(arrayBufferToBase64(long), Buffer.from(long).toString('base64'));
});

test('loadInvoicePdfFonts caches the faces and clears the cache after a failure', async () => {
  let calls = 0;
  const failing = async () => { calls++; return { ok: false, status: 404 }; };
  await assert.rejects(loadInvoicePdfFonts({ fetchImpl: failing }), /could not be loaded \(404\)/);
  assert.equal(calls, INVOICE_FONT_FACES.length, 'every face was attempted');

  const requested = [];
  const succeeding = async url => {
    requested.push(url);
    return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  const loaded = await loadInvoicePdfFonts({ fetchImpl: succeeding, base: '/fonts/' });
  assert.deepEqual(requested, INVOICE_FONT_FACES.map(face => `/fonts/${face.file}`));
  assert.deepEqual(loaded.map(face => face.style), ['normal', 'semibold', 'bold']);
  assert.equal(loaded[0].base64, Buffer.from([1, 2, 3]).toString('base64'));
  assert.equal(await loadInvoicePdfFonts({ fetchImpl: succeeding }), loaded, 'the second call is cached');
  assert.equal(requested.length, INVOICE_FONT_FACES.length, 'nothing was fetched twice');
});

test('paintA4Pdf writes selectable A4 pages with the rupee sign and the invoice glyphs', async () => {
  const model = prepareA4Invoice(sampleA4Invoice());
  const doc = paintA4Pdf([
    [
      textOp('Manager', 20, 20, { style: 'semibold' }),
      textOp('3½ × 4½ = 3', 20, 30),
      textOp('Continued on the next page.', 20, 40, { size: 6.5, color: [102, 102, 102] }),
    ],
    [
      textOp('Material total', 20, 20),
      textOp('₹221,515.00', 60, 20, { style: 'semibold', size: 10.5 }),
      textOp('Net payable', 20, 30, { style: 'bold' }),
      textOp('₹222,015.00', 60, 30, { style: 'bold', size: 15 }),
      textOp(model.amountWords, 20, 40),
    ],
  ], fontFaces(), { title: 'Buyer invoice - SAMPLE-024' });
  const { pages, raw } = await readPdf(doc);

  assert.equal(pages.length, 2);
  for (const page of pages) {
    assert.ok(Math.abs(page.viewport.width - A4_POINTS.width) < 1, 'A4 width');
    assert.ok(Math.abs(page.viewport.height - A4_POINTS.height) < 1, 'A4 height');
    assert.equal(page.images, 0, 'no rasterised page');
  }
  assert.match(pages[0].text, /Manager/);
  assert.match(pages[0].text, /3½ × 4½ = 3/);
  assert.match(pages[1].text, /₹221,515\.00/);
  assert.match(pages[1].text, /₹222,015\.00/);
  assert.ok(pages[1].text.includes(model.amountWords), 'the amount in words is selectable text');
  assert.match(raw, /\/FontFile2/, 'the faces are embedded');
  assert.doesNotMatch(raw, /\/Subtype\s*\/Image/, 'no image objects at all');
});

test('paintA4Pdf places text at the collected millimetre positions', async () => {
  const doc = paintA4Pdf([[textOp('Reg total', 12, 24)]], fontFaces());
  const { pages } = await readPdf(doc);
  const [item] = pages[0].items;
  assert.equal(item.text, 'Reg total');
  // 12 mm from the left edge, 24 mm below the top edge, in PDF points.
  assert.ok(Math.abs(item.x - 12 * 72 / 25.4) < 0.5, `x ${item.x}`);
  assert.ok(Math.abs(item.y - (297 - 24) * 72 / 25.4) < 0.5, `y ${item.y}`);
});

test('paintA4Pdf falls back to per-word placement when the measured width differs', async () => {
  const words = [{ text: 'Total', x: 20 }, { text: 'pieces', x: 60 }];
  const matching = paintA4Pdf([[textOp('Total pieces', 20, 20, { width: null, words })]], fontFaces());
  assert.equal((await readPdf(matching)).pages[0].items.length, 1, 'one run when no width was measured');

  const drifted = paintA4Pdf([[textOp('Total pieces', 20, 20, { width: 48, words })]], fontFaces());
  const items = (await readPdf(drifted)).pages[0].items;
  assert.deepEqual(items.map(item => item.text), ['Total', 'pieces']);
  assert.ok(Math.abs(items[0].x - 20 * 72 / 25.4) < 0.5, `first word at its own x (${items[0].x})`);
  assert.ok(Math.abs(items[1].x - 60 * 72 / 25.4) < 0.5, `second word at its own x (${items[1].x})`);
});

test('paintA4Pdf draws fills, rules, rounded and dashed boxes and a logo image', async () => {
  const doc = paintA4Pdf([[
    { type: 'rect', x: 12, y: 12, w: 186, h: 8, fill: [238, 243, 250] },
    { type: 'rect', x: 12, y: 24, w: 186, h: 0.26, fill: [221, 221, 221] },
    { type: 'rect', x: 12, y: 30, w: 20, h: 6, stroke: [53, 53, 53], lineWidth: 0.26, radius: 0.8 },
    { type: 'rect', x: 12, y: 40, w: 12, h: 12, stroke: [102, 102, 102], lineWidth: 0.26, radius: 1.3, dash: [0.5, 0.5] },
    { type: 'image', dataUrl: testLogo, format: 'PNG', x: 12, y: 60, w: 12, h: 4.8 },
    textOp('LOGO', 12, 70),
  ]], fontFaces());
  const { pages, raw } = await readPdf(doc);
  assert.equal(pages[0].images, 1, 'exactly one image: the logo');
  assert.match(raw, /\/Subtype\s*\/Image/);
  assert.match(pages[0].text, /LOGO/);
});

test('paintA4Pdf rejects missing fonts and malformed pages', () => {
  assert.throws(() => paintA4Pdf([[textOp('x', 10, 10)]], []), /embedded invoice fonts/);
  assert.throws(() => paintA4Pdf([[textOp('x', 10, 10)]], [{ file: 'NotoSans-Regular.ttf', style: 'normal' }]), /base64/);
  assert.throws(() => paintA4Pdf([], fontFaces()), /one list of drawing operations per page/);
  assert.throws(() => paintA4Pdf([{ type: 'text' }], fontFaces()), /one list of drawing operations per page/);
});

test('collectA4PdfPages needs rendered pages', () => {
  assert.throws(() => collectA4PdfPages([]), /at least one rendered A4 page/);
  assert.throws(() => collectA4PdfPages(null), /at least one rendered A4 page/);
});

test('a4InvoicePdf validates the copy and the shared plan before touching the document', async () => {
  const model = projectCopy(prepareA4Invoice(sampleA4Invoice()), 'buyer');
  const page = { columns: [[], [], []], final: true };
  await assert.rejects(a4InvoicePdf(model, [page], 'seller'), /buyer.*driver/);
  await assert.rejects(a4InvoicePdf(model, null, 'buyer'), /measured page plan/);
  await assert.rejects(a4InvoicePdf(model, [], 'buyer'), /measured page plan/);
  // Node has no document: the export says so instead of producing a broken file.
  await assert.rejects(a4InvoicePdf(model, [page], 'buyer'), /browser document/);
});
