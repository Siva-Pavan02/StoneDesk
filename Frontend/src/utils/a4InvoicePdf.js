import { jsPDF } from 'jspdf';
import { pdfFontStyle } from './a4InvoiceFonts.js';
import { invoiceFontsReady, mountA4Host } from './a4InvoiceMeasure.js';
import { A4, COPIES } from './a4InvoicePagination.js';
import { loadInvoicePdfFonts } from './a4InvoicePdfFonts.js';
import { renderA4Pages } from './a4InvoiceRender.js';

// Vector PDF of the A4 bill: selectable text, no rasterised pages.
//
// The export renders the shared measured plan (a4InvoicePagination.js, the same
// pages the preview and the print window use) into the offscreen A4 host, reads
// the real element boxes and text runs out of that DOM, and redraws them with
// jsPDF at the measured millimetre positions. The PDF therefore matches the
// preview page for page, line break for line break, instead of re-deriving a
// layout. The embedded Noto Sans faces (a4InvoicePdfFonts.js) are the same
// files the browser renders with, so ₹, ×, = and ¼ ½ ¾ come out right and the
// glyph advances agree with the measured ones.
//
// Three layers, all in this file so the painter stays testable in Node:
//   paintA4Pdf(pages, fonts, { title })  pure jsPDF drawing of collected ops
//   collectA4PdfPages(sheets, opts)      browser: DOM boxes and text runs -> ops
//   a4InvoicePdf(model, pages, copy, filename)  browser orchestrator
//
// Driver copies never read a money field: the markup they draw comes from
// projectCopy(model, 'driver'), which carries no amounts, bank details or words.

const PDF_FONT = 'InvoiceSans';
const PX_TO_MM = 25.4 / 96;
const PT_PER_PX = 0.75;
// A line of text is redrawn word by word when jsPDF's advance differs from the
// browser's by more than this (mm), e.g. where CSS asks for tabular figures.
const WIDTH_TOLERANCE = 0.25;
// Noto Sans hhea ascender (1069/1000 em); only a fallback for
// measureBaselineRatio, which measures the real ratio in the browser.
const DEFAULT_BASELINE_RATIO = 1.069;
// Bottom of the printable area inside an A4 sheet: 12 mm margin + 272.5 mm body.
const CONTENT_BOTTOM_MM = A4.marginMm + A4.pageHeightMm;
const BORDER_SIDES = ['Top', 'Right', 'Bottom', 'Left'];

const mm = value => value * PX_TO_MM;

/* ------------------------------------------------------------------ painter */

function registerFonts(doc, fonts) {
  if (!Array.isArray(fonts) || !fonts.length) throw new Error('The PDF export needs the embedded invoice fonts.');
  for (const face of fonts) {
    if (!face?.file || !face?.style || !face?.base64) throw new Error('Every invoice font face needs a file, a style and its base64 bytes.');
    doc.addFileToVFS(face.file, face.base64);
    doc.addFont(face.file, PDF_FONT, face.style);
  }
}

function paintRect(doc, op) {
  if (!(op.w > 0) || !(op.h > 0)) return;
  const mode = op.fill && op.stroke ? 'FD' : op.fill ? 'F' : op.stroke ? 'S' : null;
  if (!mode) return;
  if (op.fill) doc.setFillColor(...op.fill);
  if (op.stroke) doc.setDrawColor(...op.stroke).setLineWidth(op.lineWidth ?? 0.2);
  if (op.dash) doc.setLineDashPattern(op.dash, 0);
  if (op.radius > 0) doc.roundedRect(op.x, op.y, op.w, op.h, op.radius, op.radius, mode);
  else doc.rect(op.x, op.y, op.w, op.h, mode);
  if (op.dash) doc.setLineDashPattern([], 0);
}

