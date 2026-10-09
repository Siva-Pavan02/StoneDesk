import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { assertBill, billRows, rowGroups, rowOverview } from './billData.js';
import { round2 } from './loadMath.js';

const ink = [32, 61, 54];
const muted = [82, 102, 97];
const accent = [23, 100, 93];
const line = [219, 230, 223];
const tint = [241, 246, 243];
const left = 15, right = 195;
// Rows are laid out two per band: Row 1 on the left, Row 2 on the right.
const COL_W = 84, COL_X = [left, 111];
const PAGE_BOTTOM = 266, CONTENT_TOP = 30;
const ROW_H = 7, HEAD_H = 6, ITEM_H = 5, GAP = 7;
const money = n => round2(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function measure(value) {
  const n = Number(value), whole = Math.floor(n), quarter = Math.round((n - whole) * 4);
  if (Math.abs(n * 4 - Math.round(n * 4)) < 1e-8 && quarter > 0 && quarter < 4) return `${whole || ''}${['', '¼', '½', '¾'][quarter]}`;
  return String(n);
}

function logo(doc, source, x, y, size, compact = false) {
  if (source) {
    try {
      const image = doc.getImageProperties(source);
      const inner = size - (compact ? 1 : 4), ratio = Math.min(inner / image.width, inner / image.height);
      const imageWidth = image.width * ratio, imageHeight = image.height * ratio;
      doc.addImage(source, 'PNG', x + (size - imageWidth) / 2, y + (size - imageHeight) / 2, imageWidth, imageHeight, undefined, 'FAST');
      return;
    } catch {
      // A damaged historical image must not prevent a bill from being exported.
    }
  }
  doc.setFillColor(...tint).setDrawColor(183, 203, 192).setLineWidth(0.2);
  doc.setLineDashPattern([0.9, 0.8], 0);
  doc.roundedRect(x, y, size, size, compact ? 1.4 : 2.5, compact ? 1.4 : 2.5, 'FD');
  doc.setLineDashPattern([], 0);
  const iconSize = compact ? 4 : 7, iconX = x + (size - iconSize) / 2, iconY = y + (compact ? 2.5 : 5.5);
  doc.setDrawColor(...muted).setLineWidth(0.3).roundedRect(iconX, iconY, iconSize, iconSize, 0.6, 0.6, 'S');
  doc.circle(iconX + iconSize * 0.3, iconY + iconSize * 0.3, iconSize * 0.1, 'S');
  doc.line(iconX + 0.6, iconY + iconSize - 0.7, iconX + iconSize * 0.52, iconY + iconSize * 0.5);
  doc.line(iconX + iconSize * 0.52, iconY + iconSize * 0.5, iconX + iconSize - 0.6, iconY + iconSize - 0.7);
  if (!compact) doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...muted).text('YOUR LOGO', x + size / 2, y + size - 5.2, { align: 'center' });
}

function continuationHeader(doc, dispatch, driver) {
  logo(doc, dispatch.businessSnapshot?.logoDataUrl, left, 10, 9, true);
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...ink);
  doc.text(doc.splitTextToSize(dispatch.businessSnapshot?.businessName || 'StoneDesk', 106).slice(0, 1), left + 13, 13.5);
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...muted);
  doc.text(`${driver ? 'Driver slip' : 'Buyer invoice'} · continued`, left + 13, 18.5);
  doc.text(doc.splitTextToSize(dispatch.dispatchSlipNumber || '-', 48).slice(0, 1), right, 17, { align: 'right' });
  doc.setDrawColor(...line).setLineWidth(0.2).line(left, 23, right, 23);
}

