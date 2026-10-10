import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { assertBill, billRows, rowGroups, rowOverview } from './billData.js';
import { round2 } from './loadMath.js';

const ink = [32, 61, 54];
const muted = [82, 102, 97];
const accent = [23, 100, 93];
const line = [219, 230, 223];
const tint = [241, 246, 243];
const totalTint = [224, 236, 230];
const left = 15, right = 195;
// Rows flow down three columns in order, then onto the next page.
const COL_W = 56, COL_X = [left, 77, 139], SUMMARY_X = 111;
const PAGE_BOTTOM = 266, CONTENT_TOP = 30, SUMMARY_BOTTOM = 262;
const ROW_H = 6, HEAD_H = 5, ITEM_H = 4.6, GAP = 5;

export function billFilename(dispatch, kind, ext) {
  const party = String(dispatch.partyName || '').trim().replace(/[^\p{L}\p{M}\p{N}-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  const time = new Date(dispatch.date);
  const date = Number.isNaN(time.getTime()) ? 'undated' : time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).replace(/\s+/g, '-');
  return `${party ? `${party}-` : ''}${kind}-${date}.${ext}`;
}
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

function header(doc, dispatch, driver, rowCount) {
  const business = dispatch.businessSnapshot || {};
  logo(doc, business.logoDataUrl, left, 12, 18, true);
  // Brand block beside the logo.
  const brandX = left + 23, brandWidth = 92;
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...ink);
  const name = doc.splitTextToSize(business.businessName || 'StoneDesk', brandWidth).slice(0, 2);
  doc.text(name, brandX, 17.5, { lineHeightFactor: 1.15 });
  let brandY = 17.5 + (name.length - 1) * 6.1 + 5.2;
  const contact = [business.address, business.phone].filter(Boolean).join('  ·  ');
  if (contact) {
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...muted);
    const lines = doc.splitTextToSize(contact, brandWidth).slice(0, 2);
    doc.text(lines, brandX, brandY, { lineHeightFactor: 1.35 }); brandY += (lines.length - 1) * 3.8;
  }
  // Document title, number and date on the right.
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...accent);
  doc.text(driver ? 'DRIVER SLIP' : 'BUYER INVOICE', right, 17, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...muted);
  const number = doc.splitTextToSize(`No. ${dispatch.dispatchSlipNumber || '-'}`, 62).slice(0, 2);
  doc.text(number, right, 22, { align: 'right', lineHeightFactor: 1.3 });
  let metaY = 22 + number.length * 3.5;
  const date = new Date(dispatch.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...ink).text(date, right, metaY + 0.5, { align: 'right' });
  if (driver) { metaY += 4.2; doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...accent).text('Prices hidden', right, metaY + 0.5, { align: 'right' }); }
  const dividerY = Math.max(brandY + 2, metaY + 2.5, 32);
  doc.setDrawColor(...line).setLineWidth(0.25).line(left, dividerY, right, dividerY);
  // Details strip: four labelled fields in one tinted box.
  const boxY = dividerY + 4, cellW = (right - left) / 4;
  const fields = [['PARTY', dispatch.partyName], ['LORRY NO.', dispatch.logistics?.truckNumber], ['DESTINATION', dispatch.logistics?.buyerDestination], ['SUPERVISOR', dispatch.supervisor]];
  doc.setFont('helvetica', 'bold').setFontSize(9);
  const values = fields.map(([, value]) => doc.splitTextToSize(String(value || '-'), cellW - 7).slice(0, 2));
  const boxH = 13 + (Math.max(...values.map(v => v.length)) - 1) * 3.9;
  doc.setFillColor(...tint).setDrawColor(...line).setLineWidth(0.2).roundedRect(left, boxY, right - left, boxH, 1.5, 1.5, 'FD');
  fields.forEach(([label], i) => {
    const x = left + 4 + i * cellW;
    if (i) doc.setDrawColor(...line).setLineWidth(0.15).line(left + i * cellW, boxY + 2.5, left + i * cellW, boxY + boxH - 2.5);
    doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...muted).text(label, x, boxY + 4.8);
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ink).text(values[i], x, boxY + 10, { lineHeightFactor: 1.2 });
  });
  const rowsY = boxY + boxH + 7;
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ink).text('ROWS', left, rowsY);
  const labelW = doc.getTextWidth('ROWS ');
  doc.setFont('helvetica', 'normal').setTextColor(...muted).text(`· ${rowCount}`, left + labelW, rowsY);
  return rowsY + 3;
}