function paintText(doc, op) {
  if (!op.text) return;
  doc.setFont(PDF_FONT, op.style || 'normal');
  doc.setFontSize(op.size);
  doc.setTextColor(...(op.color || [0, 0, 0]));
  const charSpace = op.charSpace || 0;
  const options = charSpace ? { baseline: 'alphabetic', charSpace } : { baseline: 'alphabetic' };
  // Same text, same measured width: one run keeps the text layer intact.
  if (Number.isFinite(op.width) && op.words?.length > 1) {
    const drawn = doc.getTextWidth(op.text) + charSpace * Math.max(0, op.text.length - 1);
    if (Math.abs(drawn - op.width) > WIDTH_TOLERANCE) {
      for (const word of op.words) if (word.text) doc.text(word.text, word.x, op.y, options);
      return;
    }
  }
  doc.text(op.text, op.x, op.y, options);
}

/**
 * Draws collected pages (one array of ops per A4 page) with the embedded faces
 * and returns the jsPDF document. Runs in Node, so it is unit-testable.
 */
export function paintA4Pdf(pages, fonts, { title = 'Invoice' } = {}) {
  if (!Array.isArray(pages) || !pages.length || pages.some(page => !Array.isArray(page))) throw new Error('The PDF needs one list of drawing operations per page.');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true, putOnlyUsedFonts: true });
  registerFonts(doc, fonts);
  doc.setProperties({ title, creator: 'StoneDesk' });
  pages.forEach((ops, index) => {
    if (index) doc.addPage();
    for (const op of ops) {
      if (op?.type === 'rect') paintRect(doc, op);
      else if (op?.type === 'text') paintText(doc, op);
      else if (op?.type === 'image') doc.addImage(op.dataUrl, op.format || 'PNG', op.x, op.y, op.w, op.h, undefined, 'FAST');
    }
  });
  return doc;
}

/* ---------------------------------------------------------------- collector */

function parseColor(value) {
  const parts = String(value || '').match(/[\d.]+/g);
  if (!parts || parts.length < 3) return null;
  if (parts.length > 3 && Number.parseFloat(parts[3]) < 0.05) return null;
  return parts.slice(0, 3).map(part => Math.round(Number.parseFloat(part)));
}

const pxValue = value => Number.parseFloat(value) || 0;

function backgroundOp(style, box) {
  const fill = parseColor(style.backgroundColor);
  if (!fill) return null;
  let rPx = pxValue(style.borderTopLeftRadius);
  if (typeof style.borderTopLeftRadius === 'string' && style.borderTopLeftRadius.includes('%')) {
    rPx = (rPx / 100) * Math.min(box.w / PX_TO_MM, box.h / PX_TO_MM);
  }
  const radius = Math.min(mm(rPx), box.w / 2, box.h / 2);
  return { type: 'rect', x: box.x, y: box.y, w: box.w, h: box.h, fill, radius };
}

// Sides of the border box, as filled strips. Table cells inherit collapsed
// borders, which Chrome paints centred on the shared edge, so those strips are
// centred too; everything else draws inside its own border box.
function sideStrip(side, box, width, color, collapsed) {
  const shift = collapsed ? width / 2 : 0;
  if (side === 'Top') return { type: 'rect', x: box.x, y: box.y - shift, w: box.w, h: width, fill: color };
  if (side === 'Bottom') return { type: 'rect', x: box.x, y: box.y + box.h - width + shift, w: box.w, h: width, fill: color };
  if (side === 'Left') return { type: 'rect', x: box.x - shift, y: box.y, w: width, h: box.h, fill: color };
  return { type: 'rect', x: box.x + box.w - width + shift, y: box.y, w: width, h: box.h, fill: color };
}

