import React from 'react';
import { parseFraction, decimalToFraction } from '../../utils/fractionParser';

export default function FractionChips({ value, setValue }) {
  const addFraction = (fracNumeric) => {
    const parsed = parseFraction(value);
    const currentNumeric = parsed ? parsed.numeric : 0;
    const nextNumeric = currentNumeric + fracNumeric;
    setValue(decimalToFraction(nextNumeric));
  };
  return (
    <div className="flex items-center justify-between gap-1 mt-2">
      <button className="flex-1 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-800 shadow-sm text-xs font-bold active:bg-teal-50 transition-colors" onClick={() => addFraction(0.25)} type="button">+ ¼</button>
      <button className="flex-1 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-800 shadow-sm text-xs font-bold active:bg-teal-50 transition-colors" onClick={() => addFraction(0.5)} type="button">+ ½</button>
      <button className="flex-1 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-800 shadow-sm text-xs font-bold active:bg-teal-50 transition-colors" onClick={() => addFraction(0.75)} type="button">+ ¾</button>
    </div>
  );
}
