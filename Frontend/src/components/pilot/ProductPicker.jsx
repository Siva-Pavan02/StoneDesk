import React, { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { FieldError } from './Controls.jsx';
import Icon from './Icon.jsx';
import { money } from '../../utils/pilotDraft.js';
import { productRateSuffix } from '../../utils/productForm.js';

// Select-only combobox (WAI-ARIA APG pattern) for the product / finish list.
// Keyboard: Enter/Space/ArrowDown open; ArrowUp/Down, Home/End move; Enter/Space pick;
// Escape closes; Tab picks nothing and closes; typing letters jumps to a matching product.
// The optional "+ Add new product…" row is the last option and calls onAddProduct.
// With onRemoveProduct, each product option shows a small remove button and Delete removes
// the highlighted product (the caller confirms before deleting).
// With onEditProduct, each product option shows a small edit button and F2 edits the
// highlighted product (bare letters stay reserved for typeahead).
// actionsDisabled (a product save is in flight): the add row, edit and remove buttons, F2 and
// Delete do nothing; picking a product still works.
const ADD = '__add_product__';

const ProductPicker = forwardRef(function ProductPicker({ products, value, onSelect, onAddProduct, onEditProduct, onRemoveProduct, canAddProduct = false, actionsDisabled = false, error, label = 'Product / finish' }, ref) {
  const id = useId();
  const listId = `${id}-list`, labelId = `${id}-label`, errorId = `${id}-error`, hintId = `${id}-actions-hint`;
  const canRemove = Boolean(onRemoveProduct), canEdit = Boolean(onEditProduct);
  const hint = canEdit && canRemove ? 'Press F2 to edit or Delete to remove the highlighted product.'
    : canEdit ? 'Press F2 to edit the highlighted product.'
      : canRemove ? 'Press Delete to remove the highlighted product.' : '';
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;
  const button = useRef(null), wrap = useRef(null), list = useRef(null);
  const typed = useRef({ text: '', at: 0 });
  const options = [...products.map(p => ({ id: p.id, product: p })), ...(canAddProduct ? [{ id: ADD }] : [])];
  const selected = products.find(p => p.id === value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useImperativeHandle(ref, () => ({ focus: () => button.current?.focus() }), []);

  // Keep the highlighted option in view while moving through a long list.
  useEffect(() => {
    if (!open || active < 0) return;
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function show(index) {
    const current = options.findIndex(option => option.id === value);
    setActive(index ?? (current >= 0 ? current : 0));
    setOpen(true);
  }
  function close(refocus = true) {
    setOpen(false);
    setActive(-1);
    if (refocus) button.current?.focus();
  }
  function choose(index) {
    const option = options[index];
    if (!option || (option.id === ADD && actionsDisabled)) return;
    close(option.id !== ADD);
    if (option.id === ADD) onAddProduct?.();
    else onSelect(option.product);
  }
  // Closing first returns focus to the trigger, so the confirm dialog restores focus there.
  function remove(product) {
    close();
    onRemoveProduct(product);
  }
  // Closing returns focus to the trigger; the edit form then focuses its first field.
  function edit(product) {
    close();
    onEditProduct(product);
  }
  function typeahead(key) {
    const now = Date.now();
    typed.current = { text: (now - typed.current.at > 700 ? '' : typed.current.text) + key.toLowerCase(), at: now };
    const match = products.findIndex(p => `${p.stoneType} ${p.finish}`.toLowerCase().startsWith(typed.current.text));
    if (match < 0) return;
    if (open) setActive(match);
    else onSelect(products[match]);
  }
  function onKeyDown(event) {
    const last = options.length - 1;
    const { key } = event;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) { event.preventDefault(); show(key === 'ArrowUp' ? last : undefined); }
      else if (key.length === 1 && /\S/.test(key)) typeahead(key);
      return;
    }
    if (key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(last, index + 1)); }
    else if (key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
    else if (key === 'Home') { event.preventDefault(); setActive(0); }
    else if (key === 'End') { event.preventDefault(); setActive(last); }
    else if (key === 'Enter' || key === ' ') { event.preventDefault(); choose(active); }
    else if (key === 'F2' && canEdit && options[active]?.product) { event.preventDefault(); if (!actionsDisabled) edit(options[active].product); }
    else if (key === 'Delete' && canRemove && options[active]?.product) { event.preventDefault(); if (!actionsDisabled) remove(options[active].product); }
    else if (key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (key === 'Tab') close(false);
    else if (key.length === 1 && /\S/.test(key)) typeahead(key);
  }

  return <div className={`control-field product-picker${open ? ' is-open' : ''}`} ref={wrap} onBlur={event => { if (open && !wrap.current?.contains(event.relatedTarget)) close(false); }}>
    <span className="control-label" id={labelId}>{label}</span>
    <div className="product-picker-control">
      <button ref={button} type="button" id={`${id}-button`} name="productId" className={`product-picker-trigger${selected ? '' : ' is-empty'}`}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-labelledby={`${labelId} ${id}-button`}
        aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
        {...(error ? { 'aria-invalid': true } : {})} aria-describedby={describedBy}
        onClick={() => (open ? close() : show())} onKeyDown={onKeyDown}>
        <span className="product-picker-value">
          {selected
            ? <><span className="product-picker-name">{selected.stoneType}</span><span className="product-picker-finish">{selected.finish}</span></>
            : <span className="product-picker-placeholder">Select product</span>}
        </span>
        {selected && <span className="product-picker-rate">{money(selected.defaultRate)}<small>{productRateSuffix(selected)}</small></span>}
        <span className="product-picker-chevron" aria-hidden="true"><Icon name="down" className="h-4 w-4" /></span>
      </button>
      {open && <ul ref={list} id={listId} role="listbox" aria-labelledby={labelId} className="product-picker-list" tabIndex={-1}>
        {options.map((option, index) => {
          const isAdd = option.id === ADD, isSelected = option.id === value;
          return <li key={option.id} id={`${id}-option-${index}`} data-index={index} role="option" aria-selected={isSelected}
            aria-disabled={(isAdd && actionsDisabled) || undefined}
            className={`product-picker-option${index === active ? ' is-active' : ''}${isAdd ? ' is-add' : ''}`}
            onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={event => { if (!event.target.closest?.('.product-picker-action')) choose(index); }}>
            {isAdd
              ? <><Icon name="plus" className="h-4 w-4" /><span>Add new product…</span></>
              : <>
                <span className="product-picker-option-text"><span className="product-picker-name">{option.product.stoneType}</span><span className="product-picker-finish">{option.product.finish}</span></span>
                <span className="product-picker-rate">{money(option.product.defaultRate)}<small>{productRateSuffix(option.product)}</small></span>
                <span className="product-picker-check" aria-hidden="true">{isSelected && <Icon name="check" className="h-4 w-4" />}</span>
                {canEdit && <button type="button" className="product-picker-action product-picker-edit" tabIndex={-1} disabled={actionsDisabled} aria-label={`Edit ${option.product.stoneType} ${option.product.finish}`}
                  onMouseDown={event => event.preventDefault()} onClick={event => { event.stopPropagation(); edit(option.product); }}><Icon name="edit" className="h-4 w-4" /></button>}
                {canRemove && <button type="button" className="product-picker-action product-picker-remove" tabIndex={-1} disabled={actionsDisabled} aria-label={`Remove ${option.product.stoneType} ${option.product.finish}`}
                  onMouseDown={event => event.preventDefault()} onClick={event => { event.stopPropagation(); remove(option.product); }}><Icon name="trash" className="h-4 w-4" /></button>}
              </>}
          </li>;
        })}
        {!products.length && <li className="product-picker-empty" role="presentation">No products yet</li>}
      </ul>}
    </div>
    {hint && <span id={hintId} className="sr-only">{hint}</span>}
    <FieldError id={errorId} error={error} />
  </div>;
});

export default ProductPicker;