function borderOps(style, box, collapsed) {
  const sides = BORDER_SIDES.map(side => ({
    side,
    width: pxValue(style[`border${side}Width`]),
    line: style[`border${side}Style`],
    color: parseColor(style[`border${side}Color`]),
  })).filter(side => side.width > 0 && side.line !== 'none' && side.line !== 'hidden' && side.color);
  if (!sides.length) return [];
  let rPx = pxValue(style.borderTopLeftRadius);
  if (typeof style.borderTopLeftRadius === 'string' && style.borderTopLeftRadius.includes('%')) {
    rPx = (rPx / 100) * Math.min(box.w / PX_TO_MM, box.h / PX_TO_MM);
  }
  const radius = Math.min(mm(rPx), box.w / 2, box.h / 2);
  const [first] = sides;
  const uniform = sides.length === 4 && sides.every(side => side.width === first.width && side.line === first.line && String(side.color) === String(first.color));
  if (uniform && (radius > 0 || first.line === 'dashed')) {
    // One stroked outline, centred on the border box like the browser paints it.
    const width = mm(first.width);
    return [{
      type: 'rect', x: box.x + width / 2, y: box.y + width / 2, w: box.w - width, h: box.h - width,
      stroke: first.color, lineWidth: width, radius: radius > 0 ? Math.max(0, radius - width / 2) : 0,
      dash: first.line === 'dashed' ? [width * 2, width * 2] : undefined,
    }];
  }
  return sides.map(side => sideStrip(side.side, box, mm(side.width), side.color, collapsed));
}

function imageOp(element, style, origin) {
  const source = element.currentSrc || element.getAttribute('src') || '';
  if (!source) return null;
  const rect = element.getBoundingClientRect();
  const left = rect.left + pxValue(style.borderLeftWidth) + pxValue(style.paddingLeft);
  const top = rect.top + pxValue(style.borderTopWidth) + pxValue(style.paddingTop);
  const width = rect.width - pxValue(style.borderLeftWidth) - pxValue(style.borderRightWidth) - pxValue(style.paddingLeft) - pxValue(style.paddingRight);
  const height = rect.height - pxValue(style.borderTopWidth) - pxValue(style.borderBottomWidth) - pxValue(style.paddingTop) - pxValue(style.paddingBottom);
  if (!(width > 0) || !(height > 0)) return null;
  const natural = element.naturalWidth && element.naturalHeight ? { w: element.naturalWidth, h: element.naturalHeight } : null;
  // object-fit: contain — the same box the browser fits the logo into.
  const scale = natural && style.objectFit !== 'fill' ? Math.min(width / natural.w, height / natural.h) : 0;
  const drawn = scale ? { w: natural.w * scale, h: natural.h * scale } : { w: width, h: height };
  const data = pdfImageSource(element, source, drawn);
  if (!data) return null;
  return {
    type: 'image', dataUrl: data.dataUrl, format: data.format,
    x: mm(left - origin.x + (width - drawn.w) / 2), y: mm(top - origin.y + (height - drawn.h) / 2),
    w: mm(drawn.w), h: mm(drawn.h),
  };
}

// jsPDF reads PNG and JPEG; anything else (an SVG or WebP logo) is repainted
// once into a canvas of the logo's own size. Only the logo is ever an image.
function pdfImageSource(element, source, drawn) {
  const match = /^data:image\/(png|jpe?g);/i.exec(source);
  if (match) return { dataUrl: source, format: /png/i.test(match[1]) ? 'PNG' : 'JPEG' };
  try {
    const canvas = element.ownerDocument.createElement('canvas');
    canvas.width = Math.max(1, Math.round(element.naturalWidth || drawn.w * 4));
    canvas.height = Math.max(1, Math.round(element.naturalHeight || drawn.h * 4));
    canvas.getContext('2d').drawImage(element, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), format: 'PNG' };
  } catch {
    // An unreadable or cross-origin logo is skipped; its placeholder box stays.
    return null;
  }
}

function transformChar(char, textTransform) {
  if (textTransform === 'uppercase') {
    const upper = char.toUpperCase();
    return upper.length === 1 ? upper : char;
  }
  if (textTransform === 'lowercase') {
    const lower = char.toLowerCase();
    return lower.length === 1 ? lower : char;
  }
  return char;
}