function header(doc, dispatch, driver) {
  const business = dispatch.businessSnapshot || {};
  logo(doc, business.logoDataUrl, left, 14, 26);
  const brandX = left + 34, brandWidth = 88;
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...ink);
  const name = doc.splitTextToSize(business.businessName || 'StoneDesk', brandWidth);
  doc.text(name, brandX, 22, { lineHeightFactor: 1.15 });
  let brandY = 22 + (name.length - 1) * 8.12 + 6;
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...muted);
  for (const value of [business.address, business.phone].filter(Boolean)) {
    const lines = doc.splitTextToSize(value, brandWidth);
    doc.text(lines, brandX, brandY, { lineHeightFactor: 1.4 }); brandY += lines.length * 4 + 1;
  }
  doc.setFont('helvetica', 'normal').setFontSize(14).setTextColor(...ink);
  doc.text(driver ? 'DRIVER SLIP' : 'BUYER INVOICE', right, 22, { align: 'right' });
  if (driver) doc.setFontSize(8).setTextColor(...accent).text('Prices hidden', right, 28, { align: 'right' });
  const dividerY = Math.max(brandY, driver ? 28 : 22, 40) + 7;
  doc.setDrawColor(...line).setLineWidth(0.25).line(left, dividerY, right, dividerY);
  const date = new Date(dispatch.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const label = content => ({ content, styles: { textColor: muted, fontSize: 8.5 } });
  const value = content => ({ content, styles: { fontStyle: 'bold', fontSize: 9.5 } });
  autoTable(doc, { startY: dividerY + 3, theme: 'plain', margin: { left, right: 15 },
    styles: { font: 'helvetica', fontSize: 9, textColor: ink, cellPadding: { top: 2, bottom: 2, left: 0, right: 4 }, overflow: 'linebreak', lineColor: line, lineWidth: { bottom: 0.15 } },
    columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 62 }, 2: { cellWidth: 28 }, 3: { cellWidth: 62 } },
    body: [
      [label('Party Name'), value(dispatch.partyName || '-'), label('Invoice No.'), value(dispatch.dispatchSlipNumber || '-')],
      [label('Lorry No.'), value(dispatch.logistics?.truckNumber || '-'), label('Invoice Date'), value(date)],
      [label('Destination'), value(dispatch.logistics?.buyerDestination || '-'), label('Supervisor'), value(dispatch.supervisor || '-')]
    ] });
  return doc.lastAutoTable.finalY + 9;
}

const columns = showAmount => (showAmount ? { type: 9, l: 33, w: 44, q: 54, a: 66, m: COL_W } : { type: 10, l: 38, w: 51, q: 64, a: COL_W });

// A row is drawn as one table: Regular lines, Regular subtotal, Top lines, Top subtotal, then the row total.
function rowItems(group) {
  const items = []; let no = 0;
  const add = (lines, top, label, totals) => {
    for (const l of lines) items.push({ kind: 'line', no: ++no, top, l });
    if (lines.length) items.push({ kind: 'sub', label, totals });
  };
  add(group.regularLines, false, 'Regular Subtotal', group.regular);
  add(group.topLines, true, 'Top Subtotal', group.top);
  items.push({ kind: 'total', label: `Row ${group.rowNo} Total`, totals: group.total });
  return items;
}

// Draws items [from, to) of one row table at column x, with the ROW heading and column headings above them.
function drawColumn(doc, x, y, group, items, from, to, showAmount) {
  const c = columns(showAmount);
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...ink).text(`ROW ${group.rowNo}${from ? ' (continued)' : ''}`, x, y + 4.4);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...muted);
  const headY = y + ROW_H + 4;
  doc.text('S.No.', x, headY); doc.text('Type', x + c.type, headY);
  const heads = [['L (ft)', c.l], ['W (ft)', c.w], ['Qty', c.q], [showAmount ? 'Sq ft' : 'Area (sq ft)', c.a]];
  if (showAmount) heads.push(['Amount', c.m]);
  for (const [text, offset] of heads) doc.text(text, x + offset, headY, { align: 'right' });
  doc.setDrawColor(...line).setLineWidth(0.25).line(x, y + ROW_H + HEAD_H - 0.4, x + COL_W, y + ROW_H + HEAD_H - 0.4);
  const top = y + ROW_H + HEAD_H, end = Math.min(to, items.length);
  for (let k = from; k < end; k++) {
    const item = items[k], rowTop = top + (k - from) * ITEM_H, base = rowTop + 3.5;
    if (item.kind === 'line') {
      const l = item.l;
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...ink);
      doc.text(String(item.no), x, base);
      if (item.top) doc.setFontSize(7.5).setTextColor(...accent).text('Top', x + c.type, base).setFontSize(8).setTextColor(...ink);
      doc.text(measure(l.lengthFt), x + c.l, base, { align: 'right' }); doc.text(measure(l.widthFt), x + c.w, base, { align: 'right' });
      doc.text(String(l.quantity), x + c.q, base, { align: 'right' }); doc.text(money(l.sqFt), x + c.a, base, { align: 'right' });
      if (showAmount) doc.text(money(l.lineTotal || 0), x + c.m, base, { align: 'right' });
      doc.setDrawColor(...line).setLineWidth(0.1).line(x, rowTop + ITEM_H - 0.4, x + COL_W, rowTop + ITEM_H - 0.4);
    } else {
      const total = item.kind === 'total';
      if (total) doc.setFillColor(...tint).rect(x, rowTop, COL_W, ITEM_H, 'F');
      doc.setFont('helvetica', total ? 'bold' : 'normal').setFontSize(total ? 8 : 7.5).setTextColor(...(total ? ink : muted));
      doc.text(item.label, x + c.w, base, { align: 'right' });
      doc.text(String(item.totals.quantity), x + c.q, base, { align: 'right' }); doc.text(money(item.totals.sqFt), x + c.a, base, { align: 'right' });
      if (showAmount) doc.text(money(item.totals.amount), x + c.m, base, { align: 'right' });
    }
  }
}

