const test = require('node:test');
const assert = require('node:assert/strict');
const { netTotal } = require('../utils/dispatchCalculations');
const { processInventory, totals } = require('../utils/pilotCalculations');
const cases = [[100.75,101],[125.75,126],[100,100],[100.25,100.25],[100.5,100.5],[100.6,100.6],[100.74,100.74],[100.76,100.76],[100.9,100.9],[100.7500000001,101],[100.7499999999,101],[100.74999,100.74999],[100.75123,100.75123]];
test('net-only rule preserves non-.75 values and tolerates binary noise', () => {
  for (const [input, expected] of cases) assert.equal(netTotal(input), expected);
});
test('net rule runs after raw rows and fees, never on measurements or group totals', () => {
  const inventory = processInventory([{ stoneType: 'Stone', finish: 'Polished', ratePerSqFt: 1,
    measurementRows: [ {lengthFt:50.375,widthFt:1,quantity:1,category:'Regular'}, {lengthFt:50.375,widthFt:1,quantity:1,category:'TOP'} ] }]);
  assert.equal(inventory[0].totalSqFt,100.75);
  assert.equal(inventory[0].lineTotal,100.75);
  assert.equal(inventory[0].measurementRows[0].lineTotal,50.38);
  assert.equal(totals(inventory,0).netBillableAmount,101);
  assert.equal(totals(inventory,0.01).netBillableAmount,100.76);
  const precise = processInventory([{stoneType:'Stone',finish:'Polished',ratePerSqFt:1,measurementRows:[{lengthFt:100.749,widthFt:1,quantity:1}]}]);
  assert.equal(precise[0].lineTotal,100.75);
  assert.equal(totals(precise,0).netBillableAmount,100.749);
});
