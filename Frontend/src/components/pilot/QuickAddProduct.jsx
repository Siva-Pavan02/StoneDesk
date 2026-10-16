import React, { useEffect, useId, useRef, useState } from 'react';
import { request, settingsPath } from '../../lib/pilotApi.js';
import { updateStoneRate } from '../../lib/api.js';
import { Button, Field, ErrorMessage } from './Controls.jsx';
import { productFormErrors, productPayload } from '../../utils/productForm.js';
const empty = { stoneType: '', finish: '', defaultRate: '' };
// Compact add / edit product form shown inside the Measurements card of New load.
// Add (Admin and Manager): POSTs a new product. first: the organization has no products yet,
// so the form cannot be cancelled.
// Edit (Admin, product given): prefilled with the product and saved with updateStoneRate; the
// duplicate check skips the product itself.
// onSaved(settings, product, previous) gets the settings returned by the request (previous: the
// product as it was before an edit); settings are never refetched.
// If the form unmounts while a save is in flight, the late response skips onSaved and all UI side
// effects (panel close, focus, errors) and only calls onSettingsSaved(settings): the server did save.
// onBusyChange(busy) reports a save in flight (false again on unmount) so the caller can lock
// actions that would unmount the form.
export default function QuickAddProduct({ organizationId, stoneRates = [], first = false, product: editProduct, onSaved, onSettingsSaved, onBusyChange, onCancel }) {
  const editing = Boolean(editProduct);
  const [form, setForm] = useState(() => editing
    ? { stoneType: editProduct.stoneType ?? '', finish: editProduct.finish ?? '', defaultRate: String(editProduct.defaultRate ?? '') }
    : empty);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const formRef = useRef(null);
  const titleId = useId();
  // The request is async: call the latest onSaved so it sees the latest New load entry.
  const savedRef = useRef(onSaved);
  const settingsRef = useRef(onSettingsSaved);
  const busyRef = useRef(onBusyChange);
  useEffect(() => { savedRef.current = onSaved; settingsRef.current = onSettingsSaved; busyRef.current = onBusyChange; });
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; busyRef.current?.(false); };
  }, []);
  useEffect(() => { if (mounted.current) busyRef.current?.(busy); }, [busy]);
  // Focus only when the user opened the form; the first-product form renders on its own (e.g. on mobile open).
  const autoFocus = useRef(!first);
  useEffect(() => { if (autoFocus.current) formRef.current?.querySelector('input')?.focus(); }, []);
  const focusFirstInvalid = () => requestAnimationFrame(() => { if (mounted.current) formRef.current?.querySelector('[aria-invalid="true"]')?.focus(); });
  const change = key => e => {
    setForm(current => ({ ...current, [key]: e.target.value }));
    if (errors[key]) setErrors(({ [key]: _cleared, ...rest }) => rest);
  };
  async function submit(e) {
    e.preventDefault();
    e.stopPropagation();
    if (lock.current) return;
    const found = productFormErrors(form, stoneRates, editProduct?.id);
    setErrors(found);
    setError('');
    if (Object.keys(found).length) { focusFirstInvalid(); return; }
    lock.current = true;
    setBusy(true);
    const body = productPayload(form);
    try {
      if (editing) {
        const data = await updateStoneRate(organizationId, editProduct.id, body);
        if (!mounted.current) { settingsRef.current?.(data); return; }
        savedRef.current?.(data, (data?.stoneRates || []).find(p => p.id === editProduct.id), editProduct);
      } else {
        const data = await request(`${settingsPath(organizationId)}/stone-rates`, { method: 'POST', body });
        if (!mounted.current) { settingsRef.current?.(data); return; }
        const product = (data?.stoneRates || []).find(p => String(p.stoneType).trim() === body.stoneType && String(p.finish).trim() === body.finish);
        savedRef.current?.(data, product);
      }
    } catch (err) {
      if (!mounted.current) return;
      if (err.status === 409) { setErrors({ stoneType: 'This product and finish are already saved.' }); focusFirstInvalid(); }
      else if (err.status === 403) setError(editing ? 'Only an Admin can edit products.' : 'Only an Admin or Manager can add products.');
      else if (editing && err.status === 404) setError('This product was already removed.');
      else setError(err.message);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function onKeyDown(e) {
    if (e.key !== 'Escape' || first || busy) return;
    e.preventDefault();
    e.stopPropagation();
    onCancel?.();
  }
  const title = editing ? 'Edit product' : first ? 'Add your first product' : 'New product';
  return <form ref={formRef} noValidate className="quick-product" aria-labelledby={titleId} onSubmit={submit} onKeyDown={onKeyDown}>
    <h3 id={titleId}>{title}</h3>
    <ErrorMessage error={error} />
    <div className="quick-product-fields">
      <Field label="Tile / stone name" name="stoneType" required maxLength={120} autoComplete="off" value={form.stoneType} onChange={change('stoneType')} error={errors.stoneType} />
      <Field label="Finish" name="finish" required maxLength={120} autoComplete="off" placeholder="e.g. Polished" value={form.finish} onChange={change('finish')} error={errors.finish} />
      <Field label="Rate per sq ft (₹)" name="defaultRate" required type="number" min="0" step="0.01" value={form.defaultRate} onChange={change('defaultRate')} error={errors.defaultRate} />
    </div>
    <div className="quick-product-actions">
      <Button type="submit" primary disabled={busy} label={busy ? 'Saving…' : editing ? 'Save changes' : 'Save product'} />
      {(editing || !first) && <Button label="Cancel" disabled={busy} onClick={onCancel} />}
    </div>
  </form>;
}
