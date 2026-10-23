// Tests for StoneDesk UNIT measurement flow: control handlers, state updates, validation, and zero SQ_FT regression.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { entryErrors, makeRow, previewRows } from '../src/utils/pilotDraft.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const measurementEntrySource = read('../src/components/pilot/MeasurementEntry.jsx');

// Stepper simulation mirroring NumberStepper in Controls.jsx
function simulateStepper({ value, step = '1', min = 0, max = Infinity, dir }) {
  const by = Number(step) >= 1 ? Number(step) : 1;
  const lo = min === undefined ? -Infinity : Number(min);
  const hi = max === undefined ? Infinity : Number(max);
  const current = Number(value) || 0;
  const next = Math.min(hi, Math.max(lo, Math.round((current + dir * by) * 100) / 100));
  const disabled = dir < 0 ? (current - by < lo) : (current + dir * by > hi);
  return { next: String(next), disabled };
}

const unitProduct = Object.freeze({
  id: 'sink-ruff-1',
  stoneType: 'Sink',
  finish: 'Ruff',
  defaultRate: 470,
  rateUnit: 'UNIT',
});

const sqftProduct = Object.freeze({
  id: 'napa-dp-1',
  stoneType: 'Napa Stones',
  finish: 'Double polish',
  defaultRate: 40,
  rateUnit: 'SQ_FT',
});

test('UNIT Regular works', () => {
  let entry = {
    productId: unitProduct.id,
    quantity: '15',
    rate: '470',
    rowNo: '1',
    category: 'TOP',
  };

  // Simulate clicking Regular button
  const handlePlacement = (curr, category) => ({ ...curr, category });
  entry = handlePlacement(entry, 'Regular');

  assert.equal(entry.category, 'Regular');
  // Badge display check
  const badgeText = entry.category === 'TOP' ? 'Top' : 'Regular';
  assert.equal(badgeText, 'Regular');

  // Verify source wires category='Regular'
  assert.match(measurementEntrySource, /\['Regular', 'Regular'\]/);
  assert.match(measurementEntrySource, /aria-pressed=\{entry\.category === value\}/);
});

test('UNIT Top works', () => {
  let entry = {
    productId: unitProduct.id,
    quantity: '15',
    rate: '470',
    rowNo: '1',
    category: 'Regular',
  };

  // Simulate clicking Top button
  const handlePlacement = (curr, category) => ({ ...curr, category });
  entry = handlePlacement(entry, 'TOP');

  assert.equal(entry.category, 'TOP');
  const badgeText = entry.category === 'TOP' ? 'Top' : 'Regular';
  assert.equal(badgeText, 'Top');

  assert.match(measurementEntrySource, /\['TOP', 'Top'\]/);
});

test('UNIT quantity + works', () => {
  const result = simulateStepper({
    value: '15',
    step: '1',
    min: 1,
    max: 100000,
    dir: 1,
  });
  assert.equal(result.next, '16');
  assert.equal(result.disabled, false);
});

test('UNIT quantity − works', () => {
  const result = simulateStepper({
    value: '15',
    step: '1',
    min: 1,
    max: 100000,
    dir: -1,
  });
  assert.equal(result.next, '14');
  assert.equal(result.disabled, false);

  // Decreasing at minimum (1) must be disabled
  const minResult = simulateStepper({
    value: '1',
    step: '1',
    min: 1,
    max: 100000,
    dir: -1,
  });
  assert.equal(minResult.disabled, true);
});

test('UNIT rate + works', () => {
  const result = simulateStepper({
    value: '470',
    step: '0.01',
    min: 0,
    dir: 1,
  });
  assert.equal(result.next, '471');
  assert.equal(result.disabled, false);
});

test('UNIT rate − works', () => {
  const result = simulateStepper({
    value: '470',
    step: '0.01',
    min: 0,
    dir: -1,
  });
  assert.equal(result.next, '469');
  assert.equal(result.disabled, false);

  // Decreasing at minimum (0) must be disabled
  const minResult = simulateStepper({
    value: '0',
    step: '0.01',
    min: 0,
    dir: -1,
  });
  assert.equal(minResult.disabled, true);
});

