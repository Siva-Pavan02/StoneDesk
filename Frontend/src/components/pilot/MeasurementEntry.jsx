import React, { useId, useRef, useState } from 'react';
import { Button, Card, Field, FieldError } from './Controls.jsx';
import Icon from './Icon.jsx';
import QuickAddProduct from './QuickAddProduct.jsx';
import ProductPicker from './ProductPicker.jsx';
import { parseFraction, decimalToFraction } from '../../utils/fractionParser.js';
const MAX_ROW = 20;
// errors: per-field messages keyed by entry field. notice: a message about the
// measurements as a whole (no rows yet, or an unadded row), shown by the Add button.
// canAddProduct (Admin, Manager): the product select offers "+ Add new product…"; the new
// product is selected with its rate, then focus moves to Length.
// onRemoveProduct (Admin only): each product in the list offers a remove button; the caller confirms.
// onEditProduct(settings, product, previous) (Admin only): each product in the list offers an edit button
// that opens the edit form here; called after a successful save (previous: the product before the edit),
// then focus returns to the picker.
// Only one of the add and edit forms is open at a time.
export default function MeasurementEntry({ products, entry, onChange, onAdd, errors = {}, notice = '', canAddProduct = false, organizationId, onProductAdded, onRemoveProduct, onEditProduct }) {
  // null | { kind: 'add' } | { kind: 'edit', id }
  const [panel, setPanel] = useState(null);
  // A product save is in flight: the picker's add / edit / remove actions are locked so they
  // cannot unmount the pending form (selecting a product stays allowed).
  const [productBusy, setProductBusy] = useState(false);
  // A save that resolves after its form unmounted only applies the returned settings
  // (onProductAdded is settings-only in New load); no entry change, panel close or focus.
  const settingsOnly = data => onProductAdded?.(data);
  const productSelect = useRef(null);
  const noProducts = products.length === 0;
  const showAddForm = canAddProduct && (panel?.kind === 'add' || noProducts);
  // Derived by id: if the product is removed or replaced, the edit form closes instead of going stale.
  const editingProduct = onEditProduct && panel?.kind === 'edit' ? products.find(p => p.id === panel.id) : null;
  const selectedProduct = products.find(p => p.id === entry.productId);
  const rateUnit = selectedProduct?.rateUnit === 'UNIT' ? 'UNIT' : 'SQ_FT';
  const isUnit = rateUnit === 'UNIT';
  const rowNo = Number(entry.rowNo ?? 1) || 1;
  const update = key => e => onChange({ ...entry, [key]: e.target.value });
  const changeRow = value => onChange({ ...entry, rowNo: value, category: 'Regular' });
  const setRow = value => changeRow(String(Math.min(MAX_ROW, Math.max(1, value))));
  function fraction(key, amount) {
    onChange({ ...entry, [key]: decimalToFraction((parseFraction(entry[key])?.numeric || 0) + amount) });
  }
  // Keyboard flow: Enter moves Length → Width → Quantity → Add entry; adding a row returns to Length.
  const baseId = useId();
  const ids = { length: `${baseId}-length`, width: `${baseId}-width`, quantity: `${baseId}-quantity`, rate: `${baseId}-rate`, add: `${baseId}-add` };
  const focusField = key => document.getElementById(ids[key])?.focus();
  const enterTo = next => e => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    focusField(next);
  };
  // Quantity is selected on entry so typing replaces it instead of appending.
  const justFocused = useRef(false);
  const selectAll = e => e.target.select();
  // A click that focuses the field would otherwise drop the selection on mouseup.
  const markClickFocus = e => { justFocused.current = document.activeElement !== e.target; };
  const keepSelection = e => { if (justFocused.current) { e.preventDefault(); justFocused.current = false; } };
  function add() { if (onAdd() !== false) focusField(isUnit ? 'quantity' : 'length'); }
  // Only the product and rate change; length, width, row and placement stay as typed.
  function productSaved(data, product) {
    onProductAdded?.(data, product);
    if (product) onChange({ ...entry, productId: product.id, rate: String(product.defaultRate) });
    setPanel(null);
    requestAnimationFrame(() => focusField(product?.rateUnit === 'UNIT' ? 'quantity' : 'length'));
  }
  function cancelAdd() {
    setPanel(null);
    requestAnimationFrame(() => productSelect.current?.focus());
  }
  function productEdited(data, product, previous) {
    onEditProduct?.(data, product, previous);
    setPanel(null);
    requestAnimationFrame(() => productSelect.current?.focus());
  }
  // The product is chosen first; the measurements for it follow.
  return <Card className="gap-4">
    {noProducts && !canAddProduct ? <p className="product-hint">No products yet. Ask an Admin or Manager to add products.</p> : <ProductPicker ref={productSelect} products={products} value={entry.productId} error={errors.productId} canAddProduct={canAddProduct}
      actionsDisabled={productBusy}
      onAddProduct={() => { if (!productBusy) setPanel({ kind: 'add' }); }} onRemoveProduct={onRemoveProduct && (p => { if (!productBusy) onRemoveProduct(p); })}
      onEditProduct={onEditProduct ? p => { if (!productBusy) setPanel({ kind: 'edit', id: p.id }); } : undefined}
      onSelect={p => onChange({ ...entry, productId: p.id, rate: String(p.defaultRate ?? '') })} />}
    {!noProducts && !canAddProduct && <p className="product-hint">Ask an Admin or Manager to add products</p>}
    {showAddForm && <QuickAddProduct organizationId={organizationId} stoneRates={products} first={noProducts} onSaved={productSaved} onSettingsSaved={settingsOnly} onBusyChange={setProductBusy} onCancel={cancelAdd} />}
    {editingProduct && !showAddForm && <QuickAddProduct key={editingProduct.id} organizationId={organizationId} stoneRates={products} product={editingProduct} onSaved={productEdited} onSettingsSaved={settingsOnly} onBusyChange={setProductBusy} onCancel={cancelAdd} />}
    <h2>Measurements</h2>
    <div className="row-bar">
      <div className="row-stepper">
        <button type="button" className="row-step" aria-label="Previous row" disabled={rowNo <= 1} onClick={() => setRow(rowNo - 1)}><Icon name="prev" /></button>
        <p className="row-bar-current" aria-live="polite" aria-atomic="true"><span className="row-bar-label">Row</span><strong>{rowNo}</strong></p>
        <button type="button" className="row-step" aria-label="Next row" disabled={rowNo >= MAX_ROW} onClick={() => setRow(rowNo + 1)}><Icon name="next" /></button>
      </div>
      <span className="row-bar-placement">{entry.category === 'TOP' ? 'Top' : 'Regular'}</span>
    </div>
    <div className="control-field placement-field"><span className="control-label" id={`${baseId}-placement-label`}>Placement in row</span>
      <div className="placement-switch" role="group" aria-labelledby={`${baseId}-placement-label`}>{[['Regular', 'Regular'], ['TOP', 'Top']].map(([value, label]) => <button key={value} type="button" aria-pressed={entry.category === value} onClick={() => onChange({ ...entry, category: value })}>{label}</button>)}</div></div>
    {!isUnit && <div className="grid grid-cols-2 gap-3">
      {['length', 'width'].map(key => <div key={key} className="space-y-2"><Field label={key === 'length' ? 'Length (ft)' : 'Width (ft)'} id={ids[key]} value={entry[key]} onChange={update(key)} onKeyDown={enterTo(key === 'length' ? 'width' : 'quantity')} enterKeyHint="next" inputMode="decimal" name={key} autoComplete="off" spellCheck={false} placeholder="3½…" error={errors[key]} />
        <details className="measurement-fractions"><summary>Add fraction</summary><div className="grid grid-cols-3 gap-1">{[[.25, '¼'], [.5, '½'], [.75, '¾']].map(([amount, label]) => <button key={label} type="button" aria-label={`Add ${label} foot to ${key}`} className="btn min-w-0 px-0 text-base bg-white border-outline-variant" onClick={() => fraction(key, amount)}>+{label}</button>)}</div></details>
      </div>)}
    </div>}
    <div className="grid grid-cols-2 gap-3"><Field label="Quantity" type="number" min="1" max="100000" step="1" name="quantity" id={ids.quantity} value={entry.quantity} onChange={update('quantity')} onFocus={selectAll} onMouseDown={markClickFocus} onMouseUp={keepSelection} onKeyDown={enterTo('add')} enterKeyHint="next" error={errors.quantity} /><Field label={isUnit ? 'Rate / unit (₹)' : 'Rate / sq ft (₹)'} type="number" min="0" step="0.01" name="rate" id={ids.rate} value={entry.rate} onChange={update('rate')} onKeyDown={enterTo('add')} enterKeyHint="next" error={errors.rate} /></div>
    <FieldError role="alert" className="field-error-block" error={notice} />
    <Button primary id={ids.add} label="Add entry" onClick={add} />
  </Card>;
}
