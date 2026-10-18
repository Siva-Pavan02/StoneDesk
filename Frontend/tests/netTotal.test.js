import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { netTotal, summarize } from '../src/utils/loadMath.js';
import { a4InvoiceFromDispatch, projectCopy } from '../src/utils/a4InvoiceModel.js';
const require = createRequire(import.meta.url);
const backend = require('../../Backend/utils/pilotCalculations.js');
const serverNet = require('../../Backend/utils/dispatchCalculations.js').netTotal;
test('net-only examples agree across preview, saved summary and buyer invoice', () => {
 for (const [value,expected] of [[100.75,101],[125.75,126],[100.25,100.25],[100.5,100.5],[100.74,100.74],[100.76,100.76],[100.749,100.749],[100.7500000001,101]]) {
  assert.equal(netTotal(value),expected); assert.equal(serverNet(value),expected);
  const rows = ['Regular','TOP'].map(category=>({stoneType:'Stone',finish:'Polished',ratePerSqFt:1,lengthFt:value/2,widthFt:1,quantity:1,category}));
  const inventory = backend.processInventory([{stoneType:'Stone',finish:'Polished',ratePerSqFt:1,measurementRows:rows}]);
  const summary = backend.totals(inventory,0);
  assert.deepEqual(summarize(rows,0),summary);
  assert.equal(summary.netBillableAmount,expected);
  const model = a4InvoiceFromDispatch({inventory,summary,status:'Dispatched',date:'2026-01-01',dispatchSlipNumber:'TEST',partyName:'Buyer',supervisor:'Manager',logistics:{truckNumber:'TRUCK',buyerDestination:'Yard'},businessSnapshot:{businessName:'Stone'}});
  assert.equal(Number(model.totals.netPayable),expected);
  const driver=projectCopy(model,'driver');
  assert.equal(driver.totals.area,model.totals.area);
  assert.equal('netPayable' in driver.totals,false);
 }
});
