import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { assertBill, billRows, subtotals } from './billData.js';

const currency = n => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function filename(dispatch, kind, ext) {
  return `GraniteSync-${kind}-${String(dispatch.dispatchSlipNumber || 'Unknown').replace(/[^a-zA-Z0-9-]/g, '_')}.${ext}`;
}
function branding(doc, dispatch, title) {
  const business = dispatch.businessSnapshot || { businessName: 'GraniteSync' };
  if (business.logoDataUrl) doc.addImage(business.logoDataUrl, 'PNG', 15, 12, 20, 20, undefined, 'FAST');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  const name = doc.splitTextToSize(business.businessName || 'GraniteSync', 150);
  doc.text(name, 40, 18);
  let y = Math.max(36, 18 + name.length * 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  for (const line of [business.address, business.phone, title,
    `Slip: ${dispatch.dispatchSlipNumber || 'N/A'}`,
    `Date: ${new Date(dispatch.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} | Truck: ${dispatch.logistics?.truckNumber || 'N/A'}`,
    `Party: ${dispatch.partyName || 'N/A'}`,
    `Destination: ${dispatch.logistics?.buyerDestination || 'N/A'} | Supervisor: ${dispatch.supervisor || 'N/A'}`]) {
    if (!line) continue;
    const lines = doc.splitTextToSize(String(line), 180);
    doc.text(lines, 15, y); y += lines.length * 5 + 2;
  }
  return y + 3;
}
function table(doc, y, head, body) {
  autoTable(doc, { startY: y, head: [head], body, theme: 'grid',
    margin: { left: 15, right: 15, top: 15, bottom: 18 },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [17, 94, 89] } });
  return doc.lastAutoTable.finalY + 8;
}
export function buyerPdf(dispatch) {
  assertBill(dispatch);
  const doc = new jsPDF();
  const rows = billRows(dispatch);
  let y = branding(doc, dispatch, 'Buyer load bill');
  y = table(doc, y, ['Product / finish', 'Type', 'L (ft)', 'W (ft)', 'Qty', 'Sq ft', 'Rate', 'Amount'], rows.map(r => [
    `${r.stoneType} / ${r.finish}`, r.category, r.lengthFt, r.widthFt, r.quantity, r.sqFt.toFixed(2), currency(r.ratePerSqFt), r.lineTotal === undefined ? 'See subtotal' : currency(r.lineTotal)
  ]));
  if (dispatch.inventory.some(g => g.measurementRows?.length)) {
    y = table(doc, y, ['Product / finish / type', 'Pieces', 'Sq ft', 'Amount'], subtotals(rows).map(g => [`${g.stoneType} / ${g.finish} / ${g.category}`, g.quantity, g.sqFt.toFixed(2), currency(g.lineTotal)]));
  } else {
    y = table(doc, y, ['Product / finish', 'Stored group amount'], dispatch.inventory.map(g => [`${g.stoneType} / ${g.finish}`, currency(g.lineTotal)]));
  }
  const s = dispatch.summary;
  if (y > 225) { doc.addPage(); y = 20; }
  table(doc, y, ['Summary', 'Total'], [
    ['Total pieces', s.totalPieces ?? rows.reduce((sum, r) => sum + r.quantity, 0)],
    ['Total square feet', s.totalDispatchVolumeSqFt.toFixed(2)],
    ['Material amount', currency(s.baseMaterialTotal)], ['Loading / royalty', currency(s.loadingAndRoyaltyFees)], ['Net payable', currency(s.netBillableAmount)]
  ]);
  return { blob: doc.output('blob'), filename: filename(dispatch, 'Buyer-Invoice', 'pdf') };
}
export function driverPdf(dispatch) {
  assertBill(dispatch, 'transit slip');
  const doc = new jsPDF();
  // This path never reads rate or amount fields, including from summary.
  const rows = billRows(dispatch, false);
  let y = branding(doc, dispatch, 'Driver transit slip');
  y = table(doc, y, ['Product / finish', 'Type', 'L (ft)', 'W (ft)', 'Qty', 'Sq ft'], rows.map(r => [
    `${r.stoneType} / ${r.finish}`, r.category, r.lengthFt, r.widthFt, r.quantity, r.sqFt.toFixed(2)
  ]));
  if (y > 260) { doc.addPage(); y = 20; }
  table(doc, y, ['Total pieces', 'Total square feet'], [[rows.reduce((sum, r) => sum + r.quantity, 0), rows.reduce((sum, r) => sum + r.sqFt, 0).toFixed(2)]]);
  return { blob: doc.output('blob'), filename: filename(dispatch, 'Driver-Slip', 'pdf') };
}
export function buyerExcel(dispatch) {
  assertBill(dispatch, 'Excel invoice');
  const business = dispatch.businessSnapshot || { businessName: 'GraniteSync' };
  const rows = billRows(dispatch);
  const data = [
    [business.businessName || 'GraniteSync'], [business.address || '', business.phone || ''], ['Buyer load bill'],
    ['Slip', dispatch.dispatchSlipNumber, 'Date', new Date(dispatch.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })],
    ['Party', dispatch.partyName || '', 'Truck', dispatch.logistics?.truckNumber || ''],
    ['Destination', dispatch.logistics?.buyerDestination || '', 'Supervisor', dispatch.supervisor || ''], [],
    ['Product', 'Finish', 'Type', 'Length (ft)', 'Width (ft)', 'Quantity', 'Sq ft', 'Rate (INR)', 'Amount (INR)'],
    ...rows.map(r => [r.stoneType, r.finish, r.category, r.lengthFt, r.widthFt, r.quantity, r.sqFt, r.ratePerSqFt, r.lineTotal ?? 'See subtotal']), []
  ];
  if (dispatch.inventory.some(g => g.measurementRows?.length)) {
    data.push(['Product subtotals', 'Finish', 'Type', '', '', 'Quantity', 'Sq ft', 'Rate (INR)', 'Amount (INR)']);
    for (const g of subtotals(rows)) data.push([g.stoneType, g.finish, g.category, '', '', g.quantity, g.sqFt, g.ratePerSqFt, g.lineTotal]);
  } else {
    for (const g of dispatch.inventory) data.push([g.stoneType, g.finish, 'Stored subtotal', '', '', g.pieces.length, g.totalSqFt ?? g.pieces.reduce((n, p) => n + p.sqFt, 0), g.ratePerSqFt, g.lineTotal]);
  }
  const s = dispatch.summary;
  data.push([], ['Total pieces', s.totalPieces ?? rows.reduce((n, r) => n + r.quantity, 0)], ['Total square feet', s.totalDispatchVolumeSqFt],
    ['Material amount', s.baseMaterialTotal], ['Loading / royalty', s.loadingAndRoyaltyFees], ['Net payable', s.netBillableAmount]);
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [24, 18, 14, 12, 12, 10, 14, 16, 18].map(wch => ({ wch }));
  const range = XLSX.utils.decode_range(sheet['!ref']);
  for (let r = 8; r <= range.e.r; r++) for (let c = 0; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    if (cell?.t === 'n') cell.z = c === 5 ? '0' : '#,##0.00';
  }
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Buyer Invoice');
  return { blob: new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename: filename(dispatch, 'Buyer-Invoice', 'xlsx') };
}
