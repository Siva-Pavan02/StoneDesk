const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components');
const dispatchDir = path.join(dir, 'dispatch');

const tracker = `import React, { useState, useEffect } from 'react';
import DispatchHeader from './dispatch/DispatchHeader';
import DispatchDetails from './dispatch/DispatchDetails';
import StoneMeasurementForm from './dispatch/StoneMeasurementForm';
import DispatchSummary from './dispatch/DispatchSummary';
import DispatchActions from './dispatch/DispatchActions';
import { calculatePiece, calculateDispatchTotals } from '../utils/dispatchCalculations';
import { getMasterSettings } from '../lib/api';

export default function DispatchTracker() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [settings, setSettings] = useState(null);
  const [truckNumber, setTruckNumber] = useState('');
  const [buyerDestination, setBuyerDestination] = useState('');
  const [stoneType, setStoneType] = useState('');
  const [finish, setFinish] = useState('');
  const [ratePerSqFt, setRatePerSqFt] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMasterSettings('unit_04');
      setSettings(data);
      if (data.stoneRates && data.stoneRates.length > 0) {
        setStoneType(data.stoneRates[0].stoneType);
        setFinish(data.stoneRates[0].finish);
        setRatePerSqFt(data.stoneRates[0].defaultRate.toString());
      }
    } catch (err) {
      setError('Unable to load dispatch configuration. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><span className="material-symbols-outlined">error</span></div>
        <p className="text-slate-700 font-medium mb-4">{error}</p>
        <button onClick={loadSettings} className="px-4 py-2 bg-teal-700 text-white rounded-lg font-semibold shadow-sm active:scale-95 transition-all">Retry</button>
      </div>
    );
  }

  const groups = pieces.map(p => ({ totalSqFt: p.sqFt, ratePerSqFt: p.ratePerSqFt }));
  const totals = calculateDispatchTotals(groups, settings?.defaultRoyaltyFee || 8500);

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
            savedTrucks={settings?.savedTrucks || []}
            savedDestinations={settings?.savedDestinations || []}
          />
          <StoneMeasurementForm
            stoneType={stoneType}
            setStoneType={setStoneType}
            finish={finish}
            setFinish={setFinish}
            length={length}
            setLength={setLength}
            width={width}
            setWidth={setWidth}
            ratePerSqFt={ratePerSqFt}
            setRatePerSqFt={setRatePerSqFt}
            onAddPiece={handleAddPiece}
            pieces={pieces}
            onRemovePiece={handleRemovePiece}
            stoneRates={settings?.stoneRates || []}
          />
          <DispatchSummary totals={totals} />
          <DispatchActions totals={totals} />
        </div>
      </main>
    </>
  );
}
`;

const dispatchDetails = `import React from 'react';

export default function DispatchDetails({ 
  truckNumber, setTruckNumber, 
  buyerDestination, setBuyerDestination,
  savedTrucks, savedDestinations 
}) {
  return (
    <>
      <section className="flex items-center justify-between py-2 px-1 mb-2"><div className="flex items-center gap-2"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-sm text-label-sm font-semibold">New Dispatch Entry</span></div><div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm"><span className="material-symbols-outlined text-[15px] text-primary">pin_drop</span><span className="font-medium">Pit-2</span><span className="text-slate-300">•</span><span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium text-[11px] leading-tight">Yerraguntla 516309</span></div></section>
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="flex items-center gap-2.5 mb-4"><div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800"><span className="material-symbols-outlined text-[20px]">local_shipping</span></div><div className="flex flex-col"><h2 className="text-base font-semibold text-slate-800 leading-tight">Logistics &amp; Transport</h2></div></div>
        
        <div className="mb-4"><div className="flex justify-between items-baseline mb-1.5"><label className="text-sm font-semibold text-slate-800" htmlFor="truckNo">Truck Number</label></div><div className="relative flex items-center">
          <input className="w-full h-12 bg-white text-slate-900 font-bold text-base tracking-wider rounded-lg px-3.5 pr-14 border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="truckNo" type="text" list="trucks-list" value={truckNumber} onChange={(e) => setTruckNumber(e.target.value)} />
          <datalist id="trucks-list">
            {savedTrucks.map(t => <option key={t} value={t} />)}
          </datalist>
          <button aria-label="Scan number plate" className="absolute right-1.5 w-10 h-10 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 active:bg-teal-700 active:text-white transition-colors" id="scanBtn" type="button"><span className="material-symbols-outlined text-[20px]">photo_camera</span></button></div></div>
        
        <div className="mb-3.5"><div className="flex justify-between items-baseline mb-1.5"><label className="text-sm font-semibold text-slate-800" htmlFor="buyerDest">Buyer Destination</label></div>
          <input className="w-full h-12 bg-white text-slate-800 font-medium text-sm rounded-lg px-3.5 border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="buyerDest" type="text" list="dests-list" value={buyerDestination} onChange={(e) => setBuyerDestination(e.target.value)} />
          <datalist id="dests-list">
            {savedDestinations.map(d => <option key={d} value={d} />)}
          </datalist>
        </div>
        
        <div className=""><span className="text-xs text-slate-500 font-medium block mb-2">Quick Select Corridor</span><div className="flex flex-wrap gap-2">
          {savedDestinations.slice(0, 4).map(d => (
            <button key={d} className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-200 active:bg-teal-50 transition-colors" onClick={() => setBuyerDestination(d)} type="button">{d}</button>
          ))}
        </div></div>
      </section>
    </>
  );
}
`;

