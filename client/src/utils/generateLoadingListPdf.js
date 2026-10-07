import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { decimalToFraction } from './fractionParser';

export async function generateLoadingListPdf(listData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = "helvetica";
  let y = 15;

  // HEADER
  doc.setFont(font, 'bold');
  doc.setFontSize(16);
  doc.text("StoneDesk", 14, y);
  y += 6;
  doc.setFontSize(12);
  doc.text("SUPERVISOR LOADING LIST", 14, y);
  y += 10;

  doc.setFont(font, 'normal');
  doc.setFontSize(10);
  
  const drawLabel = (label, value, xPos, yPos) => {
    doc.setFont(font, 'bold');
    doc.text(`${label}:`, xPos, yPos);
    doc.setFont(font, 'normal');
    doc.text(String(value || '-'), xPos + 35, yPos);
  };

  drawLabel('Loading List No', listData.loadingListNumber, 14, y);
  drawLabel('Date', listData.date, 110, y);
  y += 6;
  drawLabel('Supervisor', listData.supervisor, 14, y);
  drawLabel('Buyer', listData.buyerDestination, 110, y);
  y += 6;
  drawLabel('Destination', listData.buyerDestination, 14, y);
  drawLabel('Truck', listData.truckNumber || '-', 110, y);
  y += 6;
  drawLabel('Stone Type', listData.stoneType, 14, y);
  drawLabel('Finish', listData.finish, 110, y);
  y += 6;
  drawLabel('Order Reference', listData.orderReference || '-', 14, y);
  y += 10;

  // REQUIREMENT SUMMARY
  doc.setFont(font, 'bold');
  doc.setFontSize(12);
  doc.text("REQUIREMENT SUMMARY", 14, y);
  y += 4;

  const reqTableBody = listData.requirements.map(r => {
    const size = `${r.lengthDisplay || decimalToFraction(r.lengthFt)} × ${r.widthDisplay || decimalToFraction(r.widthFt)}`;
    return [size, r.requiredQuantity, r.loadedQuantity, r.balance];
  });

  autoTable(doc, {
    startY: y,
    head: [['Size', 'Required', 'Loaded', 'Balance']],
    body: reqTableBody,
    theme: 'grid',
    styles: { font: font, fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] }
  });
  
  y = doc.lastAutoTable.finalY + 10;

  // LOADED SIZE SUMMARY
  doc.setFont(font, 'bold');
  doc.setFontSize(12);
  doc.text("LOADED SIZE SUMMARY", 14, y);
  y += 4;

  const loadedGroups = {};
  listData.requirements.forEach(req => {
    (req.loadedPieces || []).forEach(p => {
      const pLen = p.lengthDisplay || decimalToFraction(p.lengthFt);
      const pWid = p.widthDisplay || decimalToFraction(p.widthFt);
      const key = `${pLen} × ${pWid}`;
      loadedGroups[key] = (loadedGroups[key] || 0) + 1;
    });
  });

  const loadedTableBody = Object.keys(loadedGroups).map(k => [k, loadedGroups[k]]);

  autoTable(doc, {
    startY: y,
    head: [['Loaded Size', 'Quantity']],
    body: loadedTableBody.length > 0 ? loadedTableBody : [['No pieces loaded', '-']],
    theme: 'grid',
    styles: { font: font, fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] }
  });

  y = doc.lastAutoTable.finalY + 10;

  // TOTALS
  doc.setFont(font, 'bold');
  doc.setFontSize(12);
  doc.text("TOTALS", 14, y);
  y += 6;

  const totalReq = listData.requirements.reduce((sum, r) => sum + r.requiredQuantity, 0);
  const totalLoad = listData.requirements.reduce((sum, r) => sum + r.loadedQuantity, 0);
  const totalBal = listData.requirements.reduce((sum, r) => sum + (r.balance > 0 ? r.balance : 0), 0);
  const totalExc = listData.requirements.reduce((sum, r) => sum + (r.balance < 0 ? Math.abs(r.balance) : 0), 0);

  doc.setFont(font, 'normal');
  doc.setFontSize(10);
  doc.text(`Total Required Pieces: ${totalReq}`, 14, y); y += 5;
  doc.text(`Total Loaded Pieces: ${totalLoad}`, 14, y); y += 5;
  doc.text(`Total Balance: ${totalBal}`, 14, y); y += 5;
  if (totalExc > 0) {
    doc.text(`Total Excess: ${totalExc}`, 14, y); y += 5;
  }

  doc.save(`${listData.loadingListNumber || 'LoadingList'}.pdf`);
}
