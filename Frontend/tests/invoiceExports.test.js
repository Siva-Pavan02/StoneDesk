import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { billRows, rowGroups } from '../src/utils/billData.js';
import { a4InvoiceFromDispatch, projectCopy } from '../src/utils/a4InvoiceModel.js';
import { renderA4Invoice } from '../src/utils/a4InvoiceRender.js';
import { planSynthetic } from './helpers/a4Generators.js';
import * as ledgerPdfModule from '../src/utils/ledgerPdf.js';

const { billFilename } = ledgerPdfModule;
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

export const largeBill = {
  id:'sample',status:'Dispatched',date:'2026-10-08',dispatchSlipNumber:'QA-15-ROWS',partyName:'Sample buyer',supervisor:'Sample supervisor',
  businessSnapshot:{businessName:'Kadapa Stone Yard',address:'Kadapa, Andhra Pradesh'},logistics:{truckNumber:'AP 04 AB 6638',buyerDestination:'Hyderabad'},
  inventory:Array.from({length:15},(_,i)=>({stoneType:`Stone row ${i+1}`,finish:'Polished',ratePerSqFt:40.5,totalSqFt:166.5,lineTotal:6743.25,measurementRows:[{rowNo:i+1,lengthFt:3,widthFt:2,quantity:19,category:'Regular',sqFt:114,lineTotal:4617},{rowNo:i+1,lengthFt:3.5,widthFt:1.5,quantity:10,category:'TOP',sqFt:52.5,lineTotal:2126.25}]})),
  summary:{totalPieces:435,totalDispatchVolumeSqFt:2497.5,baseMaterialTotal:101148.75,loadingAndRoyaltyFees:50,netBillableAmount:101198.75}
};

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

test('a 30-line row keeps its Regular and Top lines grouped',()=>{
  const line=(rowNo,category,i)=>({rowNo,lengthFt:4,widthFt:3,quantity:1+(i%3),category,sqFt:12*(1+(i%3)),lineTotal:480*(1+(i%3))});
  const lines=[...Array.from({length:14},(_,i)=>line(1,'Regular',i)),...Array.from({length:16},(_,i)=>line(1,'TOP',i)),...Array.from({length:12},(_,i)=>line(2,'Regular',i)),...Array.from({length:3},(_,i)=>line(15,'TOP',i))];
  const bill={...largeBill,summary:{...largeBill.summary},inventory:[{stoneType:'A',finish:'P',ratePerSqFt:40,measurementRows:lines}]};
  const groups=rowGroups(billRows(bill));
  assert.deepEqual(groups.map(g=>[g.rowNo,g.regularLines.length,g.topLines.length]),[[1,14,16],[2,12,0],[15,0,3]]);
});

test('records saved before row numbers existed map old batch N to Row N',()=>{
  const legacy={inventory:[{stoneType:'A',finish:'P',measurementRows:[{lengthFt:1,widthFt:1,quantity:1,category:'Regular',sqFt:1}]},{stoneType:'B',finish:'P',pieces:[{lengthFt:2,widthFt:1,sqFt:2}]}]};
  assert.deepEqual(rowGroups(billRows(legacy,false)).map(g=>g.rowNo),[1,2]);
});

// Every app source file under Frontend/src (.js/.jsx/.mjs), as [relative path, text].
function sourceFiles(dir = SRC) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:js|jsx|mjs)$/.test(entry.name) ? [[relative(SRC, path), readFileSync(path, 'utf8')]] : [];
  });
}

test('legacy driverPdf / buyerExcel exports are retired: pilotExports.js is gone and nothing in src references them', () => {
  assert.equal(existsSync(join(SRC, 'utils', 'pilotExports.js')), false, 'src/utils/pilotExports.js no longer exists');
  const files = sourceFiles();
  assert.ok(files.length > 0);
  for (const [path, text] of files) {
    assert.doesNotMatch(text, /\bdriverPdf\b/, `${path} references driverPdf`);
    assert.doesNotMatch(text, /\bbuyerExcel\b/, `${path} references buyerExcel`);
    assert.doesNotMatch(text, /\bfrom\s+['"][^'"]*pilotExports(?:\.js)?['"]|import\(\s*['"][^'"]*pilotExports/, `${path} imports pilotExports`);
  }
});

test('the ledgerPdf layout is retired: ledgerPdf.js exports only billFilename and nothing calls or imports ledgerPdf', () => {
  assert.deepEqual(Object.keys(ledgerPdfModule), ['billFilename']);
  for (const [path, text] of sourceFiles()) {
    assert.doesNotMatch(text, /\bledgerPdf\s*\(/, `${path} calls ledgerPdf(`);
    for (const [, names] of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*ledgerPdf(?:\.js)?['"]/g)) {
      const imported = names.split(',').map(name => name.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      assert.deepEqual(imported, ['billFilename'], `${path} imports only billFilename from ledgerPdf.js`);
    }
    assert.doesNotMatch(text, /import\s+\w+\s*(?:,|from)\s*[^;]*ledgerPdf/, `${path} default-imports ledgerPdf`);
  }
  const billView = readFileSync(join(SRC, 'components', 'pilot', 'BillView.jsx'), 'utf8');
  assert.doesNotMatch(billView, /\bledgerPdf\s*\(|\bdriverPdf\b|\bbuyerExcel\b/);
  assert.match(billView, /a4InvoicePdf\(/, 'BillView exports through the A4 engine');
});

test('15-row bill: buyer and driver copies follow the shared plan with Reg total / Top total rows', () => {
  const model = a4InvoiceFromDispatch(largeBill);
  assert.equal(model.groups.length, 15);
  for (const [copy, kind] of [['buyer', 'Invoice'], ['driver', 'Driver-slip']]) {
    const view = projectCopy(model, copy), plan = planSynthetic(view, copy);
    const filename = billFilename(largeBill, kind, 'pdf');
    assert.match(filename, /\.pdf$/);
    const html = renderA4Invoice(view, plan, copy, `export-${copy}`);
    assert.equal((html.match(/class="paper sample-sheet"/g) || []).length, plan.length, `${copy}: pages equal the plan`);
    // One Reg total and one Top total row per group; no per-group amount row.
    assert.equal((html.match(/data-subtotal="regular"/g) || []).length, 15, `${copy}: Reg total rows`);
    assert.equal((html.match(/data-subtotal="top"/g) || []).length, 15, `${copy}: Top total rows`);
    assert.doesNotMatch(html, /group-total|data-total-row/);
    if (copy === 'driver') {
      assert.ok(!html.includes('₹'), 'driver slip carries no rupee value');
      assert.doesNotMatch(html, /Payment summary|Material total|Net payable|Bank details|Amount in words/);
    } else {
      assert.match(html, /₹/);
      assert.match(html, /<dt>Net payable<\/dt>/);
    }
  }
});