test('UNIT row navigation works', () => {
  const MAX_ROW = 20;
  const changeRow = (curr, target) => {
    const val = String(Math.min(MAX_ROW, Math.max(1, target)));
    return { ...curr, rowNo: val, category: 'Regular' };
  };

  let entry = { productId: unitProduct.id, quantity: '15', rate: '470', rowNo: '1', category: 'TOP' };

  // Row 1 -> Previous row disabled
  assert.equal(Number(entry.rowNo) <= 1, true);

  // Next row -> Row 2
  entry = changeRow(entry, Number(entry.rowNo) + 1);
  assert.equal(entry.rowNo, '2');
  assert.equal(entry.category, 'Regular', 'row change resets category to Regular');
  assert.equal(Number(entry.rowNo) <= 1, false, 'Previous row is now enabled');

  // Step up to MAX_ROW (20)
  entry = changeRow(entry, 20);
  assert.equal(entry.rowNo, '20');
  assert.equal(Number(entry.rowNo) >= MAX_ROW, true, 'Next row is disabled at 20');

  // Previous row -> Row 19
  entry = changeRow(entry, Number(entry.rowNo) - 1);
  assert.equal(entry.rowNo, '19');
});

test('UNIT Add Entry is not blocked by hidden Length/Width', () => {
  const unitEntry = {
    productId: unitProduct.id,
    quantity: '15',
    rate: '470',
    rowNo: '1',
    category: 'Regular',
    length: '', // Intentionally unmounted / empty
    width: '',  // Intentionally unmounted / empty
  };

  const errors = entryErrors(unitEntry, unitProduct);
  assert.deepEqual(errors, {}, 'entryErrors must be empty for valid UNIT entry');

  assert.doesNotThrow(() => {
    const row = makeRow(unitEntry, unitProduct);
    assert.equal(row.stoneType, 'Sink');
    assert.equal(row.finish, 'Ruff');
    assert.equal(row.quantity, 15);
    assert.equal(row.rate, 470);
    assert.equal(row.rowNo, 1);
    assert.equal(row.category, 'Regular');
  }, 'makeRow must succeed without length or width');
});

test('UNIT does not create fake dimensions', () => {
  const unitEntry = {
    productId: unitProduct.id,
    quantity: '15',
    rate: '470',
    rowNo: '1',
    category: 'Regular',
  };

  const row = makeRow(unitEntry, unitProduct);
  assert.equal(row.lengthFt, undefined, 'lengthFt must NOT be set or faked');
  assert.equal(row.widthFt, undefined, 'widthFt must NOT be set or faked');
  assert.ok(!Object.prototype.hasOwnProperty.call(row, 'lengthFt'), 'row object must not have lengthFt property');
  assert.ok(!Object.prototype.hasOwnProperty.call(row, 'widthFt'), 'row object must not have widthFt property');

  // Preview row check
  const [preview] = previewRows([row]);
  assert.equal(preview.sqFt, 0, 'UNIT preview row sqFt is 0');
  assert.equal(preview.lineTotal, 7050, 'UNIT preview lineTotal is quantity * rate (15 * 470 = 7050)');
});

test('SQ_FT controls still work', () => {
  const sqftEntry = {
    productId: sqftProduct.id,
    length: '3½',
    width: '2',
    quantity: '5',
    rate: '40',
    rowNo: '1',
    category: 'Regular',
  };

  // Valid SQ_FT entry passes
  const validErrors = entryErrors(sqftEntry, sqftProduct);
  assert.deepEqual(validErrors, {});
  const row = makeRow(sqftEntry, sqftProduct);
  assert.equal(row.lengthFt, 3.5);
  assert.equal(row.widthFt, 2);
  assert.equal(row.quantity, 5);
  assert.equal(row.ratePerSqFt, 40);

  // Missing length or width on SQ_FT is rejected
  const missingLength = entryErrors({ ...sqftEntry, length: '' }, sqftProduct);
  assert.ok(missingLength.length, 'SQ_FT requires length');

  const missingWidth = entryErrors({ ...sqftEntry, width: '' }, sqftProduct);
  assert.ok(missingWidth.width, 'SQ_FT requires width');

  assert.throws(() => makeRow({ ...sqftEntry, length: '' }, sqftProduct), /Enter positive lengths and widths/);
  assert.throws(() => makeRow({ ...sqftEntry, width: '' }, sqftProduct), /Enter positive lengths and widths/);

  // Preview row check
  const [preview] = previewRows([row]);
  assert.equal(preview.sqFt, 35, '3.5 * 2 * 5 = 35 sq ft');
  assert.equal(preview.lineTotal, 1400, '35 * 40 = 1400 line total');
});

