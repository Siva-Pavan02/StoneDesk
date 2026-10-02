const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components');
const dispatchDir = path.join(dir, 'dispatch');

const tracker = `import React, { useState } from 'react';
import DispatchHeader from './dispatch/DispatchHeader';
import DispatchDetails from './dispatch/DispatchDetails';
import StoneMeasurementForm from './dispatch/StoneMeasurementForm';
import DispatchSummary from './dispatch/DispatchSummary';
import DispatchActions from './dispatch/DispatchActions';
import { calculatePiece, calculateDispatchTotals } from '../utils/dispatchCalculations';

export default function DispatchTracker() {
  const [truckNumber, setTruckNumber] = useState('AP 04 TX 8492');
  const [buyerDestination, setBuyerDestination] = useState('Sri Krishna Granites — Salem, TN');
  const [stoneType, setStoneType] = useState('Black Galaxy (Slabs)');
  const [finish, setFinish] = useState('');
  const [ratePerSqFt, setRatePerSqFt] = useState('35');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [pieces, setPieces] = useState([]);

  const handleAddPiece = () => {
    try {
      const p = calculatePiece(length, width);
      setPieces([...pieces, { stoneType, finish, ratePerSqFt, ...p }]);
      setLength('');
      setWidth('');
    } catch (e) {
      // Invalid dimensions, do not add
    }
  };

  const handleRemovePiece = (index) => {
    setPieces(pieces.filter((_, i) => i !== index));
  };

  const groups = pieces.map(p => ({ totalSqFt: p.sqFt, ratePerSqFt: p.ratePerSqFt }));
  const totals = calculateDispatchTotals(groups, 8500);

  return (
    <>
      <DispatchHeader />
      <main className="flex-1 flex flex-col relative w-full max-w-xl mx-auto px-4 pt-24 bg-gray-50">
        <div className="flex flex-col w-full pb-36">
          <DispatchDetails
            truckNumber={truckNumber}
            setTruckNumber={setTruckNumber}
            buyerDestination={buyerDestination}
            setBuyerDestination={setBuyerDestination}
          />
          <StoneMeasurementForm
            stoneType={stoneType}
            setStoneType={setStoneType}
            length={length}
            setLength={setLength}
            width={width}
            setWidth={setWidth}
            ratePerSqFt={ratePerSqFt}
            setRatePerSqFt={setRatePerSqFt}
            onAddPiece={handleAddPiece}
            pieces={pieces}
            onRemovePiece={handleRemovePiece}
          />
          <DispatchSummary totals={totals} />
          <DispatchActions totals={totals} />
        </div>
      </main>
    </>
  );
}
`;

const fractionChips = `import React from 'react';

export default function FractionChips({ value, setValue }) {
  const addFraction = (frac) => {
    const val = parseFloat(value || 0);
    setValue((val + frac).toString());
  };
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <button className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold active:bg-teal-50 transition-colors" onClick={() => addFraction(0.25)} type="button">+ ¼</button>
      <button className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold active:bg-teal-50 transition-colors" onClick={() => addFraction(0.5)} type="button">+ ½</button>
      <button className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold active:bg-teal-50 transition-colors" onClick={() => addFraction(0.75)} type="button">+ ¾</button>
    </div>
  );
}
`;

