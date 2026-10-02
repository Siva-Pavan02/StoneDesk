const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components');
const dispatchDir = path.join(dir, 'dispatch');

// Update DispatchTracker.jsx
let tracker = fs.readFileSync(path.join(dir, 'DispatchTracker.jsx'), 'utf-8');

if (!tracker.includes('import { generateBuyerInvoice }')) {
  tracker = tracker.replace(
    `import { generateDriverTransitSlip`,
    `import { generateBuyerInvoice } from '../utils/generateBuyerInvoice';\nimport { generateDriverTransitSlip`
  );
}

const handleDownloadInvoiceInsert = `
  const handleDownloadInvoice = async () => {
    try {
      if (!currentDispatch || (currentDispatch.status !== 'Dispatched' && currentDispatch.status !== 'Delivered')) {
        alert('Please finalize the dispatch first.');
        return;
      }
      setIsSaving(true);
      const { blob, filename } = await generateBuyerInvoice(currentDispatch);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Error generating buyer invoice');
    } finally {
      setIsSaving(false);
    }
  };
`;

if (!tracker.includes('handleDownloadInvoice')) {
  tracker = tracker.replace(
    `const handleDownloadDriverSlip = () => {`,
    `${handleDownloadInvoiceInsert}\n  const handleDownloadDriverSlip = () => {`
  );
}

tracker = tracker.replace(
  `onDownloadSlip={handleDownloadDriverSlip} isSaving={isSaving}`,
  `onDownloadSlip={handleDownloadDriverSlip} onDownloadInvoice={handleDownloadInvoice} isSaving={isSaving}`
);

fs.writeFileSync(path.join(dir, 'DispatchTracker.jsx'), tracker);

// Update DispatchActions.jsx
let actions = fs.readFileSync(path.join(dispatchDir, 'DispatchActions.jsx'), 'utf-8');

actions = actions.replace(
  `export default function DispatchActions({ totals, onSaveDraft, onFinalize, onDownloadSlip, isSaving, saveMessage, currentDispatch }) {`,
  `export default function DispatchActions({ totals, onSaveDraft, onFinalize, onDownloadSlip, onDownloadInvoice, isSaving, saveMessage, currentDispatch }) {`
);

// We need to fit 3 buttons in the actions area if dispatched. Let's make it a flex or grid.
// If finalized: "Driver Slip" and "Buyer Invoice"
// If draft: "Save Draft" and "Finalize Dispatch"
const actionsReplace = `
        <div className="grid grid-cols-2 gap-2.5">
          {currentDispatch?.status === 'Dispatched' || currentDispatch?.status === 'Delivered' ? (
            <>
              <button className="py-3 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all disabled:opacity-50" onClick={onDownloadSlip} type="button" disabled={isSaving}><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">local_shipping</span><span className="text-sm font-bold leading-tight">Driver Slip</span></div></button>
              <button className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all disabled:opacity-50" onClick={onDownloadInvoice} type="button" disabled={isSaving}><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">receipt_long</span><span className="text-sm font-bold leading-tight">Buyer Invoice</span></div></button>
            </>
          ) : (
            <>
              <button className="py-3 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all disabled:opacity-50" onClick={onSaveDraft} disabled={isSaving} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">save</span><span className="text-sm font-bold leading-tight">{currentDispatch?.status === 'Draft' ? 'Update Draft' : 'Save Draft'}</span></div></button>
              <button className="py-3 px-3 rounded-xl bg-[#1D6F42] hover:bg-[#165834] active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all disabled:opacity-50" onClick={onFinalize} disabled={isSaving} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">check_circle</span><span className="text-sm font-bold leading-tight">Finalize Dispatch</span></div></button>
            </>
          )}
        </div>
`;

// regex to replace grid block
const gridMatch = /<div className="grid grid-cols-2 gap-2\.5">[\s\S]*?<\/div>/;
actions = actions.replace(gridMatch, actionsReplace.trim());

fs.writeFileSync(path.join(dispatchDir, 'DispatchActions.jsx'), actions);

console.log('Buyer Invoice Integration applied');
