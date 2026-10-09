import { jsPDF } from "jspdf";
import { driverPdf } from './pilotExports.js';
import autoTable from "jspdf-autotable";
import { decimalToFraction } from './fractionParser.js';
import { fixed2, round2 } from './loadMath.js';

export function generateDriverTransitSlip(dispatch, t) {
  if (!t || dispatch?.inventory?.some(g => g.measurementRows?.length)) return driverPdf(dispatch);
  if (!dispatch) throw new Error("Missing Dispatch record");
  if (!dispatch.inventory || dispatch.inventory.length === 0) {
    throw new Error("Missing inventory");
  }
  
  if (dispatch.status !== 'Dispatched' && dispatch.status !== 'Delivered') {
    throw new Error("Cannot generate transit slip for an unfinalized Dispatch. Please finalize the dispatch first.");
  }
  
  // Security check: NEVER include financial values in this document.
  // Explicitly avoid accessing ratePerSqFt, lineTotal, baseMaterialTotal, loadingAndRoyaltyFees, netBillableAmount
  
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(t('driverTransitSlip').toUpperCase(), 105, 20, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`${t('appName')} Logistics - Pit-2 Unit 04`, 105, 28, { align: "center" });

  doc.setTextColor(0);
  doc.setFontSize(10);
  
  // Metadata box
  const slipNumber = dispatch.dispatchSlipNumber || 'N/A';
  const dateStr = dispatch.date ? new Date(dispatch.date).toLocaleDateString() : 'N/A';
  
  doc.text(`${t('slipNo')}: ${slipNumber}`, 15, 40);
  doc.text(`${t('date')}: ${dateStr}`, 140, 40);

  doc.text(`${t('supervisor')}: ${dispatch.supervisor || 'N/A'}`, 15, 48);
  doc.text(`${t('truckNumber')}: ${dispatch.logistics?.truckNumber || 'N/A'}`, 140, 48);
  
  doc.text(`${t('destination')}: ${dispatch.logistics?.buyerDestination || 'N/A'}`, 15, 56);
  
  // Divider
  doc.setLineWidth(0.5);
  doc.setDrawColor(200);
  doc.line(15, 62, 195, 62);
  
  let startY = 70;
  let totalPieces = 0;
  let totalSqFt = 0;

  dispatch.inventory.forEach((group) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${t('stoneType')}: ${group.stoneType} (${group.finish})`, 15, startY);
    
    const tableData = group.pieces.map((p, i) => {
      totalPieces++;
      const area = p.lengthFt * p.widthFt;
      const pSqFt = p.sqFt !== undefined ? p.sqFt : round2(area);
      totalSqFt += area;
      return [
        (i + 1).toString(),
        p.lengthDisplay ? p.lengthDisplay : `${p.lengthFt}`,
        p.widthDisplay ? p.widthDisplay : `${p.widthFt}`,
        decimalToFraction(pSqFt)
      ];
    });

    autoTable(doc, {
      startY: startY + 5,
      head: [['#', t('length'), t('width'), t('sqFt')]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 92, 85] }, // Deep Teal brand color
      margin: { left: 15, right: 15 },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'right' }
      }
    });

    startY = doc.lastAutoTable.finalY + 15;
    
    // Prevent rendering off-page
    if (startY > 250) {
      doc.addPage();
      startY = 20;
    }
  });

  // Footer Totals
  doc.setDrawColor(200);
  doc.line(15, startY - 5, 195, startY - 5);
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${t('total')}: ${totalPieces} ${t('pieces')}`, 15, startY + 5);
  doc.text(`${t('totalDispatchVolume')}: ${fixed2(totalSqFt)} ${t('sqFt')}`, 130, startY + 5);

  const safeSlipNumber = slipNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `StoneDesk-Driver-Slip-${safeSlipNumber}.pdf`;

  return { blob: doc.output('blob'), filename };
}
