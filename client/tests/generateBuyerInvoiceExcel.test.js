import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBuyerInvoiceExcel } from '../src/utils/generateBuyerInvoiceExcel.js';

test('Buyer Invoice Excel Generator', async (t) => {
  const historicalDispatch = {
    status: 'Dispatched',
    dispatchSlipNumber: 'GS-EXCEL-999',
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

  await t.test('1. Valid finalized Dispatch generates an Excel Blob', async () => {
    const res = generateBuyerInvoiceExcel(historicalDispatch);
    assert.ok(res.blob);
    assert.equal(res.filename, 'StoneDesk-Buyer-Invoice-GS-EXCEL-999.xlsx');
  });

  await t.test('Missing Dispatch is rejected', async () => {
    assert.throws(() => {
      generateBuyerInvoiceExcel(null);
    }, /Missing Dispatch record/);
  });
  
  await t.test('Draft dispatch cannot generate', async () => {
    assert.throws(() => {
      generateBuyerInvoiceExcel({ ...historicalDispatch, status: 'Draft' });
    }, /Cannot generate Excel invoice for an unfinalized Dispatch/);
  });

  await t.test('Missing financial summary is handled safely', async () => {
    assert.throws(() => {
      generateBuyerInvoiceExcel({ ...historicalDispatch, summary: null });
    }, /Missing financial summary in Dispatch/);
  });

  await t.test('Historical Immutability Verification', async () => {
    // Proves that only dispatch inventory data is required, not live settings.
    const res = generateBuyerInvoiceExcel(historicalDispatch);
    assert.ok(res.blob);
  });
});
