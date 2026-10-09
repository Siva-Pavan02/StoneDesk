import test from 'node:test';
import assert from 'node:assert/strict';
import { buyerPdf, driverPdf, buyerExcel } from '../src/utils/pilotExports.js';
import { billRows, rowGroups } from '../src/utils/billData.js';
import * as XLSX from 'xlsx';
import { testLogo } from './invoiceFixtures.js';
export const largeBill = {
  id:'sample',status:'Dispatched',date:'2026-10-08',dispatchSlipNumber:'QA-15-ROWS',partyName:'Sample buyer',supervisor:'Sample supervisor',
  businessSnapshot:{businessName:'Kadapa Stone Yard',address:'Kadapa, Andhra Pradesh'},logistics:{truckNumber:'AP 04 AB 6638',buyerDestination:'Hyderabad'},
  inventory:Array.from({length:15},(_,i)=>({stoneType:`Stone row ${i+1}`,finish:'Polished',ratePerSqFt:40.5,totalSqFt:166.5,lineTotal:6743.25,measurementRows:[{rowNo:i+1,lengthFt:3,widthFt:2,quantity:19,category:'Regular',sqFt:114,lineTotal:4617},{rowNo:i+1,lengthFt:3.5,widthFt:1.5,quantity:10,category:'TOP',sqFt:52.5,lineTotal:2126.25}]})),
  summary:{totalPieces:435,totalDispatchVolumeSqFt:2497.5,baseMaterialTotal:101148.75,loadingAndRoyaltyFees:50,netBillableAmount:101198.75}
};
test('15-row invoice exports preserve totals, show no batch wording and hide driver prices',async()=>{
  const buyer=await buyerPdf(largeBill).blob.text(),driver=await driverPdf(largeBill).blob.text();
  assert.match(buyer,/ROW 15/); assert.match(buyer,/Row 15 Total/); assert.match(buyer,/Regular Subtotal/); assert.match(buyer,/Top Subtotal/); assert.match(buyer,/NET PAYABLE/);assert.match(buyer,/1,01,198.75/);
  assert.match(buyer,/Material Amount/); assert.match(buyer,/69,255.00/); assert.match(buyer,/Top Material Amount/); assert.match(buyer,/31,893.75/);
  assert.match(buyer,/ORDER SUMMARY/); assert.match(buyer,/PAYMENT SUMMARY/); assert.match(buyer,/Authorized Signatory/);
  assert.doesNotMatch(buyer,/batch/i); assert.doesNotMatch(driver,/batch/i);
  assert.ok((buyer.match(/\/Type \/Page\b/g)||[]).length>=3);
  assert.match(driver,/ROW 15/); assert.doesNotMatch(driver,/NET PAYABLE|PAYMENT SUMMARY|40\.50|1,01,198\.75|Rate \(INR\)/);
  const book=XLSX.read(await buyerExcel(largeBill).blob.arrayBuffer(),{type:'array'});
  const rows=XLSX.utils.sheet_to_json(book.Sheets['Buyer Invoice'],{header:1});
  assert.equal(rows.find(row=>row[0]==='Net payable')[1],101198.75);
  assert.equal(rows.find(row=>row[0]==='Top Material Amount')[1],31893.75);
  assert.deepEqual(rows[8].slice(0,3),[1,1,'']); assert.deepEqual(rows[9].slice(0,3),[1,'','Regular Subtotal']); assert.deepEqual(rows[10].slice(0,3),[1,1,'Top']);
  assert.equal(typeof rows[8][6],'number');
});

test('Regular and Top lines entered under one row stay together and row numbers are never renumbered',()=>{
  const bill={inventory:[{stoneType:'A',finish:'P',ratePerSqFt:10,measurementRows:[
    {rowNo:1,lengthFt:3,widthFt:2,quantity:2,category:'TOP',sqFt:12,lineTotal:120},
    {rowNo:7,lengthFt:4,widthFt:1,quantity:5,category:'Regular',sqFt:20,lineTotal:200},
    {rowNo:1,lengthFt:3,widthFt:1,quantity:4,category:'Regular',sqFt:12,lineTotal:120}]}]};
  const groups=rowGroups(billRows(bill));
  assert.deepEqual(groups.map(g=>g.rowNo),[1,7]);
  assert.deepEqual(groups[0].lines.map(l=>l.category),['Regular','TOP']);
  assert.equal(groups[0].total.quantity,6); assert.equal(groups[0].total.sqFt,24); assert.equal(groups[0].top.amount,120);
  assert.equal(groups[0].regularLines.length,1); assert.equal(groups[0].topLines.length,1); assert.equal(groups[1].topLines.length,0);
  assert.equal(groups[0].regular.amount,120); assert.equal(groups[1].total.amount,200);
});