const stoneForm = `import React from 'react';
import FractionChips from './FractionChips';
import StoneLedger from './StoneLedger';
import { calculatePiece, calculateLineTotal } from '../../utils/dispatchCalculations';

export default function StoneMeasurementForm({
  stoneType, setStoneType, finish, setFinish, length, setLength, width, setWidth,
  ratePerSqFt, setRatePerSqFt, onAddPiece, pieces, onRemovePiece, stoneRates
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

  const handleStoneChange = (e) => {
    const val = e.target.value;
    const rateItem = stoneRates.find(r => r.stoneType + ' (' + r.finish + ')' === val);
    if (rateItem) {
      setStoneType(rateItem.stoneType);
      setFinish(rateItem.finish);
      setRatePerSqFt(rateItem.defaultRate.toString());
    }
  };

  const currentSelection = stoneType && finish ? \`\${stoneType} (\${finish})\` : '';

  return (
    <>
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800"><span className="material-symbols-outlined text-[20px]">straighten</span></div><div className="flex flex-col"><h2 className="text-base font-semibold text-slate-800 leading-tight">Stone Measurement Ledger</h2></div></div><button aria-label="Reset ledger" className="w-9 h-9 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors" type="button"><span className="material-symbols-outlined text-[20px]">delete</span></button></div>
        
        <div className="mb-4"><div className="flex justify-between items-baseline mb-1.5"><label className="text-sm font-semibold text-slate-800" htmlFor="stoneType">Stone Type</label></div><div className="relative">
          <select className="w-full h-12 bg-white text-slate-800 font-medium text-sm rounded-lg px-3.5 pr-10 appearance-none border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="stoneType" value={currentSelection} onChange={handleStoneChange}>
            {stoneRates.map((r, i) => (
              <option key={i} value={\`\${r.stoneType} (\${r.finish})\`}>{r.stoneType} ({r.finish})</option>
            ))}
          </select>
          <span className="material-symbols-outlined pointer-events-none absolute right-3 top-3.5 text-slate-500 text-[20px]">expand_more</span></div></div>
        
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
    </>
  );
}
`;

const dispatchSummary = `import React from 'react';

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
`;

const dispatchActions = `import React from 'react';

export default function DispatchActions({ totals }) {
  const formatCurrency = (val) => Number(val).toLocaleString('en-IN');

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 pb-safe shadow-lg z-30">
      <div className="max-w-xl mx-auto w-full flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-700 leading-none">Total Load Value</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-slate-900 leading-none">₹{formatCurrency(totals.netBillableAmount)}</span>
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
fs.writeFileSync(path.join(dispatchDir, 'DispatchDetails.jsx'), dispatchDetails);
fs.writeFileSync(path.join(dispatchDir, 'StoneMeasurementForm.jsx'), stoneForm);
fs.writeFileSync(path.join(dispatchDir, 'DispatchSummary.jsx'), dispatchSummary);
fs.writeFileSync(path.join(dispatchDir, 'DispatchActions.jsx'), dispatchActions);

console.log('Frontend API connected.');