const stoneForm = `import React from 'react';
import FractionChips from './FractionChips';
import StoneLedger from './StoneLedger';
import { calculatePiece, calculateLineTotal } from '../../utils/dispatchCalculations';

export default function StoneMeasurementForm({
  stoneType, setStoneType, length, setLength, width, setWidth,
  ratePerSqFt, setRatePerSqFt, onAddPiece, pieces, onRemovePiece
}) {
  let liveSqFt = '?';
  let liveLineTotal = '?';
  try {
    const p = calculatePiece(length, width);
    liveSqFt = p.sqFt;
    liveLineTotal = calculateLineTotal(p.sqFt, ratePerSqFt);
  } catch (e) {
    // Invalid
  }

  return (
    <>
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800"><span className="material-symbols-outlined text-[20px]">straighten</span></div><div className="flex flex-col"><h2 className="text-base font-semibold text-slate-800 leading-tight">Stone Measurement Ledger</h2></div></div><button aria-label="Reset ledger" className="w-9 h-9 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors" type="button"><span className="material-symbols-outlined text-[20px]">delete</span></button></div>
        
        <div className="mb-4"><div className="flex justify-between items-baseline mb-1.5"><label className="text-sm font-semibold text-slate-800" htmlFor="stoneType">Stone Type</label></div><div className="relative"><select className="w-full h-12 bg-white text-slate-800 font-medium text-sm rounded-lg px-3.5 pr-10 appearance-none border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="stoneType" value={stoneType} onChange={(e) => setStoneType(e.target.value)}><option>Black Galaxy (Slabs)</option><option>Steel Grey (Rough Blocks)</option><option>Tan Brown (Gang-saw)</option><option>Khammam Jet Black</option></select><span className="material-symbols-outlined pointer-events-none absolute right-3 top-3.5 text-slate-500 text-[20px]">expand_more</span></div></div>
        
        <div className="mb-3.5">
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-800 leading-none mb-1.5 truncate" htmlFor="lengthInput">Length (ft)</label>
              <input className="w-full h-12 bg-white text-slate-900 font-bold text-base text-center rounded-lg border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="lengthInput" step="0.1" type="number" value={length} onChange={(e) => setLength(e.target.value)} />
              <FractionChips value={length} setValue={setLength} />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-800 leading-none mb-1.5 truncate" htmlFor="widthInput">Width (ft)</label>
              <input className="w-full h-12 bg-white text-slate-900 font-bold text-base text-center rounded-lg border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="widthInput" step="0.1" type="number" value={width} onChange={(e) => setWidth(e.target.value)} />
              <FractionChips value={width} setValue={setWidth} />
            </div>
          </div>
          
          <button className="w-full h-12 bg-[#005683] hover:bg-[#004b73] active:scale-[0.99] text-white font-semibold flex items-center justify-center gap-1.5 rounded-lg shadow-sm transition-all" onClick={onAddPiece} type="button"><span className="material-symbols-outlined text-[20px]">add</span><span>+ Add Piece ({liveSqFt !== '?' ? \`\${liveSqFt} sq ft\` : 'Invalid'})</span></button>
        </div>
        
        <StoneLedger pieces={pieces} onRemovePiece={onRemovePiece} />
        
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col"><div className="flex justify-between items-baseline mb-1.5"><label className="text-xs font-semibold text-slate-800 leading-none" htmlFor="rateInput">Rate / Sq Ft (₹)</label></div><div className="relative flex items-center"><span className="absolute left-3 text-slate-500 font-bold text-sm">₹</span><input className="w-full h-12 pl-7 pr-3 bg-white text-slate-900 font-bold text-base rounded-lg border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="rateInput" type="number" value={ratePerSqFt} onChange={(e) => setRatePerSqFt(e.target.value)} /></div></div>
          <div className="flex flex-col"><div className="flex justify-between items-baseline mb-1.5"><span className="text-xs font-semibold text-slate-800 leading-none">Line Total (₹)</span></div><div className="h-12 bg-slate-100 border border-slate-200 flex items-center px-3.5 rounded-lg justify-end"><span className="text-base font-bold text-slate-900">₹{liveLineTotal}</span></div></div>
        </div>
      </section>
      
      <button className="w-full py-3 mb-4 rounded-xl bg-white hover:bg-slate-50 border-2 border-dashed border-teal-700/40 text-teal-800 font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-[0.99] shadow-sm" type="button"><span className="material-symbols-outlined text-[18px]">add_circle</span><span>+ Add Another Stone Item</span></button>
    </>
  );
}
`;

