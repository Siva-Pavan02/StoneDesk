import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { assertBill, billRows } from './billData.js';

const ink = [28, 32, 30];
const money = n => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function measure(value) {
  const n = Number(value), whole = Math.floor(n), quarter = Math.round((n - whole) * 4);
  if (Math.abs(n * 4 - Math.round(n * 4)) < 1e-8 && quarter > 0 && quarter < 4) return `${whole || ''}${['', '¼', '½', '¾'][quarter]}`;
  return String(n);
}

function header(doc, dispatch, driver) {
  const business = dispatch.businessSnapshot || {};
  const hasLogo = Boolean(business.logoDataUrl);
  if (hasLogo) doc.addImage(business.logoDataUrl, 'PNG', 13, 11, 24, 24, undefined, 'FAST');
  const left = hasLogo ? 42 : 13, center = (left + 197) / 2;
  doc.setFont('times', 'italic').setFontSize(28).setTextColor(133, 42, 42);
  const name = doc.splitTextToSize(business.businessName || 'StoneDesk', 197 - left);
  doc.text(name, center, 23, { align: 'center' });
  let y = 21 + name.length * 8;
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...ink);
  const address = [business.address, business.phone].filter(Boolean).join('  |  ');
  if (address) {
    const lines = doc.splitTextToSize(address, 184);
    doc.text(lines, 105, y, { align: 'center' }); y += lines.length * 4;
  }
  doc.setDrawColor(52, 88, 70).setLineWidth(0.4).line(13, y + 1, 197, y + 1);
  y += 6;
  const date = new Date(dispatch.date).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replaceAll('/', '-');
  autoTable(doc, { startY: y, theme: 'plain', margin: { left: 13, right: 13 },
    styles: { font: 'helvetica', fontSize: 10, textColor: ink, cellPadding: { top: 1, bottom: 2, left: 0, right: 3 } },
    columnStyles: { 0: { cellWidth: 84 }, 1: { cellWidth: 55 }, 2: { cellWidth: 45 } },
    body: [[`Party name: ${dispatch.partyName || '-'}`, `Lorry no: ${dispatch.logistics?.truckNumber || '-'}`, `Date: ${date}`],
      [{ content: `${driver ? 'DRIVER SLIP' : 'LOAD BILL'}  |  ${dispatch.dispatchSlipNumber || '-'}`, colSpan: 3, styles: { fontSize: 8 } }],
      [{ content: `Destination: ${dispatch.logistics?.buyerDestination || '-'}  |  Supervisor: ${dispatch.supervisor || '-'}`, colSpan: 3, styles: { fontSize: 8 } }]] });
  return doc.lastAutoTable.finalY + 3;
}

