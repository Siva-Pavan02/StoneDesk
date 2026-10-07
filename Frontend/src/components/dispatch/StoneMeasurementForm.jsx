import React from 'react';
import FractionChips from './FractionChips';
import StoneLedger from './StoneLedger';
import { calculatePiece, calculateLineTotal } from '../../utils/dispatchCalculations';
import { parseFraction, decimalToFraction } from '../../utils/fractionParser';
import { useLanguage } from '../../i18n/LanguageContext';

export default function StoneMeasurementForm({
  stoneType, setStoneType, finish, setFinish, length, setLength, width, setWidth,
  ratePerSqFt, setRatePerSqFt, onAddPiece, pieces, onRemovePiece, stoneRates
}) {
  const { t } = useLanguage();
  let liveSqFt = '?';
  let liveLineTotal = '?';

  const lenParsed = parseFraction(length);
  const widParsed = parseFraction(width);

  try {
    if (lenParsed && widParsed && lenParsed.numeric > 0 && widParsed.numeric > 0) {
      const p = calculatePiece(lenParsed.numeric, widParsed.numeric);
      liveSqFt = decimalToFraction(p.sqFt);
      liveLineTotal = calculateLineTotal(p.sqFt, ratePerSqFt);
    }
  } catch {
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

  const currentSelection = stoneType && finish ? `${stoneType} (${finish})` : '';

  return (
    <>
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-4">
        <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800"><span className="material-symbols-outlined text-[20px]">straighten</span></div><div className="flex flex-col"><h2 className="text-base font-semibold text-slate-800 leading-tight">{t('stoneMeasurementLedger')}</h2></div></div><button aria-label="Reset ledger" className="w-9 h-9 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors" type="button"><span className="material-symbols-outlined text-[20px]">delete</span></button></div>
        
        <div className="mb-4"><div className="flex justify-between items-baseline mb-1.5"><label className="text-sm font-semibold text-slate-800" htmlFor="stoneType">{t('stoneType')}</label></div><div className="relative">
          <select className="w-full h-12 bg-white text-slate-800 font-medium text-sm rounded-lg px-3.5 pr-10 appearance-none border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="stoneType" value={currentSelection} onChange={handleStoneChange}>
            {stoneRates.map((r, i) => (
              <option key={i} value={`${r.stoneType} (${r.finish})`}>{r.stoneType} ({r.finish})</option>
            ))}
          </select>
          <span className="material-symbols-outlined pointer-events-none absolute right-3 top-3.5 text-slate-500 text-[20px]">expand_more</span></div></div>
        
        <div className="mb-3.5">
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-800 leading-none mb-1.5 truncate" htmlFor="lengthInput">{t('length')}</label>
              <input className="w-full h-12 bg-white text-slate-900 font-bold text-base text-center rounded-lg border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="lengthInput" type="text" value={length} onChange={(e) => setLength(e.target.value)} />
              <FractionChips value={length} setValue={setLength} />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-800 leading-none mb-1.5 truncate" htmlFor="widthInput">{t('width')}</label>
              <input className="w-full h-12 bg-white text-slate-900 font-bold text-base text-center rounded-lg border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="widthInput" type="text" value={width} onChange={(e) => setWidth(e.target.value)} />
              <FractionChips value={width} setValue={setWidth} />
            </div>
          </div>
          
          <button className="w-full h-12 bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white font-semibold flex items-center justify-center gap-1.5 rounded-lg shadow-sm transition-all" onClick={onAddPiece} type="button"><span className="material-symbols-outlined text-[20px]">add</span><span>{t('addPiece')} ({liveSqFt !== '?' ? `${liveSqFt} ${t('sqFt')}` : t('invalid')})</span></button>
        </div>
        
        <StoneLedger pieces={pieces} onRemovePiece={onRemovePiece} />
        
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col"><div className="flex justify-between items-baseline mb-1.5"><label className="text-xs font-semibold text-slate-800 leading-none" htmlFor="rateInput">{t('ratePerSqFt')}</label></div><div className="relative flex items-center"><span className="absolute left-3 text-slate-500 font-bold text-sm">₹</span><input className="w-full h-12 pl-7 pr-3 bg-white text-slate-900 font-bold text-base rounded-lg border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="rateInput" type="number" value={ratePerSqFt} onChange={(e) => setRatePerSqFt(e.target.value)} /></div></div>
          <div className="flex flex-col"><div className="flex justify-between items-baseline mb-1.5"><span className="text-xs font-semibold text-slate-800 leading-none">{t('lineTotal')}</span></div><div className="h-12 bg-slate-100 border border-slate-200 flex items-center px-3.5 rounded-lg justify-end"><span className="text-base font-bold text-slate-900">₹{liveLineTotal}</span></div></div>
        </div>
      </section>
    </>
  );
}
