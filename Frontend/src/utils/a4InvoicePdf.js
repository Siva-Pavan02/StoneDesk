import { jsPDF } from 'jspdf';
import { AREA_ROUNDING_NOTE, SAMPLE_BANK_PAIRS, bankDetailPairs, bankDetailSegments, formatA4Dimension, formatA4Number } from './a4InvoiceModel.js';
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
// Grayscale palette for the final-page settlement block and the page footer only.
const sumInk = [34, 34, 34], sumMuted = [102, 102, 102], sumLine = [227, 227, 227], sumTint = [244, 244, 244];

const LEFT = 12, RIGHT = 198, WIDTH = RIGHT - LEFT;
const DIVIDER_Y = 49, COLUMNS_TOP = 53, CONTENT_BOTTOM = 276, FOOT_LINE = 280;
const CONTINUATION_H = 7, SUMMARY_H = 42, SUMMARY_GAP = 4;
const COLUMN_GAP = 4, COLUMN_W = (WIDTH - 2 * COLUMN_GAP) / 3;
const COLUMN_X = [0, 1, 2].map(i => LEFT + i * (COLUMN_W + COLUMN_GAP));
const HEADING_H = 5.5, THEAD_H = 4.6, ROW_H = 4.3, BLOCK_GAP = 4;
// Type, L, W, Qty, Sq ft as fractions of the column width (same split as the CSS).
const CELL_SHARES = [0.16, 0.2, 0.2, 0.14, 0.3];

const rs = value => `Rs. ${formatA4Number(value)}`;

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

// Lowers the current font size until text fits maxW (or reaches min); returns the size used.
function fit(doc, text, maxW, size, min = 7) {
  doc.setFontSize(size);
  while (size > min && doc.getTextWidth(text) > maxW) doc.setFontSize(size -= 0.5);
  return size;
}

const BANK_W = 0.7 * WIDTH, BANK_ROW = 4.4;

// Amount in words, rounding note, bank details and signature. Returns its height and a painter.
function closingBlock(doc, model) {
  const sample = model.mode === 'sample';
  const bankText = model.seller.bankDetails;
  const pairs = sample ? SAMPLE_BANK_PAIRS : bankText ? bankDetailPairs(bankText) : null;
  const showBank = sample || Boolean(bankText);
  doc.setFont('helvetica', 'bold').setFontSize(6);
  const wordsLabelW = doc.getTextWidth('AMOUNT IN WORDS') + 15 * 0.3;
  const wordsX = LEFT + wordsLabelW + 2.5;
  doc.setFontSize(8);
  const words = lines(doc, model.amountWords, RIGHT - wordsX, 2);
  doc.setFont('helvetica', 'normal').setFontSize(6);
  const note = lines(doc, AREA_ROUNDING_NOTE, WIDTH, 2);
  doc.setFont('helvetica', 'bold').setFontSize(7.5);
  const bankLines = showBank && !pairs ? lines(doc, bankDetailSegments(bankText).join(' · '), BANK_W, 2) : [];
  const bankH = !showBank ? 0 : 4 + (pairs ? Math.ceil(pairs.length / 3) * BANK_ROW : bankLines.length * 3.4);
  // Offsets from the block top: words baseline, note baseline, hairline above bank + signature.
  const wordsY = 4.5, noteY = wordsY + (words.length - 1) * 3.6 + 4.2, footTopY = noteY + (note.length - 1) * 2.7 + 3;
  const footH = Math.max(bankH, 14);
  const height = footTopY + footH + 3;
  const draw = y => {
    doc.setFont('helvetica', 'bold').setFontSize(6).setTextColor(...sumMuted).text('AMOUNT IN WORDS', LEFT, y + wordsY, { charSpace: 0.3 });
    // 8pt text at lineHeightFactor 1.27 advances ~3.6 mm per line; 6pt at 1.27 ~2.7 mm.
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...sumInk).text(words, wordsX, y + wordsY, { lineHeightFactor: 1.27 });
    doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(...sumMuted).text(note, LEFT, y + noteY, { lineHeightFactor: 1.27 });
    const footTop = y + footTopY;
    doc.setDrawColor(...sumLine).setLineWidth(0.2).line(LEFT, footTop, RIGHT, footTop);
    if (showBank) {
      const labelY = footTop + 4.5;
      doc.setFont('helvetica', 'bold').setFontSize(6).setTextColor(...sumMuted).text('BANK DETAILS', LEFT, labelY, { charSpace: 0.3 });
      if (sample) {
        const after = LEFT + doc.getTextWidth('BANK DETAILS') + 12 * 0.3 + 2;
        doc.setFont('helvetica', 'normal').setFontSize(6).text('Preview placeholders only', after, labelY);
      }
      if (pairs) {
        const cellW = BANK_W / 3;
        pairs.forEach(([label, value], i) => {
          const x = LEFT + (i % 3) * cellW, base = labelY + 4.4 + Math.floor(i / 3) * BANK_ROW;
          doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...sumMuted).text(`${label}:`, x, base);
          const labelW = doc.getTextWidth(`${label}:`);
          doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(...sumInk).text(lines(doc, value, Math.max(4, cellW - labelW - 3), 1), x + labelW + 1.2, base);
        });
      } else {
        doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...sumInk).text(bankLines, LEFT, labelY + 4.4, { lineHeightFactor: 1.27 });
      }
    }
    // Signature: hairline above the name and caption, like the HTML `.sign` border-top.
    const signX = 150, signY = y + height - 12;
    doc.setDrawColor(...sumLine).setLineWidth(0.25).line(signX, signY, RIGHT, signY);
    const [strong, caption] = sample ? ['Sample only', 'Not valid for payment'] : [model.seller.signatoryName, 'Authorized signatory'];
    if (strong) doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...sumInk).text(lines(doc, strong, RIGHT - signX, 1), RIGHT, signY + 4.5, { align: 'right' });
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...sumMuted).text(caption, RIGHT, strong ? signY + 8.5 : signY + 4.5, { align: 'right' });
  };
  return { height, draw };
}