const columns = showAmount => (showAmount ? { l: 13, w: 21, q: 28, a: 41, m: COL_W } : { l: 16, w: 26, q: 36, a: COL_W });

// A row is drawn as one table: Regular lines, Regular subtotal, Top lines, Top subtotal, then the row total.
function rowItems(group) {
  const items = [];
  const add = (lines, top, label, totals) => {
    for (const l of lines) items.push({ kind: 'line', top, l });
    if (lines.length) items.push({ kind: 'sub', label, totals });
  };
  add(group.regularLines, false, 'Reg. subtotal', group.regular);
  add(group.topLines, true, 'Top subtotal', group.top);
  items.push({ kind: 'total', label: 'Total', totals: group.total });
  return items;
}

// Draws items [from, to) of one row table at column x, with the row number and column headings above them.
function drawColumn(doc, x, y, group, items, from, to, showAmount) {
  const c = columns(showAmount);
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ink).text(`${group.rowNo}${from ? ' (continued)' : ''}`, x, y + 4);
  doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...muted);
  const headY = y + ROW_H + 3.5;
  doc.text('Type', x, headY);
  const heads = [['L (ft)', c.l], ['W (ft)', c.w], ['Qty', c.q], [showAmount ? 'Sq ft' : 'Area (sq ft)', c.a]];
  if (showAmount) heads.push(['Amount', c.m]);
  for (const [text, offset] of heads) doc.text(text, x + offset, headY, { align: 'right' });
  doc.setDrawColor(...line).setLineWidth(0.25).line(x, y + ROW_H + HEAD_H - 0.4, x + COL_W, y + ROW_H + HEAD_H - 0.4);
  const top = y + ROW_H + HEAD_H, end = Math.min(to, items.length);
  for (let k = from; k < end; k++) {
    const item = items[k], rowTop = top + (k - from) * ITEM_H, base = rowTop + 3.2;
    if (item.kind === 'line') {
      const l = item.l;
      doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...ink);
      if (item.top) doc.setFontSize(6.5).setTextColor(...accent).text('Top', x, base).setFontSize(7).setTextColor(...ink);
      doc.text(measure(l.lengthFt), x + c.l, base, { align: 'right' }); doc.text(measure(l.widthFt), x + c.w, base, { align: 'right' });
      doc.text(String(l.quantity), x + c.q, base, { align: 'right' }); doc.text(money(l.sqFt), x + c.a, base, { align: 'right' });
      if (showAmount) doc.text(money(l.lineTotal || 0), x + c.m, base, { align: 'right' });
      doc.setDrawColor(...line).setLineWidth(0.1).line(x, rowTop + ITEM_H - 0.4, x + COL_W, rowTop + ITEM_H - 0.4);
    } else {
      const total = item.kind === 'total';
      doc.setFillColor(...(total ? totalTint : tint)).rect(x, rowTop, COL_W, ITEM_H, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(total ? 7 : 6.5).setTextColor(...ink);
      doc.text(item.label, x + 1, base);
      doc.text(String(item.totals.quantity), x + c.q, base, { align: 'right' }); doc.text(money(item.totals.sqFt), x + c.a, base, { align: 'right' });
      if (showAmount) doc.text(money(item.totals.amount), x + c.m, base, { align: 'right' });
    }
  }
}

