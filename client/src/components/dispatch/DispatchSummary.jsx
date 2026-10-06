import React from 'react';
import { decimalToFraction } from '../../utils/fractionParser';
import { useLanguage } from '../../i18n/LanguageContext';

export default function DispatchSummary({ totals }) {
  const formatCurrency = (val) => Number(val).toLocaleString('en-IN');
  const { t } = useLanguage();
  
  return (
    <section className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mb-4">
      <div className="flex items-center gap-2 mb-3.5"><div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800"><span className="material-symbols-outlined text-[20px]">receipt_long</span></div><div className="flex flex-col"><h3 className="text-base font-semibold text-slate-800 leading-none">{t('dispatchSummary')}</h3></div></div>
      <div className="flex flex-col gap-2.5 py-1 border-b border-slate-100 pb-3 mb-3">
        <div className="flex justify-between items-center text-slate-600"><span className="text-xs font-medium">{t('totalDispatchVolume')}</span><span className="text-sm text-slate-900 font-bold">{decimalToFraction(totals.totalDispatchVolumeSqFt)} {t('sqFt')}</span></div>
        <div className="flex justify-between items-center text-slate-600"><span className="text-xs font-medium">{t('baseMaterialTotal')}</span><span className="text-sm text-slate-900 font-bold">₹{formatCurrency(totals.baseMaterialTotal)}</span></div>
        <div className="flex justify-between items-center text-slate-600"><span className="text-xs font-medium">{t('loadingAndRoyalty')}</span><span className="text-sm text-slate-900 font-bold">₹{formatCurrency(totals.loadingAndRoyaltyFees)}</span></div>
      </div>
      <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
        <div className="flex flex-col"><span className="text-xs font-bold text-teal-950 uppercase tracking-wide">{t('netBillableAmount')}</span><span className="text-[11px] text-teal-800 font-medium">{t('gstIncluded')}</span></div>
        <div className="text-right"><span className="text-2xl font-bold text-teal-900">₹{formatCurrency(totals.netBillableAmount)}</span></div>
      </div>
    </section>
  );
}
