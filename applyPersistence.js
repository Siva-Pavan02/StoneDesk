const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components');
const dispatchDir = path.join(dir, 'dispatch');

let tracker = fs.readFileSync(path.join(dir, 'DispatchTracker.jsx'), 'utf-8');

tracker = tracker.replace(
  `import { getMasterSettings } from '../lib/api';`,
  `import { getMasterSettings, createDispatch, updateDispatch, finalizeDispatch } from '../lib/api';`
);

const stateInsert = `
  const [currentDispatch, setCurrentDispatch] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
`;
tracker = tracker.replace(`const [pieces, setPieces] = useState([]);`, `const [pieces, setPieces] = useState([]);${stateInsert}`);

const handlersInsert = `
  const buildPayload = () => {
    const inventoryMap = {};
    pieces.forEach(p => {
      const key = \`\${p.stoneType}|\${p.finish}|\${p.ratePerSqFt}\`;
      if (!inventoryMap[key]) {
        inventoryMap[key] = {
          stoneType: p.stoneType,
          finish: p.finish,
          ratePerSqFt: Number(p.ratePerSqFt),
          pieces: []
        };
      }
      inventoryMap[key].pieces.push({
        lengthFt: p.lengthFt,
        widthFt: p.widthFt
      });
    });

    return {
      supervisor: 'Supervisor',
      logistics: { truckNumber, buyerDestination },
      inventory: Object.values(inventoryMap)
    };
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      setSaveMessage(null);
      const payload = buildPayload();
      
      let res;
      if (currentDispatch && currentDispatch.status === 'Draft') {
        res = await updateDispatch(currentDispatch._id, payload);
        setSaveMessage('Draft updated');
      } else {
        res = await createDispatch(payload);
        setSaveMessage('Draft created');
      }
      setCurrentDispatch(res);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      alert(err.message || 'Error saving dispatch');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    try {
      if (!currentDispatch) {
        alert('Please save as draft first before finalizing.');
        return;
      }
      setIsSaving(true);
      setSaveMessage(null);
      
      // Optionally update draft first to ensure latest pieces are caught
      await updateDispatch(currentDispatch._id, buildPayload());
      
      const res = await finalizeDispatch(currentDispatch._id);
      setCurrentDispatch(res);
      setSaveMessage('Dispatch finalized!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      alert(err.message || 'Error finalizing dispatch');
    } finally {
      setIsSaving(false);
    }
  };
`;

tracker = tracker.replace(
  `const groups = pieces.map(p => ({ totalSqFt: p.sqFt, ratePerSqFt: p.ratePerSqFt }));`,
  `${handlersInsert}\n  const groups = pieces.map(p => ({ totalSqFt: p.sqFt, ratePerSqFt: p.ratePerSqFt }));`
);

tracker = tracker.replace(
  `<DispatchActions totals={totals} />`,
  `<DispatchActions totals={totals} onSaveDraft={handleSaveDraft} onFinalize={handleFinalize} isSaving={isSaving} saveMessage={saveMessage} currentDispatch={currentDispatch} />`
);

fs.writeFileSync(path.join(dir, 'DispatchTracker.jsx'), tracker);

let actions = fs.readFileSync(path.join(dispatchDir, 'DispatchActions.jsx'), 'utf-8');

actions = actions.replace(
  `export default function DispatchActions({ totals }) {`,
  `export default function DispatchActions({ totals, onSaveDraft, onFinalize, isSaving, saveMessage, currentDispatch }) {`
);

actions = actions.replace(
  `<button className="py-3 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all" onClick={() => console.log("clicked")} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">chat</span><span className="text-sm font-bold leading-tight">Share to WhatsApp</span></div></button>`,
  `<button className="py-3 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all disabled:opacity-50" onClick={onSaveDraft} disabled={isSaving || currentDispatch?.status === 'Dispatched'} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">save</span><span className="text-sm font-bold leading-tight">{currentDispatch?.status === 'Draft' ? 'Update Draft' : 'Save Draft'}</span></div></button>`
);

actions = actions.replace(
  `<button className="py-3 px-3 rounded-xl bg-[#1D6F42] hover:bg-[#165834] active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all" onClick={() => console.log("clicked")} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">table_view</span><span className="text-sm font-bold leading-tight">Download Excel</span></div></button>`,
  `<button className="py-3 px-3 rounded-xl bg-[#1D6F42] hover:bg-[#165834] active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all disabled:opacity-50" onClick={onFinalize} disabled={isSaving || currentDispatch?.status === 'Dispatched'} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">check_circle</span><span className="text-sm font-bold leading-tight">{currentDispatch?.status === 'Dispatched' ? 'Finalized' : 'Finalize Dispatch'}</span></div></button>`
);

actions = actions.replace(
  `<span className="text-xs font-semibold text-slate-700 leading-none">Total Load Value</span>`,
  `<span className="text-xs font-semibold text-slate-700 leading-none">Total Load Value {saveMessage && <span className="text-teal-600 ml-2 animate-pulse">{saveMessage}</span>}</span>`
);

fs.writeFileSync(path.join(dispatchDir, 'DispatchActions.jsx'), actions);

console.log('Persistence applied');
