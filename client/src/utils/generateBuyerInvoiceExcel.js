import * as XLSX from "xlsx";

export function generateBuyerInvoiceExcel(dispatch) {
  if (!dispatch) throw new Error("Missing Dispatch record");
  if (!dispatch.summary) throw new Error("Missing financial summary in Dispatch");
  
  if (dispatch.status !== 'Dispatched' && dispatch.status !== 'Delivered') {
    throw new Error("Cannot generate Excel invoice for an unfinalized Dispatch. Please finalize the dispatch first.");
  }

  // Format definitions
  const numFormatSqFt = "0.00";
  const numFormatCurrency = '"₹"#,##0.00'; // Indian Rupee format for Excel

  const wsData = [];
  
  // Headers
  wsData.push(["GraniteSync"]);
  wsData.push(["Buyer Invoice / விலைப்பட்டியல்"]);
  wsData.push([]);
  
  // Metadata
  const slipNumber = dispatch.dispatchSlipNumber || 'N/A';
  const dateStr = dispatch.date ? new Date(dispatch.date).toLocaleDateString() : 'N/A';
  
  wsData.push(["Slip No / ரசீது எண்:", slipNumber, "Date / தேதி:", dateStr]);
  wsData.push(["Supervisor / மேற்பார்வையாளர்:", dispatch.supervisor || 'N/A', "Truck Number / லாரி எண்:", dispatch.logistics?.truckNumber || 'N/A']);
  wsData.push(["Destination / இலக்கு:", dispatch.logistics?.buyerDestination || 'N/A', "", ""]);
  wsData.push([]);
  
  // Table Headers
  wsData.push([
    "Stone Type / கல் வகை", 
    "Finish / மேற்பரப்பு", 
    "Pieces / அளவு", 
    "Total Sq.Ft / ச.அடி", 
    "Rate / விலை", 
    "Amount / தொகை"
  ]);

  // Data Rows
  if (dispatch.inventory) {
    dispatch.inventory.forEach(group => {
      const piecesCount = group.pieces.length;
      let groupSqFt = 0;
      group.pieces.forEach(p => {
        groupSqFt += p.sqFt !== undefined ? p.sqFt : (p.lengthFt * p.widthFt);
      });
      
      const rateVal = group.ratePerSqFt || 0;
      const amountVal = group.lineTotal !== undefined ? group.lineTotal : (groupSqFt * rateVal);
      
      wsData.push([
        group.stoneType,
        group.finish,
        piecesCount,
        groupSqFt,
        rateVal,
        amountVal
      ]);
    });
  }
  
  wsData.push([]);

  // Financial Summary
  wsData.push(["", "", "", "", "Base Material / மொத்தம்", dispatch.summary.baseMaterialTotal]);
  wsData.push(["", "", "", "", "Loading / Royalty CESS / ராயல்டி / ஏற்றுதல்", dispatch.summary.loadingAndRoyaltyFees]);
  wsData.push(["", "", "", "", "Net Billable Amount / நிகர தொகை", dispatch.summary.netBillableAmount]);

  // Create workbook and worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Buyer Invoice");

  // Format cells
  // We need to iterate over all cells to apply number formats and bold text where necessary
  const range = XLSX.utils.decode_range(ws['!ref']);
  for(let R = 0; R <= range.e.r; ++R) {
    for(let C = 0; C <= range.e.c; ++C) {
      const cellAddress = {c:C, r:R};
      const cellRef = XLSX.utils.encode_cell(cellAddress);
      const cell = ws[cellRef];
      
      if(!cell) continue;

      // Apply Bold to Main Titles
      if (R === 0 || R === 1) {
        cell.s = { font: { bold: true } };
      }
      
      // Table headers bold
      if (R === 7) {
        cell.s = { font: { bold: true } };
      }
      
      // Formatting Data Rows
      if (R >= 8 && R < wsData.length - 3 && cell.t === 'n') {
        if (C === 3) cell.z = numFormatSqFt; // Sq.Ft
        if (C === 4 || C === 5) cell.z = numFormatCurrency; // Rate, Amount
      }
      
      // Formatting Summary Rows
      if (R >= wsData.length - 3 && cell.t === 'n' && C === 5) {
        cell.z = numFormatCurrency;
        cell.s = { font: { bold: true } };
      }
      
      if (R >= wsData.length - 3 && C === 4) {
        cell.s = { font: { bold: true } };
      }
    }
  }

  // Adjust column widths
  ws['!cols'] = [
    { wch: 25 }, // Stone Type
    { wch: 20 }, // Finish
    { wch: 15 }, // Pieces
    { wch: 20 }, // Sq.Ft
    { wch: 45 }, // Rate / Base Material
    { wch: 20 }  // Amount
  ];

  const safeSlipNumber = (dispatch.dispatchSlipNumber || 'Unknown').replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `GraniteSync-Buyer-Invoice-${safeSlipNumber}.xlsx`;
  
  // Write Excel file as ArrayBuffer for the browser
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  return { blob, filename };
}
