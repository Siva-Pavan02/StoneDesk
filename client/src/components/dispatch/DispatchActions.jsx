import React from 'react';

export default function DispatchActions({ totals, onSaveDraft, onFinalize, onDownloadSlip, onDownloadInvoice, onDownloadExcel, isSaving, saveMessage, currentDispatch }) {
  const formatCurrency = (val) => Number(val).toLocaleString('en-IN');

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 pb-safe shadow-lg z-30">
      <div className="max-w-xl mx-auto w-full flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-700 leading-none">Total Load Value {saveMessage && <span className="text-teal-600 ml-2 animate-pulse">{saveMessage}</span>}</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-slate-900 leading-none">₹{formatCurrency(totals.netBillableAmount)}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {currentDispatch?.status === 'Dispatched' || currentDispatch?.status === 'Delivered' ? (
            <>
              <button className="py-3 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-[0.98] text-white font-bold flex flex-col items-center justify-center shadow-sm transition-all disabled:opacity-50 text-center leading-tight h-full" onClick={onDownloadSlip} type="button" disabled={isSaving}><span className="material-symbols-outlined text-[19px] mb-1">local_shipping</span><span className="text-xs">Driver Slip</span></button>
              
              <button className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white font-bold flex flex-col items-center justify-center shadow-sm transition-all disabled:opacity-50 text-center leading-tight h-full" onClick={onDownloadInvoice} type="button" disabled={isSaving}><span className="material-symbols-outlined text-[19px] mb-1">receipt_long</span><span className="text-xs">Buyer Invoice</span></button>
              
              <button className="py-3 px-3 rounded-xl bg-[#1D6F42] hover:bg-[#165834] active:scale-[0.98] text-white font-bold flex flex-col items-center justify-center shadow-sm transition-all disabled:opacity-50 text-center leading-tight h-full" onClick={onDownloadExcel} type="button" disabled={isSaving}><span className="material-symbols-outlined text-[19px] mb-1">table_view</span><span className="text-xs">Export Excel</span></button>
            </>
          ) : (
            <>
              <button className="col-span-1 py-3 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all disabled:opacity-50" onClick={onSaveDraft} disabled={isSaving} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">save</span><span className="text-sm font-bold leading-tight">{currentDispatch?.status === 'Draft' ? 'Update' : 'Save'}</span></div></button>
              
              <button className="col-span-2 py-3 px-3 rounded-xl bg-[#1D6F42] hover:bg-[#165834] active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all disabled:opacity-50" onClick={onFinalize} disabled={isSaving} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">check_circle</span><span className="text-sm font-bold leading-tight">Finalize Dispatch</span></div></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