// Per-character client rects, so wrapped lines, collapsed whitespace and
// uppercase transforms land exactly where the browser put them.
function textRuns(node, style, origin, ratio) {
  const raw = node.nodeValue;
  if (!raw || !/\S/.test(raw)) return [];
  const doc = node.ownerDocument;
  const range = doc.createRange();
  const chars = [];
  for (let index = 0; index < raw.length; index++) {
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    const rect = range.getClientRects()[0];
    if (!rect || rect.width <= 0) continue;
    chars.push({ char: transformChar(raw[index], style.textTransform), left: rect.left, right: rect.right, top: rect.top });
  }
  if (!chars.length) return [];
  const lines = [[chars[0]]];
  for (const char of chars.slice(1)) {
    const line = lines.at(-1);
    if (Math.abs(char.top - line[0].top) > 0.5) lines.push([char]);
    else line.push(char);
  }
  const size = pxValue(style.fontSize);
  const color = parseColor(style.color) || [0, 0, 0];
  const pdfStyle = pdfFontStyle(style.fontWeight);
  const charSpace = style.letterSpacing === 'normal' ? 0 : mm(pxValue(style.letterSpacing));
  return lines.map(line => {
    let start = 0, end = line.length;
    while (start < end && !/\S/.test(line[start].char)) start++;
    while (end > start && !/\S/.test(line[end - 1].char)) end--;
    const kept = line.slice(start, end);
    if (!kept.length) return null;
    const words = [];
    let open = false;
    for (const char of kept) {
      if (/\s/.test(char.char)) { open = false; continue; }
      if (open) words.at(-1).text += char.char;
      else { words.push({ text: char.char, x: mm(char.left - origin.x) }); open = true; }
    }
    return {
      type: 'text', text: kept.map(char => char.char).join(''),
      x: mm(kept[0].left - origin.x), y: mm(kept[0].top - origin.y + ratio * size),
      size: size * PT_PER_PX, style: pdfStyle, color, charSpace,
      width: mm(kept.at(-1).right - kept[0].left), words,
    };
  }).filter(Boolean);
}

function walk(element, context, ops) {
  const style = context.view.getComputedStyle(element);
  if (style.display === 'none' || element.classList?.contains('sr-only')) return;
  const rect = element.getBoundingClientRect();
  const box = { x: mm(rect.left - context.origin.x), y: mm(rect.top - context.origin.y), w: mm(rect.width), h: mm(rect.height) };
  if (rect.width > 0 && rect.height > 0) {
    const background = backgroundOp(style, box);
    if (background) ops.push(background);
    ops.push(...borderOps(style, box, context.collapsed));
  }
  if (element.tagName === 'IMG') {
    const image = imageOp(element, style, context.origin);
    if (image) ops.push(image);
    return;
  }
  const collapsed = element.tagName === 'TABLE' ? style.borderCollapse === 'collapse' : context.collapsed;
  const inner = collapsed === context.collapsed ? context : { ...context, collapsed };
  for (const child of element.childNodes) {
    if (child.nodeType === 3) ops.push(...textRuns(child, style, context.origin, context.ratio));
    else if (child.nodeType === 1) walk(child, inner, ops);
  }
}

/**
 * The baseline offset of a text line as a fraction of its font size, measured
 * in the invoice font (Chrome reports a text range's top at the ascent line, so
 * the PDF baseline is that top plus this ratio times the font size).
 */
