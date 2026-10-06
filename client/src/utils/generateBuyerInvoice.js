import { jsPDF } from "jspdf";
import { buyerPdf } from './pilotExports.js';
import autoTable from "jspdf-autotable";
import { decimalToFraction } from './fractionParser.js';

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function generateBuyerInvoice(dispatch, t) {
  if (!t || dispatch?.inventory?.some(g => g.measurementRows?.length)) return buyerPdf(dispatch);
  if (!dispatch) throw new Error("Missing Dispatch record");
  if (!dispatch.summary) throw new Error("Missing financial summary in Dispatch");
  
  if (dispatch.status !== 'Dispatched' && dispatch.status !== 'Delivered') {
    throw new Error("Cannot generate invoice for an unfinalized Dispatch. Please finalize the dispatch first.");
  }
  
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let hasTelugu = false;
  
  try {
    if (typeof window !== 'undefined' && window.location) {
      const fontRes = await fetch('/fonts/NotoSansTelugu-Regular.ttf');
      if (fontRes.ok) {
        const fontBuffer = await fontRes.arrayBuffer();
        const base64 = arrayBufferToBase64(fontBuffer);
        doc.addFileToVFS("NotoSansTelugu.ttf", base64);
        doc.addFont("NotoSansTelugu.ttf", "NotoSansTelugu", "normal");
        hasTelugu = true;
      }
    }
  } catch (err) {
    console.warn("Failed to load Telugu font, falling back to standard English font.", err);
  }

  const fmtCurrency = (val) => {
    return 'Rs. ' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const printText = (text, x, y, options = {}) => {
    if (hasTelugu) {
      doc.setFont("NotoSansTelugu", "normal");
    } else {
      doc.setFont("helvetica", "normal");
    }
    doc.text(text, x, y, options);
    doc.setFont("helvetica", "normal");
  };

  doc.setFontSize(18);
  if (hasTelugu) doc.setFont("NotoSansTelugu", "normal");
  else doc.setFont("helvetica", "bold");
  
  doc.text(t('buyerInvoiceDoc'), 105, 20, { align: "center" });
  doc.setFont("helvetica", "normal");

  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`${t('appName')} - Pit-2 Unit 04`, 105, 28, { align: "center" });

  doc.setTextColor(0);
  doc.setFontSize(10);
  
  const slipNumber = dispatch.dispatchSlipNumber || 'N/A';
  const dateStr = dispatch.date ? new Date(dispatch.date).toLocaleDateString() : 'N/A';
  
  printText(`${t('slipNo')}: ${slipNumber}`, 15, 40);
  printText(`${t('date')}: ${dateStr}`, 140, 40);

  printText(`${t('supervisor')}: ${dispatch.supervisor || 'N/A'}`, 15, 48);
  printText(`${t('truckNumber')}: ${dispatch.logistics?.truckNumber || 'N/A'}`, 140, 48);
  
  printText(`${t('destination')}: ${dispatch.logistics?.buyerDestination || 'N/A'}`, 15, 56);
  
  doc.setLineWidth(0.5);
  doc.setDrawColor(200);
  doc.line(15, 62, 195, 62);
  
  let startY = 70;
  
  const headers = [[t('stoneType'), t('finish'), t('pieces'), t('sqFt'), t('rate'), t('amount')]];

  let tableData = [];

  if (dispatch.inventory) {
    dispatch.inventory.forEach((group) => {
      const piecesCount = group.pieces.length;
      let groupSqFt = 0;
      group.pieces.forEach(p => {
        groupSqFt += p.sqFt !== undefined ? p.sqFt : (p.lengthFt * p.widthFt);
      });
      
      const rateVal = group.ratePerSqFt || 0;
      const amountVal = group.lineTotal !== undefined ? group.lineTotal : (groupSqFt * rateVal);
      
      tableData.push([
        group.stoneType,
        group.finish,
        piecesCount.toString(),
        decimalToFraction(groupSqFt),
        fmtCurrency(rateVal),
        fmtCurrency(amountVal)
      ]);
    });
  }

  autoTable(doc, {
    startY: startY,
    head: headers,
    body: tableData,
    theme: 'grid',
    styles: { 
      font: hasTelugu ? 'NotoSansTelugu' : 'helvetica',
      fontSize: 9, 
      cellPadding: 3 
    },
    headStyles: { 
      fillColor: [0, 92, 85],
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'left' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' }
    }
  });

  startY = doc.lastAutoTable.finalY + 15;
  if (startY > 230) {
    doc.addPage();
    startY = 20;
  }

  doc.setFont(hasTelugu ? "NotoSansTelugu" : "helvetica", "normal");
  
  const summaryBoxX = 110;
  doc.setDrawColor(200);
  doc.rect(summaryBoxX - 5, startY - 5, 90, 45);

  let currentY = startY;
  
  printText(t('baseMaterialTotal'), summaryBoxX, currentY);
  doc.text(fmtCurrency(dispatch.summary.baseMaterialTotal), 195, currentY, { align: 'right' });
  currentY += 10;
  
  printText(t('loadingAndRoyalty'), summaryBoxX, currentY);
  doc.text(fmtCurrency(dispatch.summary.loadingAndRoyaltyFees), 195, currentY, { align: 'right' });
  currentY += 10;

  doc.line(summaryBoxX - 5, currentY - 5, 195, currentY - 5);
  
  doc.setFontSize(12);
  printText(t('netBillableAmount'), summaryBoxX, currentY + 2);
  doc.text(fmtCurrency(dispatch.summary.netBillableAmount), 195, currentY + 2, { align: 'right' });

  const safeSlipNumber = (dispatch.dispatchSlipNumber || 'Unknown').replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `GraniteSync-Buyer-Invoice-${safeSlipNumber}.pdf`;

  return { blob: doc.output('blob'), filename };
}