const stoneLedger = `import React from 'react';
import { calculateGroupSqFt } from '../../utils/dispatchCalculations';

export default function StoneLedger({ pieces, onRemovePiece }) {
  const totalVolume = calculateGroupSqFt(pieces);
  
  return (
    <>
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3.5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Pieces Logged ({pieces.length} items)</span>
        </div>
        <div className="flex flex-col gap-2">
          {pieces.map((p, i) => (
            <div key={i} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-xs font-medium text-slate-800 font-mono">{p.lengthFt} × {p.widthFt} = <strong className="text-slate-900 font-bold">{p.sqFt} sq ft</strong></span>
              </div>
              <button aria-label={"Remove piece " + (i + 1)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors" onClick={() => onRemovePiece(i)} type="button">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-3.5 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-teal-900 uppercase tracking-wide">Total Pieces: {pieces.length}</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-teal-700 font-medium block">Total Volume</span>
          <span className="text-xl font-bold text-teal-900">{totalVolume} sq ft</span>
        </div>
      </div>
    </>
  );
}
`;

const dispatchSummary = `import React from 'react';

export default function DispatchSummary({ totals }) {
  return (
    <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-4">
      <div className="flex items-center gap-2 mb-3.5"><div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800"><span className="material-symbols-outlined text-[20px]">receipt_long</span></div><div className="flex flex-col"><h3 className="text-base font-semibold text-slate-800 leading-none">Dispatch Summary</h3></div></div>
      <div className="flex flex-col gap-2.5 py-1 border-b border-slate-100 pb-3 mb-3">
        <div className="flex justify-between items-center text-slate-600"><span className="text-xs font-medium">Total Dispatch Volume</span><span className="text-sm text-slate-900 font-bold">{totals.totalDispatchVolumeSqFt} sq ft</span></div>
        <div className="flex justify-between items-center text-slate-600"><span className="text-xs font-medium">Base Material Total</span><span className="text-sm text-slate-900 font-bold">₹{totals.baseMaterialTotal}</span></div>
        <div className="flex justify-between items-center text-slate-600"><span className="text-xs font-medium">Loading &amp; Royalty</span><span className="text-sm text-slate-900 font-bold">₹{totals.loadingAndRoyaltyFees}</span></div>
      </div>
      <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
        <div className="flex flex-col"><span className="text-xs font-bold text-teal-950 uppercase tracking-wide">Net Billable Amount</span><span className="text-[11px] text-teal-800 font-medium">GST Included</span></div>
        <div className="text-right"><span className="text-xl font-bold text-teal-900">₹{totals.netBillableAmount}</span></div>
      </div>
    </section>
  );
}
`;

const dispatchActions = `import React from 'react';

export default function DispatchActions({ totals }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 pb-safe shadow-lg z-30">
      <div className="max-w-xl mx-auto w-full flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-700 leading-none">Total Load Value</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-slate-900 leading-none">₹{totals.netBillableAmount}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button className="py-3 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all" onClick={() => console.log("clicked")} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">chat</span><span className="text-sm font-bold leading-tight">Share to WhatsApp</span></div></button>
          <button className="py-3 px-3 rounded-xl bg-[#1D6F42] hover:bg-[#165834] active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all" onClick={() => console.log("clicked")} type="button"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[19px]">table_view</span><span className="text-sm font-bold leading-tight">Download Excel</span></div></button>
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(path.join(dir, 'DispatchTracker.jsx'), tracker);
fs.writeFileSync(path.join(dispatchDir, 'FractionChips.jsx'), fractionChips);
fs.writeFileSync(path.join(dispatchDir, 'StoneMeasurementForm.jsx'), stoneForm);
fs.writeFileSync(path.join(dispatchDir, 'StoneLedger.jsx'), stoneLedger);
fs.writeFileSync(path.join(dispatchDir, 'DispatchSummary.jsx'), dispatchSummary);
fs.writeFileSync(path.join(dispatchDir, 'DispatchActions.jsx'), dispatchActions);

console.log('Integration applied.');