const SPLIT_X = LEFT + 0.55 * WIDTH, PAY_X = SPLIT_X + 5;

function drawSummary(doc, model, y) {
  const totals = model.totals;
  doc.setDrawColor(...sumLine).setLineWidth(0.2).line(LEFT, y, RIGHT, y).line(SPLIT_X, y + 3, SPLIT_X, y + 40);
  // Order summary (left).
  const leftRight = SPLIT_X - 5, leftW = leftRight - LEFT;
  doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(...sumMuted).text('ORDER SUMMARY', LEFT, y + 6, { charSpace: 0.3 });
  const pieces = String(totals.pieces), area = formatA4Number(totals.area);
  doc.setFont('helvetica', 'normal');
  fit(doc, pieces, 40, 18);
  const statX = LEFT + Math.max(30, doc.getTextWidth(pieces) + 6);
  doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...sumMuted).text('Total pieces', LEFT, y + 12).text('Total area · sq ft', statX, y + 12);
  fit(doc, pieces, 40, 18);
  doc.setTextColor(...sumInk).text(pieces, LEFT, y + 20.5);
  fit(doc, area, leftRight - statX, 18);
  doc.text(area, statX, y + 20.5);
  doc.setDrawColor(...sumLine).setLineWidth(0.2).line(statX - 3, y + 9.5, statX - 3, y + 21.5);
  doc.setFillColor(...sumTint).rect(LEFT, y + 25, leftW, 9, 'F');
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...sumMuted).text('Material total', LEFT + 2.5, y + 30.6);
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(...sumInk).text(rs(totals.materialTotal), leftRight - 2.5, y + 31, { align: 'right' });

  // Payment summary (right). Material (Regular) + Top material = Material total.
  doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(...sumMuted).text('PAYMENT SUMMARY', PAY_X, y + 6, { charSpace: 0.3 });
  [['Material amount', rs(totals.regularAmount)], ['Top material amount', rs(totals.topAmount)], ['Loading / royalty', rs(model.loadingRoyalty)]].forEach(([label, value], i) => {
    const base = y + 12 + i * 5.6;
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...sumMuted).text(label, PAY_X, base);
    doc.setFontSize(8).setTextColor(...sumInk).text(value, RIGHT, base, { align: 'right' });
    doc.setDrawColor(...sumLine).setLineWidth(0.2).line(PAY_X, base + 2.2, RIGHT, base + 2.2);
  });
  doc.setFillColor(...sumTint).rect(PAY_X, y + 28, RIGHT - PAY_X, 11, 'F');
  doc.setFillColor(...sumInk).rect(PAY_X, y + 28, 0.8, 11, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...sumInk).text('NET PAYABLE', PAY_X + 3.5, y + 34.8);
  const labelEnd = PAY_X + 3.5 + doc.getTextWidth('NET PAYABLE') + 3;
  const net = rs(totals.netPayable);
  fit(doc, net, RIGHT - 2.5 - labelEnd, 15);
  doc.text(net, RIGHT - 2.5, y + 35.4, { align: 'right' });
}

function drawFooter(doc, model, page, pages) {
  doc.setDrawColor(...sumLine).setLineWidth(0.2).line(LEFT, FOOT_LINE, RIGHT, FOOT_LINE);
  const base = FOOT_LINE + 4.5;
  doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(...sumInk).text(model.mode === 'sample' ? 'SAMPLE · FICTIONAL DATA · NOT FOR PAYMENT' : 'BUYER INVOICE', LEFT, base, { charSpace: 0.2 });
  doc.setFont('helvetica', 'normal').setTextColor(...sumMuted).text('All amounts in INR · Dimensions in feet', LEFT + WIDTH / 2, base, { align: 'center' });
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
