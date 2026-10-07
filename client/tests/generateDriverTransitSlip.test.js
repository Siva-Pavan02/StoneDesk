import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDriverTransitSlip } from '../src/utils/generateDriverTransitSlip.js';

test('Driver Transit Slip Generator', async (t) => {
  const dispatch = {
    status: 'Dispatched',
    dispatchSlipNumber: 'GS-12345',
    date: new Date('2026-10-02'),
    supervisor: 'Siva',
    logistics: { truckNumber: 'TN01', buyerDestination: 'Chennai' },
    inventory: [
      {
        stoneType: 'Galaxy',
        finish: 'Slabs',
        ratePerSqFt: 150, // Must NOT be in PDF
        lineTotal: 7500, // Must NOT be in PDF
        pieces: [
          { lengthFt: 10, widthFt: 5, sqFt: 50 }
        ]
      }
    ],
    summary: {
      totalDispatchVolumeSqFt: 50,
      baseMaterialTotal: 7500,
      loadingAndRoyaltyFees: 8500, // Must NOT be in PDF
      netBillableAmount: 16000 // Must NOT be in PDF
    }
  };

  await t.test('1. Valid finalized Dispatch generates a PDF Blob', () => {
    const res = generateDriverTransitSlip(dispatch);
    assert.ok(res.blob);
    assert.equal(res.filename, 'StoneDesk-Driver-Slip-GS-12345.pdf');
  });

  await t.test('9. Missing Dispatch is rejected', () => {
    assert.throws(() => generateDriverTransitSlip(null), /Missing Dispatch record/);
  });
  
  await t.test('12. Draft dispatch cannot generate', () => {
    assert.throws(() => generateDriverTransitSlip({ ...dispatch, status: 'Draft' }), /Cannot generate transit slip for an unfinalized Dispatch/);
  });

  await t.test('10. Empty inventory is handled correctly', () => {
    assert.throws(() => generateDriverTransitSlip({ ...dispatch, inventory: [] }), /Missing inventory/);
  });
});
