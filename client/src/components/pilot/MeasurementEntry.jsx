import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { Button, Card, Field, Label } from './Controls.jsx';
import { parseFraction, decimalToFraction } from '../../utils/fractionParser.js';
export default function MeasurementEntry({ products, entry, onChange, onAdd }) {
  const { pick } = useLanguage();
  const update = key => e => onChange({ ...entry, [key]: e.target.value });
  function fraction(key, amount) {
    onChange({ ...entry, [key]: decimalToFraction((parseFraction(entry[key])?.numeric || 0) + amount) });
  }
  return <Card className="gap-4">
    <Label en="Add measurement row" te="కొలతలు జోడించండి" />
    <Field en="Product / finish" te="రకం / ఫినిష్"><select className="input rounded-xl" value={entry.productId} onChange={e => {
      const p = products.find(item => item._id === e.target.value);
      onChange({ ...entry, productId: e.target.value, rate: String(p?.defaultRate ?? '') });
    }}><option value="">{pick('Select product', 'రకం ఎంచుకోండి')}</option>{products.map(p => <option key={p._id} value={p._id}>{p.stoneType} · {p.finish}</option>)}</select></Field>
    <Field en="Row type" te="ముక్కల రకం"><select className="input rounded-xl" value={entry.category} onChange={update('category')}><option value="Regular">{pick('Regular', 'సాధారణ')}</option><option value="TOP">{pick('TOP', 'టాప్')}</option></select></Field>
    <div className="grid grid-cols-2 gap-3">
      {['length', 'width'].map(key => <div key={key} className="space-y-2"><Field en={key === 'length' ? 'Length (ft)' : 'Width (ft)'} te={key === 'length' ? 'పొడవు' : 'వెడల్పు'} value={entry[key]} onChange={update(key)} inputMode="decimal" placeholder="3½" />
        <div className="grid grid-cols-3 gap-1">{[[.25, '¼'], [.5, '½'], [.75, '¾']].map(([amount, label]) => <button key={label} type="button" aria-label={pick(`Add ${label} foot to ${key}`, `${key === 'length' ? 'పొడవుకు' : 'వెడల్పుకు'} ${label} అడుగు జోడించండి`)} className="btn min-w-0 px-0 text-base bg-white border-gray-300" onClick={() => fraction(key, amount)}>+{label}</button>)}</div>
      </div>)}
    </div>
    <div className="grid grid-cols-2 gap-3"><Field en="Quantity" te="ముక్కల సంఖ్య" type="number" min="1" max="100000" step="1" value={entry.quantity} onChange={update('quantity')} /><Field en="Rate / sq ft (₹)" te="చదరపు అడుగు ధర" type="number" min="0" step="0.01" value={entry.rate} onChange={update('rate')} /></div>
    <Button primary en="Add row" te="వరుస జోడించండి" onClick={onAdd} />
  </Card>;
}
