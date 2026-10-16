import React from 'react';
import { parseFraction, decimalToFraction } from '../../utils/fractionParser';

// Same shape as the shared secondary button (pill, 1px border, 500 weight).
const chip = 'btn control-button control-button-secondary fraction-chip flex-1';

// `label` names the field the chips add to, so length and width chips are told apart.
export default function FractionChips({ value, setValue, label = '' }) {
  const addFraction = (fracNumeric) => {
    const parsed = parseFraction(value);
    const currentNumeric = parsed ? parsed.numeric : 0;
    const nextNumeric = currentNumeric + fracNumeric;
    setValue(decimalToFraction(nextNumeric));
  };
  return (
    <div className="flex items-center justify-between gap-1 mt-2" role="group" aria-label={label ? `Add fraction to ${label}` : undefined}>
      {[[0.25, '¼'], [0.5, '½'], [0.75, '¾']].map(([amount, glyph]) => (
        <button key={glyph} className={chip} onClick={() => addFraction(amount)} type="button"
          aria-label={label ? `Add ${glyph} to ${label}` : undefined}>+ {glyph}</button>
      ))}
    </div>
  );
}
