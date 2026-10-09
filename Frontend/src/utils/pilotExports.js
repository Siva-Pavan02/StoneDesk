import { ledgerPdf } from './ledgerPdf.js';
import * as XLSX from 'xlsx';
import { assertBill, billRows, rowGroups, rowOverview } from './billData.js';
import { round2 } from './loadMath.js';

function filename(dispatch, kind, ext) {
  return `StoneDesk-${kind}-${String(dispatch.dispatchSlipNumber || 'Unknown').replace(/[^a-zA-Z0-9-]/g, '_')}.${ext}`;
}
export const buyerPdf = dispatch => ledgerPdf(dispatch);
export const driverPdf = dispatch => ledgerPdf(dispatch, true);
export function buyerExcel(dispatch) {
  assertBill(dispatch, 'Excel invoice');
  const business = dispatch.businessSnapshot || { businessName: 'StoneDesk' };
  const groups = rowGroups(billRows(dispatch)), overview = rowOverview(groups);
  const whole = new Set(); // cells that hold counts rather than areas or amounts
  const data = [
    [business.businessName || 'StoneDesk'], [business.address || '', business.phone || ''], ['Buyer invoice'],
    ['Invoice No.', dispatch.dispatchSlipNumber, 'Invoice Date', new Date(dispatch.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })],
    ['Party Name', dispatch.partyName || '', 'Lorry No.', dispatch.logistics?.truckNumber || ''],
    ['Destination', dispatch.logistics?.buyerDestination || '', 'Supervisor', dispatch.supervisor || ''], [],
    ['Row', 'S.No.', 'Type', 'L (ft)', 'W (ft)', 'Qty', 'Area (sq ft)', 'Amount (INR)']
  ];
  const add = (row, counts = []) => { counts.forEach(c => whole.add(`${data.length},${c}`)); data.push(row); };
  for (const g of groups) {
    for (const [type, lines, totals, label] of [['', g.regularLines, g.regular, 'Regular Subtotal'], ['Top', g.topLines, g.top, 'Top Subtotal']]) {
      lines.forEach((l, i) => add([g.rowNo, i + 1, type, l.lengthFt, l.widthFt, l.quantity, l.sqFt, l.lineTotal || 0], [0, 1, 5]));
      if (lines.length) add([g.rowNo, '', label, '', '', totals.quantity, totals.sqFt, totals.amount], [0, 5]);
    }
    add([g.rowNo, '', `Row ${g.rowNo} Total`, '', '', g.total.quantity, g.total.sqFt, g.total.amount], [0, 5]);
    add([]);
  }
  add(['ORDER SUMMARY']);
  add(['Row', 'Pieces', 'Area (sq ft)', 'Top (sq ft)', 'Total (sq ft)', 'Amount (INR)']);
  for (const g of groups) add([`Row ${g.rowNo}`, g.total.quantity, g.regular.sqFt, g.top.sqFt, g.total.sqFt, g.total.amount], [1]);
  add(['Total', overview.pieces, overview.regularSqFt, overview.topSqFt, overview.totalSqFt, overview.totalAmount], [1]);
  const s = dispatch.summary, topAmount = round2(overview.topAmount);
  add([]);
  add(['PAYMENT SUMMARY']);
  add(['Material Amount', round2(s.baseMaterialTotal - topAmount)]);
  add(['Top Material Amount', topAmount]);
  add(['Loading / Royalty', s.loadingAndRoyaltyFees]);
  add(['Net payable', s.netBillableAmount]);
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [22, 14, 16, 12, 12, 10, 16, 16].map(wch => ({ wch }));
  const range = XLSX.utils.decode_range(sheet['!ref']);
  for (let r = 7; r <= range.e.r; r++) for (let c = 0; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    if (cell?.t === 'n') cell.z = whole.has(`${r},${c}`) ? '0' : '#,##0.00';
  }
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Buyer Invoice');
  return { blob: new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename: filename(dispatch, 'Buyer-Invoice', 'xlsx') };
}
