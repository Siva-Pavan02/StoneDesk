import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function generateBuyerInvoice(dispatch) {
  if (!dispatch) throw new Error("Missing Dispatch record");
  if (!dispatch.summary) throw new Error("Missing financial summary in Dispatch");
  
  if (dispatch.status !== 'Dispatched' && dispatch.status !== 'Delivered') {
    throw new Error("Cannot generate invoice for an unfinalized Dispatch. Please finalize the dispatch first.");
  }
  
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let hasTamil = false;
  
  try {
    if (typeof window !== 'undefined' && window.location) {
      const fontRes = await fetch('/fonts/NotoSansTamil-Regular.ttf');
      if (fontRes.ok) {
        const fontBuffer = await fontRes.arrayBuffer();
        const base64 = arrayBufferToBase64(fontBuffer);
        doc.addFileToVFS("NotoSansTamil.ttf", base64);
        doc.addFont("NotoSansTamil.ttf", "NotoSansTamil", "normal");
        hasTamil = true;
      }
    }
  } catch (err) {
    console.warn("Failed to load Tamil font, falling back to standard English font.", err);
  }

  const fmtCurrency = (val) => {
    return 'Rs. ' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const printBilingual = (english, tamil, x, y, options = {}) => {
    if (hasTamil) {
      doc.setFont("NotoSansTamil", "normal");
      doc.text(`${english} / ${tamil}`, x, y, options);
      doc.setFont("helvetica", "normal");
    } else {
      doc.text(english, x, y, options);
    }
  };

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  if (hasTamil) doc.setFont("NotoSansTamil", "normal");
  doc.text(hasTamil ? "Invoice / விலைப்பட்டியல்" : "Invoice", 105, 20, { align: "center" });
  doc.setFont("helvetica", "normal");

  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`GraniteSync - Pit-2 Unit 04`, 105, 28, { align: "center" });

  doc.setTextColor(0);
  doc.setFontSize(10);
  
  const slipNumber = dispatch.dispatchSlipNumber || 'N/A';
  const dateStr = dispatch.date ? new Date(dispatch.date).toLocaleDateString() : 'N/A';
  
  printBilingual(`Slip No: ${slipNumber}`, `ரசீது எண்: ${slipNumber}`, 15, 40);
  printBilingual(`Date: ${dateStr}`, `தேதி: ${dateStr}`, 140, 40);

  printBilingual(`Supervisor: ${dispatch.supervisor || 'N/A'}`, `மேற்பார்வையாளர்: ${dispatch.supervisor || 'N/A'}`, 15, 48);
  printBilingual(`Truck Number: ${dispatch.logistics?.truckNumber || 'N/A'}`, `லாரி எண்: ${dispatch.logistics?.truckNumber || 'N/A'}`, 140, 48);
  
  printBilingual(`Destination: ${dispatch.logistics?.buyerDestination || 'N/A'}`, `இலக்கு: ${dispatch.logistics?.buyerDestination || 'N/A'}`, 15, 56);
  
  doc.setLineWidth(0.5);
  doc.setDrawColor(200);
  doc.line(15, 62, 195, 62);
  
  let startY = 70;
  
  const headEn = ['Stone Type', 'Finish', 'Pieces', 'Sq.Ft', 'Rate', 'Amount'];
  const headTa = ['கல் வகை', 'மேற்பரப்பு', 'அளவு', 'ச.அடி', 'விலை', 'தொகை'];
  
  const headers = hasTamil 
    ? [headEn.map((e, i) => `${e}\n${headTa[i]}`)]
    : [headEn];

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
        groupSqFt.toFixed(2),
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
      font: hasTamil ? 'NotoSansTamil' : 'helvetica',
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

  doc.setFont(hasTamil ? "NotoSansTamil" : "helvetica", "normal");
  
  const summaryBoxX = 110;
  doc.setDrawColor(200);
  doc.rect(summaryBoxX - 5, startY - 5, 90, 45);

  let currentY = startY;
  
  printBilingual('Base Material', 'மொத்தம்', summaryBoxX, currentY);
  doc.text(fmtCurrency(dispatch.summary.baseMaterialTotal), 195, currentY, { align: 'right' });
  currentY += 10;
  
  printBilingual('Loading/Royalty CESS', 'ராயல்டி/ஏற்றுதல்', summaryBoxX, currentY);
  doc.text(fmtCurrency(dispatch.summary.loadingAndRoyaltyFees), 195, currentY, { align: 'right' });
  currentY += 10;

  doc.line(summaryBoxX - 5, currentY - 5, 195, currentY - 5);
  
  doc.setFont(hasTamil ? "NotoSansTamil" : "helvetica", "bold");
  doc.setFontSize(12);
  printBilingual('Net Billable Amount', 'நிகர தொகை', summaryBoxX, currentY + 2);
  doc.text(fmtCurrency(dispatch.summary.netBillableAmount), 195, currentY + 2, { align: 'right' });

  const safeSlipNumber = (dispatch.dispatchSlipNumber || 'Unknown').replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `GraniteSync-Buyer-Invoice-${safeSlipNumber}.pdf`;

  return { blob: doc.output('blob'), filename };
}
