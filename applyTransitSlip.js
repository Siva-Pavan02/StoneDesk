const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components');
const dispatchDir = path.join(dir, 'dispatch');

// Update DispatchTracker.jsx
let tracker = fs.readFileSync(path.join(dir, 'DispatchTracker.jsx'), 'utf-8');

if (!tracker.includes('import { generateDriverTransitSlip }')) {
  tracker = tracker.replace(
    `import { getMasterSettings`,
    `import { generateDriverTransitSlip } from '../utils/generateDriverTransitSlip';\nimport { getMasterSettings`
  );
}

const handleDownloadInsert = `
  const handleDownloadDriverSlip = () => {
    try {
      if (!currentDispatch || (currentDispatch.status !== 'Dispatched' && currentDispatch.status !== 'Delivered')) {
        alert('Please finalize the dispatch first.');
        return;
      }
      const { blob, filename } = generateDriverTransitSlip(currentDispatch);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Error generating transit slip');
    }
  };
`;

if (!tracker.includes('handleDownloadDriverSlip')) {
  tracker = tracker.replace(
    `const handleFinalize = async () => {`,
    `${handleDownloadInsert}\n  const handleFinalize = async () => {`
  );
}

tracker = tracker.replace(
  `onFinalize={handleFinalize} isSaving={isSaving}`,
  `onFinalize={handleFinalize} onDownloadSlip={handleDownloadDriverSlip} isSaving={isSaving}`
);

fs.writeFileSync(path.join(dir, 'DispatchTracker.jsx'), tracker);

// Update DispatchActions.jsx
let actions = fs.readFileSync(path.join(dispatchDir, 'DispatchActions.jsx'), 'utf-8');

actions = actions.replace(
  `export default function DispatchActions({ totals, onSaveDraft, onFinalize, isSaving, saveMessage, currentDispatch }) {`,
  `export default function DispatchActions({ totals, onSaveDraft, onFinalize, onDownloadSlip, isSaving, saveMessage, currentDispatch }) {`
);

// We add a new third button for downloading the slip. Wait, let's just add it conditionally if finalized.
const actionsReplace = `
        <div className="grid grid-cols-2 gap-2.5">
          <button className="py-3 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all disabled:opacity-50" onClick={onSaveDraft} disabled={isSaving || currentDispatch?.status === 'Dispatched'} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">save</span><span className="text-sm font-bold leading-tight">{currentDispatch?.status === 'Draft' ? 'Update Draft' : 'Save Draft'}</span></div></button>
          
          {currentDispatch?.status === 'Dispatched' || currentDispatch?.status === 'Delivered' ? (
            <button className="py-3 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all disabled:opacity-50" onClick={onDownloadSlip} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">local_shipping</span><span className="text-sm font-bold leading-tight">Driver Slip</span></div></button>
          ) : (
            <button className="py-3 px-3 rounded-xl bg-[#1D6F42] hover:bg-[#165834] active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all disabled:opacity-50" onClick={onFinalize} disabled={isSaving || currentDispatch?.status === 'Dispatched'} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">check_circle</span><span className="text-sm font-bold leading-tight">Finalize Dispatch</span></div></button>
          )}
        </div>
`;

// we replace the grid entirely
const gridMatch = /<div className="grid grid-cols-2 gap-2.5">[\s\S]*?<\/div>/;
actions = actions.replace(gridMatch, actionsReplace.trim());

fs.writeFileSync(path.join(dispatchDir, 'DispatchActions.jsx'), actions);

console.log('Driver Slip Integration applied');
