import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { Button, Card, Field } from './Controls.jsx';
import Icon from './Icon.jsx';
import { parseFraction, decimalToFraction } from '../../utils/fractionParser.js';
const MAX_ROW = 15;
export default function MeasurementEntry({ products, entry, onChange, onAdd }) {
  const { pick } = useLanguage();
  const rowNo = Number(entry.rowNo ?? 1) || 1;
  const update = key => e => onChange({ ...entry, [key]: e.target.value });
  const changeRow = value => onChange({ ...entry, rowNo: value, category: 'Regular' });
  const setRow = value => changeRow(String(Math.min(MAX_ROW, Math.max(1, value))));
  function fraction(key, amount) {
    onChange({ ...entry, [key]: decimalToFraction((parseFraction(entry[key])?.numeric || 0) + amount) });
  }
  function add() { onAdd(); }
  return <Card className="gap-4">
    <h2>{pick('Measurements', 'కొలతలు')}</h2>
    <div className="row-bar">
      <div className="row-stepper">
        <button type="button" className="row-step" aria-label={pick('Previous row', 'ముందు వరుస')} disabled={rowNo <= 1} onClick={() => setRow(rowNo - 1)}><Icon name="prev" /></button>
        <p className="row-bar-current"><span className="row-bar-label">{pick('Row', 'వరుస')}</span><strong>{rowNo}</strong></p>
        <button type="button" className="row-step" aria-label={pick('Next row', 'తర్వాత వరుస')} disabled={rowNo >= MAX_ROW} onClick={() => setRow(rowNo + 1)}><Icon name="next" /></button>
      </div>
      <span className="row-bar-placement">{entry.category === 'TOP' ? pick('Top', 'టాప్') : pick('Regular', 'సాధారణ')}</span>
    </div>
    <Field en="Product / finish" te="రకం / ఫినిష్"><select className="input rounded-xl" value={entry.productId} onChange={e => {
      const p = products.find(item => item.id === e.target.value);
      onChange({ ...entry, productId: e.target.value, rate: String(p?.defaultRate ?? '') });
    }}><option value="">{pick('Select product', 'రకం ఎంచుకోండి')}</option>{products.map(p => <option key={p.id} value={p.id}>{p.stoneType} · {p.finish}</option>)}</select></Field>
    <div className="control-field placement-field"><span className="control-label" id="placement-label">{pick('Placement in row', 'వరుసలో స్థానం')}</span>
      <div className="placement-switch" role="group" aria-labelledby="placement-label">{[['Regular', 'Regular', 'సాధారణ'], ['TOP', 'Top', 'టాప్']].map(([value, en, te]) => <button key={value} type="button" aria-pressed={entry.category === value} onClick={() => onChange({ ...entry, category: value })}>{pick(en, te)}</button>)}</div></div>
    <div className="grid grid-cols-2 gap-3">
      {['length', 'width'].map(key => <div key={key} className="space-y-2"><Field en={key === 'length' ? 'Length (ft)' : 'Width (ft)'} te={key === 'length' ? 'పొడవు' : 'వెడల్పు'} value={entry[key]} onChange={update(key)} inputMode="decimal" placeholder="3½" />
        <details className="measurement-fractions"><summary>{pick('Add fraction', 'భిన్నం జోడించండి')}</summary><div className="grid grid-cols-3 gap-1">{[[.25, '¼'], [.5, '½'], [.75, '¾']].map(([amount, label]) => <button key={label} type="button" aria-label={pick(`Add ${label} foot to ${key}`, `${key === 'length' ? 'పొడవుకు' : 'వెడల్పుకు'} ${label} అడుగు జోడించండి`)} className="btn min-w-0 px-0 text-base bg-white border-gray-300" onClick={() => fraction(key, amount)}>+{label}</button>)}</div></details>
      </div>)}
    </div>
    <div className="grid grid-cols-2 gap-3"><Field en="Quantity" te="ముక్కల సంఖ్య" type="number" min="1" max="100000" step="1" value={entry.quantity} onChange={update('quantity')} /><Field en="Rate / sq ft (₹)" te="చదరపు అడుగు ధర" type="number" min="0" step="0.01" value={entry.rate} onChange={update('rate')} /></div>
    <Button primary en="Add entry" te="కొలత జోడించండి" onClick={add} />
  </Card>;
}
