const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components');
const dispatchDir = path.join(dir, 'dispatch');

// DispatchTracker.jsx
const tracker = `import React, { useState } from 'react';
import DispatchHeader from './dispatch/DispatchHeader';
import DispatchDetails from './dispatch/DispatchDetails';
import StoneMeasurementForm from './dispatch/StoneMeasurementForm';
import DispatchSummary from './dispatch/DispatchSummary';
import DispatchActions from './dispatch/DispatchActions';

export default function DispatchTracker() {
  const [truckNumber, setTruckNumber] = useState('AP 04 TX 8492');
  const [buyerDestination, setBuyerDestination] = useState('Sri Krishna Granites — Salem, TN');
  const [stoneType, setStoneType] = useState('Black Galaxy (Slabs)');
  const [finish, setFinish] = useState('');
  const [ratePerSqFt, setRatePerSqFt] = useState('35');
  const [length, setLength] = useState('8.5');
  const [width, setWidth] = useState('4.0');
  const [pieces, setPieces] = useState([
    { stoneType: 'Black Galaxy (Slabs)', finish: '', ratePerSqFt: '35', lengthFt: '8.5', widthFt: '4.0' },
    { stoneType: 'Black Galaxy (Slabs)', finish: '', ratePerSqFt: '35', lengthFt: '8.0', widthFt: '4.5' }
  ]);

  const handleAddPiece = () => {
    setPieces([...pieces, { stoneType, finish, ratePerSqFt, lengthFt: length, widthFt: width }]);
    setLength('');
    setWidth('');
  };

  const handleRemovePiece = (index) => {
    setPieces(pieces.filter((_, i) => i !== index));
  };

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
          <DispatchSummary pieces={pieces} />
          <DispatchActions pieces={pieces} />
        </div>
      </main>
    </>
  );
}
`;

// DispatchDetails.jsx
const details = `import React from 'react';

export default function DispatchDetails({ truckNumber, setTruckNumber, buyerDestination, setBuyerDestination }) {
  return (
    <>
      <section className="flex items-center justify-between py-2 px-1 mb-2"><div className="flex items-center gap-2"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-sm text-label-sm font-semibold">New Dispatch Entry</span></div><div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm"><span className="material-symbols-outlined text-[15px] text-primary">pin_drop</span><span className="font-medium">Pit-2</span><span className="text-slate-300">•</span><span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium text-[11px] leading-tight">Yerraguntla 516309</span></div></section><section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4"><div className="flex items-center gap-2.5 mb-4"><div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800"><span className="material-symbols-outlined text-[20px]">local_shipping</span></div><div className="flex flex-col"><h2 className="text-base font-semibold text-slate-800 leading-tight">Logistics &amp; Transport</h2></div></div><div className="mb-4"><div className="flex justify-between items-baseline mb-1.5"><label className="text-sm font-semibold text-slate-800" htmlFor="truckNo">Truck Number</label></div><div className="relative flex items-center"><input className="w-full h-12 bg-white text-slate-900 font-bold text-base tracking-wider rounded-lg px-3.5 pr-14 border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="truckNo" type="text" value={truckNumber} onChange={(e) => setTruckNumber(e.target.value)} /><button aria-label="Scan number plate" className="absolute right-1.5 w-10 h-10 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 active:bg-teal-700 active:text-white transition-colors" id="scanBtn" type="button"><span className="material-symbols-outlined text-[20px]">photo_camera</span></button></div></div><div className="mb-3.5"><div className="flex justify-between items-baseline mb-1.5"><label className="text-sm font-semibold text-slate-800" htmlFor="buyerDest">Buyer Destination</label></div><input className="w-full h-12 bg-white text-slate-800 font-medium text-sm rounded-lg px-3.5 border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="buyerDest" type="text" value={buyerDestination} onChange={(e) => setBuyerDestination(e.target.value)} /></div><div className=""><span className="text-xs text-slate-500 font-medium block mb-2">Quick Select Corridor</span><div className="flex flex-wrap gap-2"><button className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-200 active:bg-teal-50 transition-colors" onClick={() => setBuyerDestination('Salem, TN')} type="button">Salem, TN</button><button className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-200 active:bg-teal-50 transition-colors" onClick={() => setBuyerDestination('Hosur, TN')} type="button">Hosur, TN</button><button className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-200 active:bg-teal-50 transition-colors" onClick={() => setBuyerDestination('Chennai, TN')} type="button">Chennai, TN</button><button className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-200 active:bg-teal-50 transition-colors" onClick={() => setBuyerDestination('Bengaluru, KA')} type="button">Bengaluru, KA</button></div></div></section>
    </>
  );
}
`;

// FractionChips.jsx
const fractionChips = `import React from 'react';

export default function FractionChips({ length, setLength }) {
  const addFraction = (frac) => {
    const val = parseFloat(length || 0);
    setLength((val + frac).toString());
  };
  return (
    <>
      <div className="flex items-center justify-between gap-1.5 mb-3"><div className="flex items-center gap-1.5"><button className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold active:bg-teal-50 transition-colors" onClick={() => addFraction(0.25)} type="button">+ ¼</button><button className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold active:bg-teal-50 transition-colors" onClick={() => addFraction(0.5)} type="button">+ ½</button><button className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold active:bg-teal-50 transition-colors" onClick={() => addFraction(0.75)} type="button">+ ¾</button></div><span className="text-[11px] text-slate-400 font-medium">Tappable fractions</span></div>
    </>
  );
}
`;