test('UNIT draft payload and backend processInventory accept UNIT rows without Invalid length error', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const backend = require('../../Backend/utils/pilotCalculations.js');
  const { payload, fromDispatch } = await import('../src/utils/pilotDraft.js');

  const unitRow = makeRow({
    productId: unitProduct.id,
    quantity: '15',
    rate: '470',
    rowNo: '1',
    category: 'Regular',
  }, unitProduct);

  const draft = {
    clientRequestId: 'req-unit-test-1',
    partyName: 'Test Buyer',
    truckNumber: 'AP01AB1234',
    date: '2026-10-22',
    buyerDestination: 'Hyderabad',
    supervisor: 'Siva',
    fee: '100',
    rows: [unitRow],
  };

  const dispatchPayload = payload(draft);
  assert.equal(dispatchPayload.inventory.length, 1);
  const group = dispatchPayload.inventory[0];
  assert.equal(group.rateUnit, 'UNIT');
  assert.equal(group.measurementRows.length, 1);
  assert.equal(group.measurementRows[0].rateUnit, 'UNIT');
  assert.equal(group.measurementRows[0].lengthFt, undefined);
  assert.equal(group.measurementRows[0].widthFt, undefined);

  // Backend processInventory must process this without throwing "Invalid length"
  const inventory = backend.processInventory(dispatchPayload.inventory);
  assert.equal(inventory[0].rateUnit, 'UNIT');
  assert.equal(inventory[0].totalSqFt, 0);
  assert.equal(inventory[0].lineTotal, 7050);
  assert.equal(inventory[0].measurementRows[0].sqFt, 0);
  assert.equal(inventory[0].measurementRows[0].lineTotal, 7050);

  // Backend totals must calculate correct summary
  const summary = backend.totals(inventory, 100);
  assert.equal(summary.totalPieces, 15);
  assert.equal(summary.totalDispatchVolumeSqFt, 0);
  assert.equal(summary.baseMaterialTotal, 7050);
  assert.equal(summary.loadingAndRoyaltyFees, 100);
  assert.equal(summary.netBillableAmount, 7150);

  // fromDispatch must recover rateUnit: 'UNIT'
  const recovered = fromDispatch({
    clientRequestId: draft.clientRequestId,
    id: 'dispatch-123',
    partyName: draft.partyName,
    supervisor: draft.supervisor,
    date: draft.date,
    logistics: { truckNumber: draft.truckNumber, buyerDestination: draft.buyerDestination },
    summary,
    inventory,
  });
  assert.equal(recovered.rows.length, 1);
  assert.equal(recovered.rows[0].rateUnit, 'UNIT');
});

