import * as XLSX from "xlsx";
import { decimalToFraction } from './fractionParser';

export function generateLoadingListExcel(listData) {
  const wb = XLSX.utils.book_new();

  // ----------------------------------------------------
  // SHEET 1: Loading List
  // ----------------------------------------------------
  const ws1Data = [];
  
  ws1Data.push(["StoneDesk - Supervisor Loading List"]);
  ws1Data.push([]);
  ws1Data.push(["Loading List Number", listData.loadingListNumber || 'N/A']);
  ws1Data.push(["Date", listData.date || 'N/A']);
  ws1Data.push(["Supervisor", listData.supervisor || 'N/A']);
  ws1Data.push(["Buyer", listData.buyerDestination || 'N/A']);
  ws1Data.push(["Destination", listData.buyerDestination || 'N/A']);
  ws1Data.push(["Truck Number", listData.truckNumber || 'N/A']);
  ws1Data.push(["Stone Type", listData.stoneType || 'N/A']);
  ws1Data.push(["Finish", listData.finish || 'N/A']);
  ws1Data.push(["Order Reference", listData.orderReference || 'N/A']);
  ws1Data.push([]);
  
  ws1Data.push(["Requirement Summary"]);
  ws1Data.push(["#", "Length", "Width", "Required", "Loaded", "Balance"]);
  
  listData.requirements.forEach((req, idx) => {
    ws1Data.push([
      idx + 1,
      req.lengthDisplay || decimalToFraction(req.lengthFt),
      req.widthDisplay || decimalToFraction(req.widthFt),
      req.requiredQuantity,
      req.loadedQuantity,
      req.balance
    ]);
  });
  
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  XLSX.utils.book_append_sheet(wb, ws1, "Loading List");


  // ----------------------------------------------------
  // SHEET 2: Requirements / Size Summary
  // ----------------------------------------------------
  const ws2Data = [];
  ws2Data.push(["Requirements / Size Summary"]);
  ws2Data.push([]);
  ws2Data.push(["Size", "Required Quantity"]);
  
  listData.requirements.forEach(req => {
    const size = `${req.lengthDisplay || decimalToFraction(req.lengthFt)} × ${req.widthDisplay || decimalToFraction(req.widthFt)}`;
    ws2Data.push([size, req.requiredQuantity]);
  });
  
  if (listData.requirements.length === 0) {
    ws2Data.push(["No requirements", "0"]);
  }
  
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  XLSX.utils.book_append_sheet(wb, ws2, "Requirements");


  // ----------------------------------------------------
  // SHEET 3: Loaded Pieces
  // ----------------------------------------------------
  const ws3Data = [];
  ws3Data.push(["Loaded Pieces Details"]);
  ws3Data.push([]);
  ws3Data.push(["Piece No.", "Requirement", "Actual Length", "Actual Width"]);
  
  let globalPieceIndex = 1;
  listData.requirements.forEach(req => {
    const reqStr = `${req.lengthDisplay || decimalToFraction(req.lengthFt)} × ${req.widthDisplay || decimalToFraction(req.widthFt)}`;
    
    (req.loadedPieces || []).forEach(p => {
      ws3Data.push([
        globalPieceIndex++,
        reqStr,
        p.lengthDisplay || decimalToFraction(p.lengthFt),
        p.widthDisplay || decimalToFraction(p.widthFt)
      ]);
    });
  });
  
  if (globalPieceIndex === 1) {
    ws3Data.push(["No pieces loaded", "", "", ""]);
  }
  
  const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
  XLSX.utils.book_append_sheet(wb, ws3, "Loaded Pieces");

  XLSX.writeFile(wb, `${listData.loadingListNumber || 'LoadingList'}.xlsx`);
}