// Rows flow down column 1, then 2, then 3, then continue on the next page.
// When the remaining rows and the summary (reserve) fit on the page, the columns are balanced to similar heights.
function drawRows(doc, groups, startY, newPage, reserve) {
  const fixed = ROW_H + HEAD_H, count = COL_X.length;
  const queue = groups.map(group => ({ group, items: rowItems(group), from: 0 }));
  const need = entry => fixed + (entry.items.length - entry.from) * ITEM_H;
  const draw = (entry, column, y, to) => drawColumn(doc, COL_X[column], y, entry.group, entry.items, entry.from, to, entry.group.showAmount);
  // Returns how many whole rows land in each column when each column may grow to cap, or null if they do not fit.
  const pack = (list, cap) => {
    const cols = []; let used = Infinity;
    for (const entry of list) {
      const h = need(entry);
      if (h > cap) return null;
      if (used + h > cap) { if (cols.length === count) return null; cols.push(0); used = 0; }
      cols[cols.length - 1]++; used += h + GAP;
    }
    return cols;
  };
  // Draws the first rows of the queue in balanced columns that each stay within space; returns the lowest bottom.
  const balanced = (list, space) => {
    let lo = 0, hi = space;
    while (hi - lo > 0.5) { const mid = (lo + hi) / 2; if (pack(list, mid)) hi = mid; else lo = mid; }
    const cols = pack(list, hi);
    let bottom = colTop;
    cols.forEach((n, column) => {
      let y = colTop;
      for (let i = 0; i < n; i++) { const entry = queue.shift(), h = need(entry); draw(entry, column, y, entry.items.length); y += h + GAP; }
      bottom = Math.max(bottom, y);
    });
    if (cols.length > 1) dividers(colTop, bottom - GAP);
    return bottom;
  };
  const dividers = (top, bottom) => { for (let i = 1; i < count; i++) doc.setDrawColor(...line).setLineWidth(0.15).line(COL_X[i] - 3, top, COL_X[i] - 3, bottom); };
  let colTop = startY;
  for (;;) {
    const space = SUMMARY_BOTTOM - reserve - colTop;
    if (space > 0 && pack(queue, space)) return balanced(queue, space);
    // Everything fits but the summary does not: keep the last rows back so the summary shares the next page with them.
    if (pack(queue, PAGE_BOTTOM - colTop) && (queue.length > 1 || colTop > CONTENT_TOP)) {
      if (queue.length > 1) balanced(queue.slice(0, -1), PAGE_BOTTOM - colTop);
      colTop = newPage();
      continue;
    }
    let bottom = colTop, last = 0;
    for (let column = 0; column < count && queue.length; column++) {
      let y = colTop;
      while (queue.length) {
        const entry = queue[0], rest = entry.items.length - entry.from, h = need(entry);
        if (y + h <= PAGE_BOTTOM) { draw(entry, column, y, entry.items.length); y += h + GAP; queue.shift(); continue; }
        const fit = Math.min(Math.floor((PAGE_BOTTOM - y - fixed) / ITEM_H), rest - 1);
        if (fit >= 4) { draw(entry, column, y, entry.from + fit); entry.from += fit; y += fixed + fit * ITEM_H + GAP; }
        break;
      }
      bottom = Math.max(bottom, y); last = column;
    }
    if (last > 0) dividers(colTop, bottom - GAP);
    if (!queue.length) return bottom;
    colTop = newPage();
  }
}