export function measureBaselineRatio(doc = document) {
  const probe = 100;
  const host = doc.createElement('div');
  host.className = 'a4-invoice a4-measure-host';
  host.setAttribute('aria-hidden', 'true');
  const sheet = doc.createElement('div');
  sheet.className = 'paper sample-sheet';
  const body = doc.createElement('div');
  body.className = 'page-body';
  const line = doc.createElement('p');
  line.style.fontSize = `${probe}px`;
  line.style.lineHeight = '1';
  line.style.whiteSpace = 'nowrap';
  const text = doc.createTextNode('Hxp');
  // A zero-sized inline-block sits on the text baseline.
  const marker = doc.createElement('span');
  marker.style.display = 'inline-block';
  marker.style.width = '0px';
  marker.style.height = '0px';
  line.append(text, marker);
  body.append(line);
  sheet.append(body);
  host.append(sheet);
  doc.body.appendChild(host);
  try {
    const range = doc.createRange();
    range.selectNodeContents(text);
    const rect = range.getClientRects()[0] || range.getBoundingClientRect();
    const ratio = (marker.getBoundingClientRect().bottom - rect.top) / probe;
    return ratio > 0.5 && ratio < 1.5 ? ratio : DEFAULT_BASELINE_RATIO;
  } catch {
    return DEFAULT_BASELINE_RATIO;
  } finally {
    host.remove();
  }
}

/**
 * Walks the rendered `.sample-sheet` articles and returns one list of drawing
 * operations per page, positioned in millimetres from the sheet's top-left
 * corner. Nothing is ever clipped: a page whose body outgrows the printable
 * area throws instead.
 */
export function collectA4PdfPages(sheets, { baselineRatio = DEFAULT_BASELINE_RATIO } = {}) {
  const pages = [...(sheets || [])];
  if (!pages.length) throw new Error('The PDF export needs at least one rendered A4 page.');
  return pages.map((sheet, index) => {
    const view = sheet.ownerDocument.defaultView;
    const rect = sheet.getBoundingClientRect();
    const ops = [];
    walk(sheet, { view, origin: { x: rect.left, y: rect.top }, ratio: baselineRatio, collapsed: false }, ops);
    const body = sheet.querySelector('.page-body')?.getBoundingClientRect();
    const marginMm = mm(parseFloat(view.getComputedStyle(sheet).paddingBottom));
    const maxBottomMm = A4.heightMm - marginMm;
    if (body && mm(body.top + body.height - rect.top) > maxBottomMm + 0.5) throw new Error(`Page ${index + 1} content is taller than an A4 page`);
    return ops;
  });
}

/* -------------------------------------------------------------- orchestrator */

/** Warms the font cache so a later Share stays inside the user activation. */
export function preloadA4PdfAssets() {
  return loadInvoicePdfFonts().catch(() => {});
}

/**
 * Builds the bill PDF for one copy from the prepared model (prepareA4Invoice /
 * a4InvoiceFromDispatch, projected with projectCopy) and the shared measured
 * page plan the preview and the print window use. Browser only: the layout is
 * read from the rendered DOM. Returns { blob, filename, pages }.
 */
export async function a4InvoicePdf(model, pages, copy = 'buyer', filename = 'Invoice.pdf') {
  if (!COPIES.includes(copy)) throw new Error(`Unknown bill copy "${copy}". Expected "buyer" or "driver".`);
  if (!Array.isArray(pages) || !pages.length) throw new Error('The PDF export needs the measured page plan of this copy.');
  const doc = globalThis.document;
  if (!doc?.body) throw new Error('The PDF export needs a browser document.');
  const fonts = await loadInvoicePdfFonts();
  await invoiceFontsReady(doc);
  const host = mountA4Host(doc, renderA4Pages(model, pages, copy, 'pdf-export'));
  let collected;
  try {
    const images = [...host.querySelectorAll('img')];
    await Promise.all(images.map(image => image.decode?.().catch(() => {})));
    collected = collectA4PdfPages(host.querySelectorAll('.sample-sheet'), { baselineRatio: measureBaselineRatio(doc) });
  } finally {
    host.remove();
  }
  const output = paintA4Pdf(collected, fonts, { title: `${model.title} - ${model.invoiceNumber}` });
  return { blob: output.output('blob'), filename, pages: pages.length };
}
