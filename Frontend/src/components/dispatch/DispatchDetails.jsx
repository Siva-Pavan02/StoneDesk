import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

export default function DispatchDetails({ 
  truckNumber, setTruckNumber, 
  buyerDestination, setBuyerDestination,
  savedTrucks, savedDestinations 
}) {
  const { t } = useLanguage();
  return (
    <>
      <section className="flex items-center justify-between py-2 px-1 mb-2"><div className="flex items-center gap-2"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-sm text-label-sm font-semibold">{t('newDispatchEntry')}</span></div><div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm"><span className="material-symbols-outlined text-[15px] text-primary">pin_drop</span><span className="font-medium">Pit-2</span><span className="text-slate-300">•</span><span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium text-[11px] leading-tight">Yerraguntla 516309</span></div></section>
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-4">
        <div className="flex items-center gap-2.5 mb-4"><div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800"><span className="material-symbols-outlined text-[20px]">local_shipping</span></div><div className="flex flex-col"><h2 className="text-base font-semibold text-slate-800 leading-tight">{t('logisticsTransport')}</h2></div></div>
        
        <div className="mb-4"><div className="flex justify-between items-baseline mb-1.5"><label className="text-sm font-semibold text-slate-800" htmlFor="truckNo">{t('truckNumber')}</label></div><div className="relative flex items-center">
          <input className="w-full h-12 bg-white text-slate-900 font-bold text-base tracking-wider rounded-lg px-3.5 pr-14 border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="truckNo" type="text" list="trucks-list" value={truckNumber} onChange={(e) => setTruckNumber(e.target.value)} />
          <datalist id="trucks-list">
            {savedTrucks.map(t => <option key={t} value={t} />)}
          </datalist>
          <button aria-label="Scan number plate" className="absolute right-1.5 w-10 h-10 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 active:bg-teal-700 active:text-white transition-colors" id="scanBtn" type="button"><span className="material-symbols-outlined text-[20px]">photo_camera</span></button></div></div>
        
        <div className="mb-3.5"><div className="flex justify-between items-baseline mb-1.5"><label className="text-sm font-semibold text-slate-800" htmlFor="buyerDest">{t('destination')}</label></div>
          <input className="w-full h-12 bg-white text-slate-800 font-medium text-sm rounded-lg px-3.5 border-2 border-slate-300 focus:border-teal-700 focus:outline-none transition-colors" id="buyerDest" type="text" list="dests-list" value={buyerDestination} onChange={(e) => setBuyerDestination(e.target.value)} />
          <datalist id="dests-list">
            {savedDestinations.map(d => <option key={d} value={d} />)}
          </datalist>
        </div>
        
        <div className="">
          <span className="text-xs text-slate-500 font-medium block mb-2">{t('quickSelectCorridor')}</span>
          <div className="flex flex-wrap gap-2">
            {savedDestinations.length > 0 ? (
              savedDestinations.slice(0, 4).map(d => (
                <button key={d} className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-200 active:bg-teal-50 transition-colors" onClick={() => setBuyerDestination(d)} type="button">{d}</button>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">{t('noRecentRoutes')}</span>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