test('a 30-line row splits across pages without losing its totals',async()=>{
  const line=(rowNo,category,i)=>({rowNo,lengthFt:4,widthFt:3,quantity:1+(i%3),category,sqFt:12*(1+(i%3)),lineTotal:480*(1+(i%3))});
  const lines=[...Array.from({length:14},(_,i)=>line(1,'Regular',i)),...Array.from({length:16},(_,i)=>line(1,'TOP',i)),...Array.from({length:12},(_,i)=>line(2,'Regular',i)),...Array.from({length:3},(_,i)=>line(15,'TOP',i))];
  const bill={...largeBill,summary:{...largeBill.summary},inventory:[{stoneType:'A',finish:'P',ratePerSqFt:40,measurementRows:lines}]};
  const groups=rowGroups(billRows(bill));
  assert.deepEqual(groups.map(g=>[g.rowNo,g.regularLines.length,g.topLines.length]),[[1,14,16],[2,12,0],[15,0,3]]);
  const buyer=await buyerPdf(bill).blob.text();
  for(const text of ['ROW 1','ROW 2','ROW 15','Row 1 Total','Row 2 Total','Row 15 Total','Regular Subtotal','Top Subtotal']) assert.match(buyer,new RegExp(text));
});

test('records saved before row numbers existed map old batch N to Row N',()=>{
  const legacy={inventory:[{stoneType:'A',finish:'P',measurementRows:[{lengthFt:1,widthFt:1,quantity:1,category:'Regular',sqFt:1}]},{stoneType:'B',finish:'P',pieces:[{lengthFt:2,widthFt:1,sqFt:2}]}]};
  assert.deepEqual(rowGroups(billRows(legacy,false)).map(g=>g.rowNo),[1,2]);
});

test('invoice logo area renders a placeholder or the saved logo without stretching', async () => {
  const placeholder = await buyerPdf(largeBill).blob.text();
  assert.match(placeholder, /YOUR LOGO/);
  assert.doesNotMatch(placeholder, /ISSUED BY/);
  assert.match(placeholder, /BUYER INVOICE/);
  const record = { ...largeBill, businessSnapshot: { ...largeBill.businessSnapshot, logoDataUrl: testLogo } };
  const branded = await buyerPdf(record).blob.text();
  assert.doesNotMatch(branded, /YOUR LOGO/);
  assert.match(branded, /\/Subtype \/Image/);
  assert.match(branded, /\/Width 120/);
  assert.match(branded, /\/Height 48/);
  const imageTransforms = [...branded.matchAll(/([\d.]+) 0 0 ([\d.]+) [\d.]+ [\d.]+ cm\s*\/I\d+ Do/g)];
  assert.ok(imageTransforms.length > 0, 'The saved logo is placed in the PDF');
  for (const [, imageWidth, imageHeight] of imageTransforms) assert.ok(Math.abs(Number(imageWidth) / Number(imageHeight) - 2.5) < 0.001, 'Logo aspect ratio is preserved');
  assert.match(branded, /1,01,198.75/);
  assert.equal(record.businessSnapshot.logoDataUrl, testLogo, 'Rendering does not replace saved branding');
});

test('damaged historical logos fall back without preventing buyer or driver exports', async () => {
  const record = { ...largeBill, businessSnapshot: { ...largeBill.businessSnapshot, logoDataUrl: 'data:image/png;base64,not-a-real-image' } };
  const buyer = await buyerPdf(record).blob.text(), driver = await driverPdf(record).blob.text();
  assert.match(buyer, /YOUR LOGO/); assert.match(buyer, /1,01,198.75/);
  assert.match(driver, /YOUR LOGO/); assert.match(driver, /Prices hidden/);
  assert.doesNotMatch(driver, /NET PAYABLE|40\.50|1,01,198\.75|Rate \(INR\)/);
});

test('driver slip needs only inventory and never reads financial amounts', async () => {
  const record = { ...largeBill, businessSnapshot: { ...largeBill.businessSnapshot, logoDataUrl: testLogo } };
  delete record.summary;
  record.inventory = largeBill.inventory.map(group => {
    const safe = { stoneType: group.stoneType, finish: group.finish, measurementRows: group.measurementRows.map(({ rowNo, lengthFt, widthFt, quantity, category, sqFt }) => ({ rowNo, lengthFt, widthFt, quantity, category, sqFt })) };
    Object.defineProperty(safe, 'ratePerSqFt', { get() { throw new Error('Driver export read a price'); } });
    Object.defineProperty(safe, 'lineTotal', { get() { throw new Error('Driver export read an amount'); } });
    return safe;
  });
  const driver = await driverPdf(record).blob.text();
  assert.match(driver, /ROW 15/); assert.match(driver, /\/Subtype \/Image/);
  assert.match(driver, /Prices hidden/); assert.doesNotMatch(driver, /NET PAYABLE|40\.50|1,01,198\.75|Rate \(INR\)/);
});
