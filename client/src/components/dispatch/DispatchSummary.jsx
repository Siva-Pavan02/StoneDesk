import React from 'react';

export default function DispatchSummary({ totals }) {
  const formatCurrency = (val) => Number(val).toLocaleString('en-IN');
  
  return (
    <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-4">
      <div className="flex items-center gap-2 mb-3.5"><div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800"><span className="material-symbols-outlined text-[20px]">receipt_long</span></div><div className="flex flex-col"><h3 className="text-base font-semibold text-slate-800 leading-none">Dispatch Summary</h3></div></div>
      <div className="flex flex-col gap-2.5 py-1 border-b border-slate-100 pb-3 mb-3">
        <div className="flex justify-between items-center text-slate-600"><span className="text-xs font-medium">Total Dispatch Volume</span><span className="text-sm text-slate-900 font-bold">{totals.totalDispatchVolumeSqFt} sq ft</span></div>
        <div className="flex justify-between items-center text-slate-600"><span className="text-xs font-medium">Base Material Total</span><span className="text-sm text-slate-900 font-bold">₹{formatCurrency(totals.baseMaterialTotal)}</span></div>
        <div className="flex justify-between items-center text-slate-600"><span className="text-xs font-medium">Loading &amp; Royalty</span><span className="text-sm text-slate-900 font-bold">₹{formatCurrency(totals.loadingAndRoyaltyFees)}</span></div>
      </div>
      <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
        <div className="flex flex-col"><span className="text-xs font-bold text-teal-950 uppercase tracking-wide">Net Billable Amount</span><span className="text-[11px] text-teal-800 font-medium">GST Included</span></div>
        <div className="text-right"><span className="text-xl font-bold text-teal-900">₹{formatCurrency(totals.netBillableAmount)}</span></div>
      </div>
    </section>
  );
}
