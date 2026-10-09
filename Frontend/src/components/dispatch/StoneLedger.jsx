import React from 'react';
import { calculateGroupSqFt } from '../../utils/dispatchCalculations';
import { decimalToFraction } from '../../utils/fractionParser';
import { useLanguage } from '../../i18n/LanguageContext';

export default function StoneLedger({ pieces, onRemovePiece }) {
  const totalVolume = calculateGroupSqFt(pieces);
  const { t } = useLanguage();
  
  return (
    <>
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3.5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Pieces Logged ({pieces.length} {t('pieces')})</span>
        </div>
        <div className="flex flex-col gap-2">
          {pieces.map((p, i) => (
            <div key={i} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-xs font-medium text-slate-800 font-mono">{(p.lengthDisplay || p.lengthFt)} × {(p.widthDisplay || p.widthFt)} = <strong className="text-slate-900 font-bold">{decimalToFraction(p.sqFt)} {t('sqFt')}</strong></span>
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
          <span className="text-xs font-bold text-teal-900 uppercase tracking-wide">{t('total')}: {pieces.length} {t('pieces')}</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-teal-700 font-medium block">{t('totalDispatchVolume')}</span>
          <span className="text-xl font-bold text-teal-900">{decimalToFraction(totalVolume)} {t('sqFt')}</span>
        </div>
      </div>
    </>
  );
}
