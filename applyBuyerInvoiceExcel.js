const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components');
const dispatchDir = path.join(dir, 'dispatch');

// Update DispatchTracker.jsx
let tracker = fs.readFileSync(path.join(dir, 'DispatchTracker.jsx'), 'utf-8');

if (!tracker.includes('import { generateBuyerInvoiceExcel }')) {
  tracker = tracker.replace(
    `import { generateBuyerInvoice }`,
    `import { generateBuyerInvoiceExcel } from '../utils/generateBuyerInvoiceExcel';\nimport { generateBuyerInvoice }`
  );
}

const handleDownloadExcelInsert = `
  const handleDownloadExcel = () => {
    try {
      if (!currentDispatch || (currentDispatch.status !== 'Dispatched' && currentDispatch.status !== 'Delivered')) {
        alert('Please finalize the dispatch first.');
        return;
      }
      const { blob, filename } = generateBuyerInvoiceExcel(currentDispatch);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Error generating Excel file');
    }
  };
`;

if (!tracker.includes('handleDownloadExcel')) {
  tracker = tracker.replace(
    `const handleDownloadInvoice = async () => {`,
    `${handleDownloadExcelInsert}\n  const handleDownloadInvoice = async () => {`
  );
}

tracker = tracker.replace(
  `onDownloadInvoice={handleDownloadInvoice} isSaving={isSaving}`,
  `onDownloadInvoice={handleDownloadInvoice} onDownloadExcel={handleDownloadExcel} isSaving={isSaving}`
);

fs.writeFileSync(path.join(dir, 'DispatchTracker.jsx'), tracker);

// Update DispatchActions.jsx
let actions = fs.readFileSync(path.join(dispatchDir, 'DispatchActions.jsx'), 'utf-8');

actions = actions.replace(
  `export default function DispatchActions({ totals, onSaveDraft, onFinalize, onDownloadSlip, onDownloadInvoice, isSaving, saveMessage, currentDispatch }) {`,
  `export default function DispatchActions({ totals, onSaveDraft, onFinalize, onDownloadSlip, onDownloadInvoice, onDownloadExcel, isSaving, saveMessage, currentDispatch }) {`
);

// Switch from grid-cols-2 to grid-cols-3 and add Excel button
const actionsReplace = `
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
`;

// regex to replace grid block
const gridMatch = /<div className="grid grid-cols-2 gap-2\.5">[\s\S]*?<\/div>/;
actions = actions.replace(gridMatch, actionsReplace.trim());

fs.writeFileSync(path.join(dispatchDir, 'DispatchActions.jsx'), actions);

console.log('Buyer Invoice Excel Integration applied');