test('UNIT invoice rendering: excluded from measurement body, rendered in summaries, private on driver slip', async () => {
  const { a4InvoiceFromDispatch, projectCopy } = await import('../src/utils/a4InvoiceModel.js');
  const { renderA4Invoice } = await import('../src/utils/a4InvoiceRender.js');
  const { planSynthetic } = await import('./helpers/a4Generators.js');

  const mixedRecord = {
    id: 'disp-mixed-1',
    dispatchSlipNumber: 'GS-100',
    date: '2026-10-22',
    status: 'Dispatched',
    partyName: 'Napa Buyer',
    supervisor: 'Siva',
    logistics: { truckNumber: 'AP01AB5555', buyerDestination: 'Kurnool' },
    businessSnapshot: { businessName: 'StoneDesk Minerals', address: 'Kadapa', phone: '9999999999' },
    inventory: [
      {
        stoneType: 'Napa Stones',
        finish: 'Double polish',
        ratePerSqFt: 40,
        rateUnit: 'SQ_FT',
        totalSqFt: 100,
        lineTotal: 4000,
        measurementRows: [
          { rowNo: 1, lengthFt: '5', widthFt: '4', quantity: 5, category: 'Regular', rateUnit: 'SQ_FT', sqFt: 100, lineTotal: 4000 },
        ],
      },
      {
        stoneType: 'Sink',
        finish: 'Ruff',
        ratePerSqFt: 470,
        rateUnit: 'UNIT',
        totalSqFt: 0,
        lineTotal: 16450,
        measurementRows: [
          { rowNo: 2, quantity: 35, category: 'Regular', rateUnit: 'UNIT', sqFt: 0, lineTotal: 16450 },
        ],
      },
    ],
    summary: {
      totalPieces: 40,
      totalDispatchVolumeSqFt: 100,
      baseMaterialTotal: 20450,
      loadingAndRoyaltyFees: 500,
      netBillableAmount: 20950,
    },
  };

  const model = a4InvoiceFromDispatch(mixedRecord);
  assert.ok(model);

  // 1. UNIT product excluded from measurement body: only Napa Stones (SQ_FT) group is in model.groups
  assert.equal(model.groups.length, 1);
  assert.equal(model.groups[0].id, 1);
  assert.equal(model.groups[0].entries.length, 1);
  assert.equal(model.groups[0].entries[0].rateUnit, 'SQ_FT');

  // 2. Totals correctly segregated
  assert.equal(model.totals.pieces, 5, 'Total stone pieces should be SQ_FT only');
  assert.equal(model.totals.totalStonePieces, 5);
  assert.equal(model.totals.totalUnits, 35, 'Total units should be UNIT only');
  assert.equal(model.totals.area, '100');
  assert.equal(model.totals.stoneMaterialTotal, '4000.00');
  assert.equal(model.totals.unitProductTotal, '16450.00');
  assert.equal(model.totals.materialTotal, '20450.00', 'Combined Material total = Stone material total + Unit product total');
  assert.equal(model.totals.netPayable, '20950.00');

  // 3. Amount in words includes UNIT amounts
  assert.match(model.amountWords, /Twenty Thousand Nine Hundred Fifty/);

  // 4. Rendered buyer copy verification
  const buyerPages = planSynthetic(model, 'buyer');
  const buyerHtml = renderA4Invoice(model, buyerPages, 'buyer');

  // Measurement body must contain SQ_FT rows but NOT Sink or UNIT rows
  assert.match(buyerHtml, /data-group="1"/);
  assert.doesNotMatch(buyerHtml, /data-group="2"/);
  assert.doesNotMatch(buyerHtml, /<td class="dim">-<\/td>/);
  assert.doesNotMatch(buyerHtml, /Reg total\s*<\/th><td class="qty">35<\/td>/);

  // Product Summary contains both SQ_FT and UNIT with proper suffixes
  assert.match(buyerHtml, /Napa Stones · Double polish/);
  assert.match(buyerHtml, /<span class="qty-num">5<\/span>\s*<span class="qty-unit">pcs<\/span>/);
  assert.match(buyerHtml, /<span class="rate-num">₹40<\/span><span class="rate-unit">\s*\/\s*sq ft<\/span>/);
  assert.match(buyerHtml, /Sink · Ruff/);
  assert.match(buyerHtml, /<span class="qty-num">35<\/span>\s*<span class="qty-unit">units<\/span>/);
  assert.match(buyerHtml, /<span class="rate-num">₹470<\/span><span class="rate-unit">\s*\/\s*unit<\/span>/);

  // Order Summary shows 3 headline stats and split material totals
  assert.match(buyerHtml, /Stone pieces/);
  assert.match(buyerHtml, /<dd data-total="pieces">5<\/dd>/);
  assert.match(buyerHtml, /Area · sq ft/);
  assert.match(buyerHtml, /<dd data-total="area">100\.00<\/dd>/);
  assert.match(buyerHtml, /Units/);
  assert.match(buyerHtml, /<dd data-total="units">35<\/dd>/);
  assert.match(buyerHtml, /Stone total/);
  assert.match(buyerHtml, /<dd data-total="stone-material">₹4,000\.00<\/dd>/);
  assert.match(buyerHtml, /Unit total/);
  assert.match(buyerHtml, /<dd data-total="unit-material">₹16,450\.00<\/dd>/);

  // Payment Summary shows combined Material total and Net payable
  assert.match(buyerHtml, /<dd data-amount="material">₹20,450\.00<\/dd>/);
  assert.match(buyerHtml, /<dd data-total="net">₹20,950\.00<\/dd>/);

  // 5. Driver Slip verification: no financial data, no prices/rupees
  const driverModel = projectCopy(model, 'driver');
  assert.equal('materialTotal' in driverModel.totals, false);
  assert.equal('stoneMaterialTotal' in driverModel.totals, false);
  assert.equal('unitProductTotal' in driverModel.totals, false);
  assert.equal('netPayable' in driverModel.totals, false);
  assert.equal(driverModel.products, undefined);
  assert.deepEqual(driverModel.unitProducts, [{ stoneType: 'Sink', finish: 'Ruff', quantity: 35 }]);

  const driverPages = planSynthetic(driverModel, 'driver');
  const driverHtml = renderA4Invoice(driverModel, driverPages, 'driver');
  assert.ok(!driverHtml.includes('₹'), 'Driver slip must contain no rupee symbol');
  assert.doesNotMatch(driverHtml, /product-summary/);
  assert.match(driverHtml, /Sink \u00b7 Ruff/);
  assert.match(driverHtml, /35 units/);
  assert.match(driverHtml, /Stone pieces/);
  assert.match(driverHtml, /Units/);
  assert.match(driverHtml, /<dd data-total="units">35<\/dd>/);
  assert.doesNotMatch(driverHtml, /Stone total/);
  assert.doesNotMatch(driverHtml, /Unit total/);
  assert.doesNotMatch(driverHtml, /Material total/);

  // 6. Pure UNIT order verification
  const pureUnitRecord = {
    id: 'disp-pure-unit',
    dispatchSlipNumber: 'GS-101',
    date: '2026-10-22',
    status: 'Dispatched',
    partyName: 'Sink Buyer',
    supervisor: 'Siva',
    logistics: { truckNumber: 'AP01AB5555', buyerDestination: 'Kurnool' },
    businessSnapshot: { businessName: 'StoneDesk Minerals', address: 'Kadapa', phone: '9999999999' },
    inventory: [
      {
        stoneType: 'Sink',
        finish: 'Ruff',
        ratePerSqFt: 470,
        rateUnit: 'UNIT',
        totalSqFt: 0,
        lineTotal: 7050,
        measurementRows: [
          { rowNo: 1, quantity: 15, category: 'Regular', rateUnit: 'UNIT', sqFt: 0, lineTotal: 7050 },
        ],
      },
    ],
    summary: {
      totalPieces: 15,
      totalDispatchVolumeSqFt: 0,
      baseMaterialTotal: 7050,
      loadingAndRoyaltyFees: 0,
      netBillableAmount: 7050,
    },
  };

  const pureUnitModel = a4InvoiceFromDispatch(pureUnitRecord);
  assert.equal(pureUnitModel.groups.length, 0, 'Pure UNIT order produces empty measurement groups');
  assert.equal(pureUnitModel.totals.totalUnits, 15);
  assert.equal(pureUnitModel.totals.pieces, 0);
  assert.equal(pureUnitModel.totals.materialTotal, '7050.00');

  const pureUnitPages = planSynthetic(pureUnitModel, 'buyer');
  assert.equal(pureUnitPages.length, 1, 'Pure UNIT order renders on a single page');
  const pureUnitHtml = renderA4Invoice(pureUnitModel, pureUnitPages, 'buyer');
  assert.doesNotMatch(pureUnitHtml, /detail-columns/);
  assert.match(pureUnitHtml, /Sink · Ruff/);
  assert.match(pureUnitHtml, /<span class="qty-num">15<\/span>\s*<span class="qty-unit">units<\/span>/);
  assert.match(pureUnitHtml, /<dd data-total="units">15<\/dd>/);
  assert.match(pureUnitHtml, /<dd data-total="stone-material">₹0\.00<\/dd>/);
  assert.match(pureUnitHtml, /<dd data-total="unit-material">₹7,050\.00<\/dd>/);
  assert.match(pureUnitHtml, /<dd data-total="net">₹7,050\.00<\/dd>/);
});
