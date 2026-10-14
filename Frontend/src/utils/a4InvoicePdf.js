import { jsPDF } from 'jspdf';
import { AREA_ROUNDING_NOTE, formatA4Dimension, formatA4Number, formatA4Rate } from './a4InvoiceModel.js';
import { planA4Invoice } from './a4InvoicePagination.js';

// Vector PDF of the approved A4 buyer invoice. It draws the same prepared model
// as the HTML invoice (a4InvoiceModel.js) and packs rows with the same planner
// (a4InvoicePagination.js), using fixed millimetre heights instead of DOM
// measurement, so it also runs outside the browser.
//
// Layout mirrors a4InvoiceRender.js: header, three measurement columns with
// Regular / Top subtotals per row, then the order and payment summary and the
// closing block on the final page. The built-in Helvetica font has no ₹ glyph,
// so amounts print as "Rs.".

const ink = [32, 61, 54], muted = [82, 102, 97], accent = [23, 100, 93];
const border = [226, 232, 229], rule = [238, 242, 240], tint = [241, 246, 243], totalTint = [224, 236, 230];

const LEFT = 12, RIGHT = 198, WIDTH = RIGHT - LEFT;
const DIVIDER_Y = 49, COLUMNS_TOP = 53, CONTENT_BOTTOM = 276, FOOT_LINE = 280;
const CONTINUATION_H = 7, SUMMARY_H = 38, SUMMARY_GAP = 4;
const COLUMN_GAP = 4, COLUMN_W = (WIDTH - 2 * COLUMN_GAP) / 3;
const COLUMN_X = [0, 1, 2].map(i => LEFT + i * (COLUMN_W + COLUMN_GAP));
const HEADING_H = 5.5, THEAD_H = 4.6, ROW_H = 4.3, BLOCK_GAP = 4;
// Type, L, W, Qty, Sq ft as fractions of the column width (same split as the CSS).
const CELL_SHARES = [0.16, 0.2, 0.2, 0.14, 0.3];

const rs = value => `Rs. ${formatA4Number(value)}`;
const rate = value => formatA4Rate(value).replace('₹', 'Rs. ');

function cells(x) {
  const edges = [x];
  for (const share of CELL_SHARES) edges.push(edges.at(-1) + share * COLUMN_W);
  return { type: x + 0.8, l: (edges[1] + edges[2]) / 2, w: (edges[2] + edges[3]) / 2, qty: (edges[3] + edges[4]) / 2, area: edges[5] - 0.8 };
}

