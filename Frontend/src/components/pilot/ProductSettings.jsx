import React, { useRef, useState } from 'react';
import { request, settingsPath } from '../../lib/pilotApi.js';
import { Button, Field, ErrorMessage } from './Controls.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { money } from '../../utils/pilotDraft.js';
const empty = { stoneType: '', finish: '', defaultRate: '' };
// Products & rates list and form, shown in Settings. canEdit=false (Manager) keeps the add form but hides Edit/Remove.
export default function ProductSettings({ settings, onChanged, user, canEdit = true }) {
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null);
  const formRef = useRef(null);
  const orgPath = settingsPath(user.organizationId);
  async function save(e) {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const data = await request(`${orgPath}/stone-rates${editId ? `/${editId}` : ''}`, { method: editId ? 'PUT' : 'POST', body: { ...form, defaultRate: Number(form.defaultRate) } });
      onChanged(data); setForm(empty); setEditId(null);
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
    <form ref={formRef} onSubmit={save} className="st-card product-form">
      <Field label="Tile / stone name" required maxLength={120} value={form.stoneType} onChange={e => setForm({ ...form, stoneType: e.target.value })} />
      <Field label="Finish" required maxLength={120} placeholder="e.g. Polished" value={form.finish} onChange={e => setForm({ ...form, finish: e.target.value })} />
      <Field label="Rate per sq ft (₹)" required type="number" min="0" step="0.01" value={form.defaultRate} onChange={e => setForm({ ...form, defaultRate: e.target.value })} />
      <div className="action-row product-form-actions">
        <Button type="submit" primary disabled={busy} label={editId ? 'Update product' : 'Add product'} />
        {editId && <Button label="Cancel edit" disabled={busy} onClick={() => { setEditId(null); setForm(empty); }} />}
      </div>
    </form>
    {!settings.stoneRates.length && <p className="st-muted">Add at least one product to start your first load.</p>}
    {settings.stoneRates.length > 0 && <ul className="st-card st-rows product-list">
      {settings.stoneRates.map(p => <li key={p.id} className="st-row product-record">
        <div className="product-main"><h3 className="product-name">{p.stoneType}</h3><p className="product-finish">{p.finish}</p></div>
        <p className="product-rate"><span>{money(p.defaultRate)}</span><span className="product-unit">/ sq ft</span></p>
        {canEdit && <div className="product-actions"><Button variant="ghost" disabled={busy} label="Edit" onClick={() => { setForm({ ...p, defaultRate: String(p.defaultRate) }); setEditId(p.id); formRef.current?.scrollIntoView({ block: 'start' }); }} /><Button variant="danger-quiet" disabled={busy} label="Remove" onClick={() => setConfirmRemove(p)} /></div>}
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