export function ledgerPdf(dispatch, driver = false) {
  assertBill(dispatch, driver ? 'transit slip' : 'invoice');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: `${driver ? 'Driver slip' : 'Buyer invoice'} - ${dispatch.dispatchSlipNumber || 'StoneDesk'}`, creator: 'StoneDesk' });
  const newPage = () => { doc.addPage(); continuationHeader(doc, dispatch, driver); return CONTENT_TOP; };
  // Only dimensions and stored areas are read on the driver path.
  const groups = rowGroups(billRows(dispatch, !driver)).map(group => ({ ...group, showAmount: !driver }));
  let y = header(doc, dispatch, driver, groups.length);
  const overview = rowOverview(groups);

  const s = dispatch.summary, topAmount = round2(overview.topAmount);
  const payment = driver ? null : {
    theme: 'plain', pageBreak: 'avoid', rowPageBreak: 'avoid',
    body: [['Material Amount', `Rs. ${money(round2(s.baseMaterialTotal - topAmount))}`], ['Top Material Amount', `Rs. ${money(topAmount)}`], ['Loading / Royalty', `Rs. ${money(s.loadingAndRoyaltyFees)}`],
      [{ content: 'NET PAYABLE', styles: { fontStyle: 'bold', textColor: accent, fillColor: tint, lineWidth: { top: 0.25 }, minCellHeight: 12 } },
        { content: `Rs. ${money(s.netBillableAmount)}`, styles: { fontStyle: 'bold', fontSize: 12, textColor: accent, fillColor: tint, lineWidth: { top: 0.25 } } }]],
    margin: { left: SUMMARY_X, right: 15 },
    styles: { font: 'helvetica', fontSize: 9, textColor: muted, cellPadding: 2.6, lineColor: line, lineWidth: 0 },
    columnStyles: { 0: { cellWidth: 43 }, 1: { cellWidth: 41, halign: 'right' } }
  };
  const bold = { fontStyle: 'bold', fillColor: tint, textColor: ink };
  const order = { theme: 'plain', margin: { left, right: 105, top: CONTENT_TOP, bottom: 22 }, showFoot: 'lastPage',
    head: [driver ? ['#', 'Pieces', 'Area (sq ft)', 'Top (sq ft)', 'Total (sq ft)'] : ['#', 'Pcs', 'Reg. sq ft', 'Top sq ft', 'Total sq ft', 'Amount (Rs.)']],
    body: groups.map(g => [String(g.rowNo), String(g.total.quantity), money(g.regular.sqFt), money(g.top.sqFt), money(g.total.sqFt), ...(driver ? [] : [money(g.total.amount)])]),
    foot: [[{ content: 'Total', styles: bold }, { content: String(overview.pieces), styles: bold }, { content: money(overview.regularSqFt), styles: bold }, { content: money(overview.topSqFt), styles: bold }, { content: money(overview.totalSqFt), styles: bold }, ...(driver ? [] : [{ content: money(overview.totalAmount), styles: bold }])]],
    styles: { font: 'helvetica', fontSize: driver ? 8 : 7.5, cellPadding: { top: 0.9, bottom: 1.1, left: 1.2, right: 1.2 }, textColor: ink, lineColor: line, lineWidth: { bottom: 0.15 } },
    headStyles: { fillColor: tint, fontSize: 7, fontStyle: 'normal', textColor: muted, lineWidth: { bottom: 0.25 } },
    footStyles: { lineWidth: { top: 0.25, bottom: 0.25 } },
    columnStyles: driver
      ? { 0: { cellWidth: 17 }, 1: { cellWidth: 15, halign: 'right' }, 2: { cellWidth: 20, halign: 'right' }, 3: { cellWidth: 19, halign: 'right' }, 4: { cellWidth: 19, halign: 'right' } }
      : { 0: { cellWidth: 13 }, 1: { cellWidth: 10, halign: 'right' }, 2: { cellWidth: 15, halign: 'right' }, 3: { cellWidth: 14, halign: 'right' }, 4: { cellWidth: 15, halign: 'right' }, 5: { cellWidth: 23, halign: 'right' } },
    didParseCell: data => { if (['head', 'foot'].includes(data.section) && data.column.index >= 1) data.cell.styles.halign = 'right'; }
  };

  // The bill summary follows the rows directly.
  const height = options => { const probe = new jsPDF({ unit: 'mm', format: 'a4' }); autoTable(probe, { ...options, startY: CONTENT_TOP }); return probe.lastAutoTable.finalY - CONTENT_TOP; };
  const orderH = height(order), payH = payment ? height(payment) : 0;
  const blockH = 6 + Math.max(orderH, payH);
  y = drawRows(doc, groups, y, newPage, blockH + 3);
  y += 3;
  if (y + blockH > SUMMARY_BOTTOM) y = newPage();
  const startPage = doc.getCurrentPageInfo().pageNumber;
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ink).text('ORDER SUMMARY', left, y + 3);
  if (payment) {
    // Both summaries end on the same line.
    const payY = y + Math.max(0, orderH - payH);
    doc.text('PAYMENT SUMMARY', SUMMARY_X, payY + 3);
    autoTable(doc, { ...payment, startY: payY + 6 });
  }
  autoTable(doc, { ...order, startY: y + 6,
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
  return { blob: doc.output('blob'), filename: billFilename(dispatch, driver ? 'Driver-Slip' : 'Invoice', 'pdf') };
}
