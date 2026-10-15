import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { parseFraction, decimalToFraction } from '../../utils/fractionParser';

const chip = 'flex-1 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-800 shadow-sm text-xs font-bold active:bg-teal-50 transition-colors touch-manipulation';

// `label` names the field the chips add to, so length and width chips are told apart.
export default function FractionChips({ value, setValue, label = '' }) {
  const { pick } = useLanguage();
  const addFraction = (fracNumeric) => {
    const parsed = parseFraction(value);
    const currentNumeric = parsed ? parsed.numeric : 0;
    const nextNumeric = currentNumeric + fracNumeric;
    setValue(decimalToFraction(nextNumeric));
  };
  return (
    <div className="flex items-center justify-between gap-1 mt-2" role="group" aria-label={label ? pick(`Add fraction to ${label}`, `${label}కు భిన్నం జోడించండి`) : undefined}>
      {[[0.25, '¼'], [0.5, '½'], [0.75, '¾']].map(([amount, glyph]) => (
        <button key={glyph} className={chip} onClick={() => addFraction(amount)} type="button"
          aria-label={label ? pick(`Add ${glyph} to ${label}`, `${label}కు ${glyph} జోడించండి`) : undefined}>+ {glyph}</button>
      ))}
    </div>
  );
}