export function ledgerPdf(dispatch, driver = false) {
  assertBill(dispatch, driver ? 'transit slip' : 'invoice');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = header(doc, dispatch, driver);
  const allRows = billRows(dispatch, !driver);
  const body = [];
  dispatch.inventory.forEach((group, index) => {
    // Only read dimensions and stored areas on the driver path.
    const rows = billRows({ inventory: [group] }, !driver);
    const title = `(${index + 1})  ${group.stoneType} / ${group.finish}`;
    for (const category of ['Regular', 'TOP']) {
      const entries = rows.filter(r => r.category === category);
      if (!entries.length) continue;
      entries.forEach((r, rowIndex) => body.push([
        category === 'TOP' ? `${index + 1} TOP` : String(index + 1),
        `${rowIndex === 0 ? title + '\n' : ''}${measure(r.lengthFt)} × ${measure(r.widthFt)}`, String(r.quantity), measure(r.sqFt),
        ...(!driver ? [money(group.ratePerSqFt), r.lineTotal == null ? '-' : money(r.lineTotal)] : [])
      ]));
      body.push([
        '', { content: `Batch ${index + 1} ${category === 'TOP' ? 'TOP ' : ''}subtotal`, styles: { fontSize: 8 } },
        { content: String(entries.reduce((n, r) => n + r.quantity, 0)), styles: { fontStyle: 'bold', lineWidth: { top: 0.2, bottom: 0.2, left: 0.2, right: 0.2 } } },
        { content: measure(Math.round(entries.reduce((n, r) => n + r.sqFt, 0) * 100) / 100), styles: { fontStyle: 'bold', lineWidth: 0.2 } },
        ...(!driver ? ['', {content: money(group.measurementRows?.length ? entries.reduce((n, r) => n + r.lineTotal, 0) : group.lineTotal), styles:{fontStyle:'bold',lineWidth:0.2}}] : [])
      ]);
    }
  });
  const pieces = dispatch.summary?.totalPieces ?? allRows.reduce((n, r) => n + r.quantity, 0);
  const area = driver ? Math.round(allRows.reduce((n, r) => n + r.sqFt, 0) * 100) / 100 : dispatch.summary.totalDispatchVolumeSqFt;
  body.push([{ content: 'Running total area (sq ft)', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', lineWidth: 0.2 } },
    { content: String(pieces), styles: { fontStyle: 'bold', lineWidth: 0.2 } },
    { content: measure(area), styles: { fontStyle: 'bold', lineWidth: 0.2 } }, ...(!driver ? ['', money(dispatch.summary.baseMaterialTotal)] : [])]);
  autoTable(doc, { startY: y, margin: { left: 13, right: 13, top: 24, bottom: 18 }, theme: 'plain',
    head: [['Batch', 'Dimensions (ft × ft)', 'Pieces', 'Area (sq ft)', ...(!driver ? ['Rate (INR)', 'Amount (INR)'] : [])]], body,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 0.8, bottom: 0.6, left: 2.5, right: 2.5 },
      textColor: ink, lineColor: [100, 107, 103], lineWidth: { left: 0.2, right: 0.2, top: 0, bottom: 0 }, overflow: 'linebreak' },
    headStyles: { fillColor: [223, 226, 223], fontSize: 9, fontStyle: 'bold', lineWidth: 0.2, textColor: ink },
    columnStyles: driver ? { 0:{cellWidth:20}, 1:{cellWidth:98}, 2:{cellWidth:28,halign:'right'}, 3:{cellWidth:38,halign:'right'} } : { 0:{cellWidth:18}, 1:{cellWidth:65}, 2:{cellWidth:18,halign:'right'}, 3:{cellWidth:26,halign:'right'}, 4:{cellWidth:26,halign:'right'}, 5:{cellWidth:31,halign:'right'} },
    rowPageBreak: 'avoid',
    willDrawPage: data => {
      if (data.pageNumber > 1) {
        doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...ink);
        doc.text(doc.splitTextToSize(dispatch.businessSnapshot?.businessName || 'StoneDesk', 184).slice(0, 1), 13, 12);
        doc.setFont('helvetica', 'normal').setFontSize(8);
        doc.text(`${driver ? 'Driver slip' : 'Load bill'} continued · ${dispatch.logistics?.truckNumber || '-'}`, 13, 18);
      }
    } });
  y = doc.lastAutoTable.finalY + 6;
  if (!driver) {
    const s = dispatch.summary;
    const amounts = [['Material total', `Rs. ${money(s.baseMaterialTotal)}`]];
    amounts.push(['Loading / royalty', `Rs. ${money(s.loadingAndRoyaltyFees)}`],
      [{ content: 'NET PAYABLE', styles: { fontStyle: 'bold' } }, { content: `Rs. ${money(s.netBillableAmount)}`, styles: { fontStyle: 'bold', fontSize: 12 } }]);
    autoTable(doc, { startY: y, body: amounts, theme: 'grid', pageBreak: amounts.length < 8 ? 'avoid' : 'auto', rowPageBreak: 'avoid',
      margin: { left: 68, right: 13, top: 24, bottom: 18 },
      styles: { font: 'helvetica', fontSize: 9, textColor: ink, cellPadding: 3, lineColor: [100, 107, 103], lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 49, halign: 'right' } } });
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page).setFont('helvetica', 'normal').setFontSize(8).setTextColor(65, 70, 66);
    doc.text(driver ? 'Driver copy · Prices hidden' : 'Finalized bill · All amounts in INR', 13, 287);
    doc.text(`${page} / ${pages}`, 197, 287, { align: 'right' });
  }
  const safeId = String(dispatch.dispatchSlipNumber || 'Unknown').replace(/[^a-zA-Z0-9-]/g, '_');
  return { blob: doc.output('blob'), filename: `StoneDesk-${driver ? 'Driver-Slip' : 'Buyer-Invoice'}-${safeId}.pdf` };
}