// Two rows sit side by side. A pair taller than the remaining page continues on the next page with the same headings.
function drawPair(doc, pair, startY, newPage) {
  const total = Math.max(...pair.map(entry => entry.items.length)), fixed = ROW_H + HEAD_H;
  let y = startY, index = 0, fresh = false;
  while (index < total) {
    const remaining = total - index;
    let count = remaining;
    if (y + fixed + remaining * ITEM_H > PAGE_BOTTOM) {
      if (index === 0 && !fresh && fixed + remaining * ITEM_H <= PAGE_BOTTOM - CONTENT_TOP) { y = newPage(); fresh = true; continue; }
      const raw = Math.floor((PAGE_BOTTOM - y - fixed) / ITEM_H);
      count = Math.min(raw, remaining - 1);
      if (count < 1 || (count < 4 && !fresh)) { y = newPage(); fresh = true; continue; }
    }
    pair.forEach((entry, column) => { if (index < entry.items.length) drawColumn(doc, COL_X[column], y, entry.group, entry.items, index, index + count, entry.group.showAmount); });
    const bottom = y + fixed + count * ITEM_H;
    if (pair.length > 1) doc.setDrawColor(...line).setLineWidth(0.15).line(105, y, 105, bottom);
    if (index + count >= total) y = bottom + GAP; else { y = newPage(); fresh = true; }
    index += count;
  }
  return y;
}

function drawRows(doc, groups, startY, newPage) {
  let y = startY;
  for (let i = 0; i < groups.length; i += 2) y = drawPair(doc, groups.slice(i, i + 2).map(group => ({ group, items: rowItems(group) })), y, newPage);
  return y;
}