// StoneLedger.jsx
const stoneLedger = `import React from 'react';

export default function StoneLedger({ pieces, onRemovePiece }) {
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
                <span className="text-xs font-medium text-slate-800 font-mono">{p.lengthFt} × {p.widthFt} = <strong className="text-slate-900 font-bold">? sq ft</strong></span>
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
          <span className="text-xl font-bold text-teal-900" id="totalSqFtDisplay">? sq ft</span>
        </div>
      </div>
    </>
  );
}
`;

// StoneMeasurementForm.jsx
const stoneForm = `import React from 'react';
import FractionChips from './FractionChips';
import StoneLedger from './StoneLedger';

export default function StoneMeasurementForm({
  stoneType, setStoneType, length, setLength, width, setWidth,
  ratePerSqFt, setRatePerSqFt, onAddPiece, pieces, onRemovePiece
}) {
  return (
    <>
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4"><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800"><span className="material-symbols-outlined text-[20px]">straighten</span></div><div className="flex flex-col"><h2 className="text-base font-semibold text-slate-800 leading-tight">Stone Measurement Ledger</h2></div></div><button aria-label="Reset ledger" className="w-9 h-9 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors" type="button"><span className="material-symbols-outlined text-[20px]">delete</span></button></div><div className="mb-4"><div className="flex justify-between items-baseline mb-1.5"><label className="text-sm font-semibold text-slate-800" htmlFor="stoneType">Stone Type</label></div><div className="relative"><select className="w-full h-12 bg-white text-slate-800 font-medium text-sm rounded-lg px-3.5 pr-10 appearance-none border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="stoneType" value={stoneType} onChange={(e) => setStoneType(e.target.value)}><option>Black Galaxy (Slabs)</option><option>Steel Grey (Rough Blocks)</option><option>Tan Brown (Gang-saw)</option><option>Khammam Jet Black</option></select><span className="material-symbols-outlined pointer-events-none absolute right-3 top-3.5 text-slate-500 text-[20px]">expand_more</span></div></div><div className="mb-3.5"><div className="grid grid-cols-2 gap-2.5 mb-2"><div className="flex flex-col"><label className="text-xs font-semibold text-slate-800 leading-none mb-1.5 truncate" htmlFor="lengthInput">Length (ft)</label><input className="w-full h-12 bg-white text-slate-900 font-bold text-base text-center rounded-lg border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="lengthInput" step="0.1" type="number" value={length} onChange={(e) => setLength(e.target.value)} /></div><div className="flex flex-col"><label className="text-xs font-semibold text-slate-800 leading-none mb-1.5 truncate" htmlFor="widthInput">Width (ft)</label><input className="w-full h-12 bg-white text-slate-900 font-bold text-base text-center rounded-lg border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="widthInput" step="0.1" type="number" value={width} onChange={(e) => setWidth(e.target.value)} /></div></div>
      <FractionChips length={length} setLength={setLength} />
      <button className="w-full h-12 bg-[#005683] hover:bg-[#004b73] active:scale-[0.99] text-white font-semibold flex items-center justify-center gap-1.5 rounded-lg shadow-sm transition-all" onClick={onAddPiece} type="button"><span className="material-symbols-outlined text-[20px]">add</span><span>+ Add Piece</span></button></div>
      <StoneLedger pieces={pieces} onRemovePiece={onRemovePiece} />
      <div className="grid grid-cols-2 gap-3"><div className="flex flex-col"><div className="flex justify-between items-baseline mb-1.5"><label className="text-xs font-semibold text-slate-800 leading-none" htmlFor="rateInput">Rate / Sq Ft (₹)</label></div><div className="relative flex items-center"><span className="absolute left-3 text-slate-500 font-bold text-sm">₹</span><input className="w-full h-12 pl-7 pr-3 bg-white text-slate-900 font-bold text-base rounded-lg border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="rateInput" type="number" value={ratePerSqFt} onChange={(e) => setRatePerSqFt(e.target.value)} /></div></div><div className="flex flex-col"><div className="flex justify-between items-baseline mb-1.5"><span className="text-xs font-semibold text-slate-800 leading-none">Line Total (₹)</span></div><div className="h-12 bg-slate-100 border border-slate-200 flex items-center px-3.5 rounded-lg justify-end"><span className="text-base font-bold text-slate-900" id="lineTotalDisplay">?</span></div></div></div></section><section className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-200 mb-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2.5 min-w-0"><div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0"><span className="material-symbols-outlined text-[18px]">layers</span></div><div className="flex flex-col min-w-0"><span className="text-xs font-semibold text-slate-800 truncate">#2: Steel Grey (Rough)</span><span className="text-[11px] text-slate-500 font-medium">620.0 sq ft • ₹99,200</span></div></div><button aria-label="Edit Item 2" className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-teal-800 hover:bg-slate-50 transition-colors" type="button"><span className="material-symbols-outlined text-[18px]">edit</span></button></div></section><button className="w-full py-3 mb-4 rounded-xl bg-white hover:bg-slate-50 border-2 border-dashed border-teal-700/40 text-teal-800 font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-[0.99] shadow-sm" type="button"><span className="material-symbols-outlined text-[18px]">add_circle</span><span>+ Add Another Stone Item</span></button>
    </>
  );
}
`;

fs.writeFileSync(path.join(dir, 'DispatchTracker.jsx'), tracker);
fs.writeFileSync(path.join(dispatchDir, 'DispatchDetails.jsx'), details);
fs.writeFileSync(path.join(dispatchDir, 'FractionChips.jsx'), fractionChips);
fs.writeFileSync(path.join(dispatchDir, 'StoneLedger.jsx'), stoneLedger);
fs.writeFileSync(path.join(dispatchDir, 'StoneMeasurementForm.jsx'), stoneForm);

console.log('State updated');
