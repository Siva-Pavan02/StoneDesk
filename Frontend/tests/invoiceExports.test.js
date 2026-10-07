import test from 'node:test';
import assert from 'node:assert/strict';
import { buyerPdf, driverPdf, buyerExcel } from '../src/utils/pilotExports.js';
import * as XLSX from 'xlsx';
export const largeBill = {
  id:'sample',status:'Dispatched',date:'2026-10-08',dispatchSlipNumber:'QA-24-BATCHES',partyName:'Sample buyer',supervisor:'Sample supervisor',
  businessSnapshot:{businessName:'Kadapa Stone Yard',address:'Kadapa, Andhra Pradesh'},logistics:{truckNumber:'AP 04 AB 6638',buyerDestination:'Hyderabad'},
  inventory:Array.from({length:24},(_,i)=>({stoneType:`Stone batch ${i+1}`,finish:'Polished',ratePerSqFt:40.5,totalSqFt:166.5,lineTotal:6743.25,measurementRows:[{lengthFt:3,widthFt:2,quantity:19,category:'Regular',sqFt:114,lineTotal:4617},{lengthFt:3.5,widthFt:1.5,quantity:10,category:'TOP',sqFt:52.5,lineTotal:2126.25}]})),
  summary:{totalPieces:696,totalDispatchVolumeSqFt:3996,baseMaterialTotal:161838,loadingAndRoyaltyFees:50,netBillableAmount:161888}
};
test('24-batch invoice exports preserve totals and hide driver prices',async()=>{
  const buyer=await buyerPdf(largeBill).blob.text(),driver=await driverPdf(largeBill).blob.text();
  assert.match(buyer,/Stone batch 24/); assert.match(buyer,/NET PAYABLE/);assert.match(buyer,/1,61,888.00/);
  assert.ok((buyer.match(/\/Type \/Page\b/g)||[]).length>=3);
  assert.doesNotMatch(driver,/NET PAYABLE|40.50|1,61,888.00|Rate \(INR\)/);
  const book=XLSX.read(await buyerExcel(largeBill).blob.arrayBuffer(),{type:'array'});
  const rows=XLSX.utils.sheet_to_json(book.Sheets['Buyer Invoice'],{header:1});
  assert.equal(rows.find(row=>row[0]==='Net payable')[1],161888);
  assert.equal(typeof rows[8][8],'number');
});
