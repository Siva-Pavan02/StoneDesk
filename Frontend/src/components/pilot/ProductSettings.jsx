import React, { useRef, useState } from 'react';
import { request, settingsPath } from '../../lib/pilotApi.js';
import { Button, Field, ErrorMessage } from './Controls.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { money } from '../../utils/pilotDraft.js';
import { productFormErrors, productPayload, productRateSuffix } from '../../utils/productForm.js';
const empty = { stoneType: '', finish: '', defaultRate: '', rateUnit: 'SQ_FT' };
// Products & rates list and form, shown in Settings. canEdit=false (Manager) keeps the add form but hides Edit/Remove.
export default function ProductSettings({ settings, onChanged, user, canEdit = true }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null);
  const formRef = useRef(null);
  const orgPath = settingsPath(user.organizationId);
  async function save(e) {
    e.preventDefault(); if (busy) return;
    const found = productFormErrors(form, settings.stoneRates, editId);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true); setError('');
    try {
      const body = productPayload(form);
      const data = await request(`${orgPath}/stone-rates${editId ? `/${editId}` : ''}`, { method: editId ? 'PUT' : 'POST', body });
      onChanged(data); setForm(empty); setErrors({}); setEditId(null);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function remove(product) {
    setConfirmRemove(null);
    if (busy) return;
    setBusy(true); setError('');
    try { onChanged(await request(`${orgPath}/stone-rates/${product.id}`, { method: 'DELETE' })); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="product-settings">
    <ErrorMessage error={error} />
    <form ref={formRef} onSubmit={save} className="st-card product-form" noValidate>
      <Field label="Tile / stone name" required maxLength={120} value={form.stoneType} onChange={e => { setForm({ ...form, stoneType: e.target.value }); if (errors.stoneType) setErrors(errs => ({ ...errs, stoneType: undefined })); }} error={errors.stoneType} />
      <Field label={form.rateUnit === 'UNIT' ? 'Variant / finish (optional)' : 'Finish'} required={form.rateUnit !== 'UNIT'} maxLength={120} placeholder="e.g. Polished" value={form.finish} onChange={e => { setForm({ ...form, finish: e.target.value }); if (errors.finish) setErrors(errs => ({ ...errs, finish: undefined })); }} error={errors.finish} />
      <div className="control-field product-rate-unit">
        <span className="control-label">Rate unit</span>
        <div className="placement-switch" role="group" aria-label="Rate unit">
          {[
            ['SQ_FT', 'Per sq ft'],
            ['UNIT', 'Per unit'],
          ].map(([unit, label]) => (
            <button
              key={unit}
              type="button"
              aria-pressed={form.rateUnit === unit}
              onClick={() => {
                setForm(current => ({ ...current, rateUnit: unit }));
                if (errors.rateUnit) setErrors(errs => ({ ...errs, rateUnit: undefined }));
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Field label={form.rateUnit === 'UNIT' ? 'Rate per unit (₹)' : 'Rate per sq ft (₹)'} required type="number" min="0" step="0.01" value={form.defaultRate} onChange={e => { setForm({ ...form, defaultRate: e.target.value }); if (errors.defaultRate) setErrors(errs => ({ ...errs, defaultRate: undefined })); }} error={errors.defaultRate} />
      <div className="action-row product-form-actions">
        <Button type="submit" primary disabled={busy} label={editId ? 'Update product' : 'Add product'} />
        {editId && <Button label="Cancel edit" disabled={busy} onClick={() => { setEditId(null); setForm(empty); setErrors({}); }} />}
      </div>
    </form>
    {!settings.stoneRates.length && <p className="st-muted">Add at least one product to start your first load.</p>}
    {settings.stoneRates.length > 0 && <ul className="st-card st-rows product-list">
      {settings.stoneRates.map(p => <li key={p.id} className="st-row product-record">
        <div className="product-main"><h3 className="product-name">{p.stoneType}</h3><p className="product-finish">{p.finish}</p></div>
        <p className="product-rate"><span>{money(p.defaultRate)}</span><span className="product-unit">{productRateSuffix(p)}</span></p>
        {canEdit && <div className="product-actions"><Button variant="ghost" disabled={busy} label="Edit" onClick={() => { setForm({ ...p, defaultRate: String(p.defaultRate), rateUnit: p.rateUnit ?? 'SQ_FT' }); setEditId(p.id); setErrors({}); formRef.current?.scrollIntoView({ block: 'start' }); }} /><Button variant="danger-quiet" disabled={busy} label="Remove" onClick={() => setConfirmRemove(p)} /></div>}
      </li>)}
    </ul>}
    <ConfirmDialog
      open={!!confirmRemove}
      title={confirmRemove ? `Remove ${confirmRemove.stoneType} (${confirmRemove.finish})?` : ''}
      message="Saved bills keep their rates."
      cancelLabel="Keep product"
      confirmLabel="Remove product"
      onCancel={() => setConfirmRemove(null)}
      onConfirm={() => confirmRemove && remove(confirmRemove)}
    />
  </div>;
}
