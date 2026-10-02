import React from 'react';

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