export function ledgerPdf(dispatch, driver = false) {
  assertBill(dispatch, driver ? 'transit slip' : 'invoice');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: `${driver ? 'Driver slip' : 'Buyer invoice'} - ${dispatch.dispatchSlipNumber || 'StoneDesk'}`, creator: 'StoneDesk' });
  const newPage = () => { doc.addPage(); continuationHeader(doc, dispatch, driver); return CONTENT_TOP; };
  let y = header(doc, dispatch, driver);
  // Only dimensions and stored areas are read on the driver path.
  const groups = rowGroups(billRows(dispatch, !driver)).map(group => ({ ...group, showAmount: !driver }));
  const overview = rowOverview(groups);
  y = drawRows(doc, groups, y, newPage);

  if (y + 50 > PAGE_BOTTOM) y = newPage();
  const summaryStart = y, startPage = doc.getCurrentPageInfo().pageNumber;
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ink).text('ORDER SUMMARY', left, y + 3);
  if (!driver) {
    const s = dispatch.summary;
    const topAmount = round2(overview.topAmount);
    doc.text('PAYMENT SUMMARY', COL_X[1], y + 3);
    autoTable(doc, { startY: y + 6, theme: 'plain', pageBreak: 'avoid', rowPageBreak: 'avoid',
      body: [['Material Amount', `Rs. ${money(round2(s.baseMaterialTotal - topAmount))}`], ['Top Material Amount', `Rs. ${money(topAmount)}`], ['Loading / Royalty', `Rs. ${money(s.loadingAndRoyaltyFees)}`],
        [{ content: 'NET PAYABLE', styles: { fontStyle: 'bold', textColor: accent, fillColor: tint, lineWidth: { top: 0.25 }, minCellHeight: 12 } },
          { content: `Rs. ${money(s.netBillableAmount)}`, styles: { fontStyle: 'bold', fontSize: 12, textColor: accent, fillColor: tint, lineWidth: { top: 0.25 } } }]],
      margin: { left: COL_X[1], right: 15 },
      styles: { font: 'helvetica', fontSize: 9, textColor: muted, cellPadding: 2.6, lineColor: line, lineWidth: 0 },
      columnStyles: { 0: { cellWidth: 43 }, 1: { cellWidth: 41, halign: 'right' } }
    });
  }
  const bold = { fontStyle: 'bold', fillColor: tint, textColor: ink };
  autoTable(doc, { startY: summaryStart + 6, theme: 'plain', margin: { left, right: 105, top: CONTENT_TOP, bottom: 22 }, showFoot: 'lastPage',
    head: [driver ? ['Row', 'Pieces', 'Area (sq ft)', 'Top (sq ft)', 'Total (sq ft)'] : ['Row', 'Pcs', 'Reg. sq ft', 'Top sq ft', 'Total sq ft', 'Amount (Rs.)']],
    body: groups.map(g => [`Row ${g.rowNo}`, String(g.total.quantity), money(g.regular.sqFt), money(g.top.sqFt), money(g.total.sqFt), ...(driver ? [] : [money(g.total.amount)])]),
    foot: [[{ content: 'Total', styles: bold }, { content: String(overview.pieces), styles: bold }, { content: money(overview.regularSqFt), styles: bold }, { content: money(overview.topSqFt), styles: bold }, { content: money(overview.totalSqFt), styles: bold }, ...(driver ? [] : [{ content: money(overview.totalAmount), styles: bold }])]],
    styles: { font: 'helvetica', fontSize: driver ? 8 : 7.5, cellPadding: { top: 0.9, bottom: 1.1, left: 1.2, right: 1.2 }, textColor: ink, lineColor: line, lineWidth: { bottom: 0.15 } },
    headStyles: { fillColor: tint, fontSize: 7, fontStyle: 'normal', textColor: muted, lineWidth: { bottom: 0.25 } },
    footStyles: { lineWidth: { top: 0.25, bottom: 0.25 } },
    columnStyles: driver
      ? { 0: { cellWidth: 17 }, 1: { cellWidth: 15, halign: 'right' }, 2: { cellWidth: 20, halign: 'right' }, 3: { cellWidth: 19, halign: 'right' }, 4: { cellWidth: 19, halign: 'right' } }
      : { 0: { cellWidth: 13 }, 1: { cellWidth: 10, halign: 'right' }, 2: { cellWidth: 15, halign: 'right' }, 3: { cellWidth: 14, halign: 'right' }, 4: { cellWidth: 15, halign: 'right' }, 5: { cellWidth: 23, halign: 'right' } },
    didParseCell: data => { if (['head', 'foot'].includes(data.section) && data.column.index >= 1) data.cell.styles.halign = 'right'; },
    willDrawPage: data => { if (data.pageNumber > startPage) continuationHeader(doc, dispatch, driver); }
  });

  const pages = doc.getNumberOfPages();
  doc.setPage(pages).setDrawColor(...line).setLineWidth(0.2).line(right - 58, 270, right, 270);
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...ink).text(doc.splitTextToSize(dispatch.businessSnapshot?.businessName || 'StoneDesk', 58).slice(0, 1), right, 274, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...muted).text('Authorized Signatory', right, 278, { align: 'right' });
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page).setDrawColor(...line).setLineWidth(0.2).line(left, 282, right, 282);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...muted);
    doc.text(driver ? 'Driver copy · Prices hidden' : 'All amounts in INR', left, 287);
    doc.text(`Page ${page} of ${pages}`, right, 287, { align: 'right' });
  }
  const safeId = String(dispatch.dispatchSlipNumber || 'Unknown').replace(/[^a-zA-Z0-9-]/g, '_');
  return { blob: doc.output('blob'), filename: `StoneDesk-${driver ? 'Driver-Slip' : 'Buyer-Invoice'}-${safeId}.pdf` };
}
