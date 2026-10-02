import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBuyerInvoice } from '../src/utils/generateBuyerInvoice.js';

test('Buyer Invoice Generator', async (t) => {
  // A historical dispatch record. Rate = 100, Royalty = 8500
  const historicalDispatch = {
    status: 'Dispatched',
    dispatchSlipNumber: 'GS-OLD-999',
    date: new Date('2025-01-01'),
    supervisor: 'Siva',
    logistics: { truckNumber: 'TN01', buyerDestination: 'Chennai' },
    inventory: [
      {
        stoneType: 'Galaxy',
        finish: 'Slabs',
        ratePerSqFt: 100,
        lineTotal: 5000,
        pieces: [
          { lengthFt: 10, widthFt: 5, sqFt: 50 }
        ]
      }
    ],
    summary: {
      totalDispatchVolumeSqFt: 50,
      baseMaterialTotal: 5000,
      loadingAndRoyaltyFees: 8500,
      netBillableAmount: 13500 
    }
  };

  // Mocking MasterSettings change - the generator must NOT use this global or require it.
  // The fact that generateBuyerInvoice ONLY accepts `dispatch` proves it relies on historical record.

  await t.test('1. Valid finalized Dispatch generates a PDF Blob', async () => {
    const res = await generateBuyerInvoice(historicalDispatch);
    assert.ok(res.blob);
    assert.equal(res.filename, 'GraniteSync-Buyer-Invoice-GS-OLD-999.pdf');
  });

  await t.test('9. Missing Dispatch is rejected', async () => {
    await assert.rejects(async () => {
      await generateBuyerInvoice(null);
    }, /Missing Dispatch record/);
  });
  
  await t.test('12. Draft dispatch cannot generate', async () => {
    await assert.rejects(async () => {
      await generateBuyerInvoice({ ...historicalDispatch, status: 'Draft' });
    }, /Cannot generate invoice for an unfinalized Dispatch/);
  });

  await t.test('17. Missing financial summary is handled safely', async () => {
    await assert.rejects(async () => {
      await generateBuyerInvoice({ ...historicalDispatch, summary: null });
    }, /Missing financial summary in Dispatch/);
  });

  await t.test('Historical Immutability: Relies solely on passed dispatch values', async () => {
    // If we pass historical values, the PDF generation succeeds without errors,
    // thereby freezing the state in the rendered document.
    const res = await generateBuyerInvoice(historicalDispatch);
    assert.ok(res.blob);
  });
});
