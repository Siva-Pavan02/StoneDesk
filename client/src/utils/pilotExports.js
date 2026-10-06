import { ledgerPdf } from './ledgerPdf.js';
import * as XLSX from 'xlsx';
import { assertBill, billRows, subtotals } from './billData.js';

function filename(dispatch, kind, ext) {
  return `GraniteSync-${kind}-${String(dispatch.dispatchSlipNumber || 'Unknown').replace(/[^a-zA-Z0-9-]/g, '_')}.${ext}`;
}
export const buyerPdf = dispatch => ledgerPdf(dispatch);
export const driverPdf = dispatch => ledgerPdf(dispatch, true);
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