// First `max` wrapped lines of text, with an ellipsis when it was cut short.
function lines(doc, text, width, max) {
  const all = doc.splitTextToSize(String(text ?? ''), width);
  if (all.length <= max) return all;
  const kept = all.slice(0, max);
  let last = kept[max - 1];
  while (last && doc.getTextWidth(`${last}…`) > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.trimEnd()}…`;
  return kept;
}

const lastIndex = (group, type) => group.entries.findLastIndex(entry => entry.type === type);

// Height of one row fragment, matching what drawGroup paints.
function fragmentHeight(group, from, to) {
  const lastRegular = lastIndex(group, 'regular'), lastTop = lastIndex(group, 'top');
  let rows = to - from;
  if (lastRegular >= from && lastRegular < to) rows++;
  if (lastTop >= from && lastTop < to) rows++;
  return HEADING_H + THEAD_H + rows * ROW_H + BLOCK_GAP;
}

function drawLogo(doc, source, x, y, size) {
  if (source) {
    try {
      const image = doc.getImageProperties(source);
      const scale = Math.min(size / image.width, size / image.height);
      const w = image.width * scale, h = image.height * scale;
      doc.addImage(source, image.fileType || 'PNG', x + (size - w) / 2, y + (size - h) / 2, w, h, undefined, 'FAST');
      return;
    } catch {
      // An unreadable saved logo falls back to the printed placeholder, like the HTML invoice.
    }
  }
  doc.setFillColor(...tint).setDrawColor(...border).setLineWidth(0.25).roundedRect(x, y, size, size, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(...muted).text('LOGO', x + size / 2, y + size / 2 + 1.1, { align: 'center' });
}

function drawHeader(doc, model) {
  const seller = model.seller;
  drawLogo(doc, seller.logo, LEFT, 12, 18);
  const brandX = LEFT + 22, brandW = 72;
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...ink);
  const name = lines(doc, seller.name, brandW, 2);
  doc.text(name, brandX, 17, { lineHeightFactor: 1.15 });
  const contact = [seller.location, seller.contactLine, seller.phone].filter(Boolean).join('\n');
  if (contact) {
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...muted);
    doc.text(lines(doc, contact, brandW, 3), brandX, 17 + name.length * 5.3 + 0.5, { lineHeightFactor: 1.3 });
  }

  const panelX = 110, panelW = RIGHT - panelX;
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(...accent).text(model.title.toUpperCase(), panelX, 16);
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...ink).text(model.invoiceDate.label, RIGHT, 16, { align: 'right' });
  const state = model.mode === 'sample' ? 'SAMPLE' : model.status === 'Dispatched' ? 'IN TRANSIT' : model.status.toUpperCase();
  doc.setFont('helvetica', 'bold').setFontSize(6.3);
  const stateW = doc.getTextWidth(state) + 3.6;
  doc.setFillColor(...tint).roundedRect(RIGHT - stateW, 18, stateW, 4, 1.2, 1.2, 'F');
  doc.setTextColor(...accent).text(state, RIGHT - stateW / 2, 20.9, { align: 'center' });
  const reference = `No. ${model.invoiceNumber}${model.mode === 'sample' ? ' · Fictional data — not for payment' : ''}`;
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...muted).text(lines(doc, reference, panelW - stateW - 3, 1), panelX, 21.5);

  const boxY = 25, boxH = 21, cellW = panelW / 2;
  doc.setFillColor(...tint).setDrawColor(...border).setLineWidth(0.2).roundedRect(panelX, boxY, panelW, boxH, 1.5, 1.5, 'FD');
  doc.setDrawColor(...border).setLineWidth(0.15).line(panelX + cellW, boxY + 2, panelX + cellW, boxY + boxH - 2).line(panelX + 2, boxY + boxH / 2, RIGHT - 2, boxY + boxH / 2);
  [['PARTY', model.party], ['LORRY NO.', model.lorryNumber], ['DESTINATION', model.destination], ['SUPERVISOR', model.supervisor]].forEach(([label, value], i) => {
    const x = panelX + 3 + (i % 2) * cellW, y = boxY + (i < 2 ? 0 : boxH / 2);
    doc.setFont('helvetica', 'normal').setFontSize(5.8).setTextColor(...muted).text(label, x, y + 3.9);
    doc.setFont(i === 1 ? 'courier' : 'helvetica', 'bold').setFontSize(8).setTextColor(...ink).text(lines(doc, value, cellW - 6, 1), x, y + 8.1);
  });
  doc.setDrawColor(...ink).setLineWidth(0.35).line(LEFT, DIVIDER_Y, RIGHT, DIVIDER_Y);
}

function drawGroup(doc, x, y, group, from, to) {
  const c = cells(x);
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...ink).text(String(group.id), x, y + 3.8);
  let ruleStart = x + doc.getTextWidth(String(group.id)) + 2;
  if (from) {
    doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(...muted).text('(continued)', ruleStart - 0.5, y + 3.8);
    ruleStart += doc.getTextWidth('(continued)') + 1.5;
  }
  doc.setDrawColor(...border).setLineWidth(0.2).line(ruleStart, y + 2.6, x + COLUMN_W, y + 2.6);

  const headBase = y + HEADING_H + 3.2;
  doc.setFont('helvetica', 'normal').setFontSize(6.3).setTextColor(...muted);
  doc.text('Type', c.type, headBase);
  doc.text('L (ft)', c.l, headBase, { align: 'center' }); doc.text('W (ft)', c.w, headBase, { align: 'center' });
  doc.text('Qty', c.qty, headBase, { align: 'center' }); doc.text('Sq ft', c.area, headBase, { align: 'right' });
  doc.setDrawColor(...border).setLineWidth(0.25).line(x, y + HEADING_H + THEAD_H, x + COLUMN_W, y + HEADING_H + THEAD_H);

  const lastRegular = lastIndex(group, 'regular'), lastTop = lastIndex(group, 'top');
  let rowTop = y + HEADING_H + THEAD_H;
  const subtotal = (label, values) => {
    doc.setFillColor(...totalTint).rect(x, rowTop, COLUMN_W, ROW_H, 'F');
    const base = rowTop + 3;
    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(...ink).text(label, c.type, base);
    doc.text(String(values.pieces), c.qty, base, { align: 'center' }); doc.text(formatA4Number(values.area), c.area, base, { align: 'right' });
    rowTop += ROW_H;
  };
  for (let index = from; index < to; index++) {
    const entry = group.entries[index], base = rowTop + 3;
    if (entry.type === 'top') doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...accent).text('Top', c.type, base);
    doc.setFont('helvetica', 'normal').setFontSize(7.2).setTextColor(...ink);
    doc.text(formatA4Dimension(entry.lengthFt), c.l, base, { align: 'center' }); doc.text(formatA4Dimension(entry.widthFt), c.w, base, { align: 'center' });
    doc.text(String(entry.quantity), c.qty, base, { align: 'center' }); doc.text(formatA4Number(entry.area), c.area, base, { align: 'right' });
    doc.setDrawColor(...rule).setLineWidth(0.15).line(x, rowTop + ROW_H, x + COLUMN_W, rowTop + ROW_H);
    rowTop += ROW_H;
    if (index === lastRegular) subtotal('Regular subtotal', group.regular);
    if (index === lastTop) subtotal('Top subtotal', group.top);
  }
}

// Amount in words, bank details, rounding note and signature. Returns its height and a painter.
function closingBlock(doc, model) {
  const textW = 120;
  doc.setFont('helvetica', 'bold').setFontSize(8);
  const words = lines(doc, model.amountWords, textW, 3);
  const bank = model.seller.bankDetails;
  doc.setFont('helvetica', 'normal').setFontSize(7.5);
  const bankLines = bank ? lines(doc, bank, textW, 3) : [];
  doc.setFontSize(6);
  const note = lines(doc, AREA_ROUNDING_NOTE, textW, 3);
  const textH = 4.5 + words.length * 3.7 + (bankLines.length ? 4.5 + bankLines.length * 3.4 : 0) + 1.5 + note.length * 2.7;
  const height = Math.max(textH, 18) + 3;
  const draw = y => {
    doc.setDrawColor(...border).setLineWidth(0.2).line(LEFT, y, RIGHT, y);
    let cursor = y + 4.5;
    doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(...muted).text('AMOUNT IN WORDS', LEFT, cursor);
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...ink).text(words, LEFT, cursor + 3.8, { lineHeightFactor: 1.3 });
    cursor += 3.8 + words.length * 3.7;
    if (bankLines.length) {
      doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(...muted).text('BANK / UPI DETAILS', LEFT, cursor + 1);
      doc.setFontSize(7.5).setTextColor(...ink).text(bankLines, LEFT, cursor + 4.5, { lineHeightFactor: 1.3 });
      cursor += 4.5 + bankLines.length * 3.4;
    }
    doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(...muted).text(note, LEFT, cursor + 1.5, { lineHeightFactor: 1.3 });
    const signX = 150, signY = y + height - 7;
    doc.setDrawColor(...ink).setLineWidth(0.25).line(signX, signY, RIGHT, signY);
    const [strong, caption] = model.mode === 'sample' ? ['Sample only', 'Not valid for payment'] : [model.seller.signatoryName, 'Authorized signatory'];
    if (strong) doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...ink).text(lines(doc, strong, RIGHT - signX, 1), RIGHT, signY - 1.5, { align: 'right' });
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...muted).text(caption, RIGHT, signY + 3.5, { align: 'right' });
  };
  return { height, draw };
}

function drawSummary(doc, model, y) {
  const totals = model.totals;
  doc.setDrawColor(...ink).setLineWidth(0.35).line(LEFT, y, RIGHT, y);
  // Order summary (left).
  const orderW = 88;
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...ink).text('ORDER SUMMARY', LEFT, y + 6);
  [['Total pieces', String(totals.pieces)], ['Total area · sq ft', formatA4Number(totals.area)]].forEach(([label, value], i) => {
    const x = LEFT + i * (orderW / 2);
    doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...muted).text(label, x, y + 12);
    doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...ink).text(value, x, y + 19);
  });
  doc.setDrawColor(...border).setLineWidth(0.2).line(LEFT, y + 23, LEFT + orderW, y + 23);
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...muted).text('Material total', LEFT, y + 28);
  doc.setFont('helvetica', 'bold').setTextColor(...ink).text(rs(totals.materialTotal), LEFT + orderW, y + 28, { align: 'right' });

  // Payment summary (right).
  const payX = 110;
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...ink).text('PAYMENT SUMMARY', payX, y + 6);
  const rates = [...new Set(model.groups.flatMap(group => group.entries.map(entry => entry.ratePerSqFt)))];
  const rows = [['Material amount', rs(totals.materialTotal)]];
  if (model.mode === 'production') rows.push([rates.length === 1 ? 'Rate / sq ft' : 'Rates / sq ft', rates.map(value => value == null ? 'Not recorded' : rate(value)).join(' · ')]);
  rows.push(['Loading / royalty', rs(model.loadingRoyalty)]);
  rows.forEach(([label, value], i) => {
    const base = y + 12 + i * 4.6;
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...muted).text(label, payX, base);
    doc.setTextColor(...ink).text(lines(doc, value, 52, 1), RIGHT, base, { align: 'right' });
  });
  doc.setFillColor(...tint).roundedRect(payX, y + 27, RIGHT - payX, 9, 1.2, 1.2, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...accent).text('NET PAYABLE', payX + 2.5, y + 32.8);
  doc.setFontSize(11).text(rs(totals.netPayable), RIGHT - 2.5, y + 33, { align: 'right' });
}

function drawFooter(doc, model, page, pages) {
  doc.setDrawColor(...border).setLineWidth(0.2).line(LEFT, FOOT_LINE, RIGHT, FOOT_LINE);
  const base = FOOT_LINE + 4.5;
  doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(...ink).text(model.mode === 'sample' ? 'SAMPLE · FICTIONAL DATA · NOT FOR PAYMENT' : 'BUYER INVOICE', LEFT, base);
  doc.setFont('helvetica', 'normal').setTextColor(...muted).text('All amounts in INR · Dimensions in feet', LEFT + WIDTH / 2, base, { align: 'center' });
  doc.text(`Page ${page} of ${pages}`, RIGHT, base, { align: 'right' });
}

/**
 * Builds the buyer invoice PDF from a prepared A4 model (prepareA4Invoice /
 * a4InvoiceFromDispatch). Returns { blob, filename, pages }.
 */
export function a4InvoicePdf(model, filename = 'Invoice.pdf') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
  doc.setProperties({ title: `${model.title} - ${model.invoiceNumber}`, creator: 'StoneDesk' });
  const closing = closingBlock(doc, model);
  const reserve = SUMMARY_H + closing.height + SUMMARY_GAP;
  const regular = CONTENT_BOTTOM - CONTINUATION_H - COLUMNS_TOP;
  const final = CONTENT_BOTTOM - reserve - COLUMNS_TOP;
  if (final < 0) throw new Error('The header and final summary cannot fit together on a single A4 page.');
  const pages = planA4Invoice(model, fragmentHeight, { regular, final });

  pages.forEach((page, index) => {
    if (index) doc.addPage();
    drawHeader(doc, model);
    let columnsBottom = COLUMNS_TOP;
    page.columns.forEach((column, columnIndex) => {
      let y = COLUMNS_TOP;
      for (const { group, from, to } of column) { drawGroup(doc, COLUMN_X[columnIndex], y, group, from, to); y += fragmentHeight(group, from, to); }
      columnsBottom = Math.max(columnsBottom, y);
    });
    if (page.summary) {
      // Directly below the tallest column; the planner kept every column within `final`, so this always fits.
      const summaryY = Math.min(columnsBottom, CONTENT_BOTTOM - reserve) + SUMMARY_GAP;
      drawSummary(doc, model, summaryY);
      closing.draw(summaryY + SUMMARY_H);
    } else {
      doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...muted)
        .text('Continued on the next page. Order totals and payment summary appear on the final page.', LEFT, CONTENT_BOTTOM - 2);
    }
    drawFooter(doc, model, index + 1, pages.length);
  });
  return { blob: doc.output('blob'), filename, pages: pages.length };
}
