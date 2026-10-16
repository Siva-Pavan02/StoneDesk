import React, { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';
const isoToDmy = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '';
function dmyToIso(text) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return '';
  const [, d, m, y] = match;
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  return date.getUTCFullYear() === +y && date.getUTCMonth() === +m - 1 && date.getUTCDate() === +d ? `${y}-${m}-${d}` : '';
}
export function Label({ label }) {
  return <span className="control-label">{label}</span>;
}
// The app's only button set. `variant`: primary | secondary (default) | ghost | danger | danger-quiet.
// `primary` is kept as shorthand for variant="primary".
const BUTTON_VARIANTS = new Set(['primary', 'secondary', 'ghost', 'danger', 'danger-quiet']);
export function Button({ label, primary = false, variant, children, className = '', ...props }) {
  const kind = BUTTON_VARIANTS.has(variant) ? variant : primary ? 'primary' : 'secondary';
  return <button type="button" {...props} className={`btn control-button control-button-${kind} ${className}`.trim()}><Label label={label} />{kind === 'primary' && children ? <span className="action-icon-disc" aria-hidden="true">{children}</span> : children}</button>;
}
// The app's only back control: arrow + label, placed first in the screen heading.
export function BackButton({ label = 'Back', className = '', ...props }) {
  return <button type="button" {...props} className={`back-button ${className}`.trim()}><Icon name="back" />{label}</button>;
}
// Inline message under one input. Linked to it through aria-describedby, so a
// screen reader reads it when the invalid field gets focus.
export function FieldError({ id, error, className = '', ...props }) {
  return error ? <p {...props} id={id} className={`field-error ${className}`}>{error}</p> : null;
}
const invalidProps = (error, errorId) => error ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};
// `multiline` renders a <textarea> (Enter inserts a newline) wired like <input>.
// `helper` is a hint shown under the control and read via aria-describedby.
export function Field({ label, children, error, helper, multiline = false, ...props }) {
  const generatedId = useId();
  const controlId = children?.props.id || props.id || generatedId;
  const errorId = `${controlId}-error`;
  const helperId = `${controlId}-helper`;
  const describedBy = [helper && helperId, error && errorId].filter(Boolean).join(' ');
  const a11y = { ...invalidProps(error, errorId), ...(describedBy ? { 'aria-describedby': describedBy } : {}) };
  const labelEl = <label className="control-label" htmlFor={controlId}>{label}</label>;
  const message = <>{helper ? <p id={helperId} className="field-helper">{helper}</p> : null}<FieldError id={errorId} error={error} /></>;
  if (!children && props.type === 'number') return <div className="control-field">{labelEl}<NumberStepper {...props} {...a11y} id={controlId} label={label} />{message}</div>;
  if (!children && multiline) return <div className="control-field">{labelEl}<textarea className="input input-multiline" {...props} {...a11y} id={controlId} />{message}</div>;
  return <div className="control-field">{labelEl}{children ? React.cloneElement(children, { id: controlId, ...a11y }) : <input className="input" {...props} {...a11y} id={controlId} />}{message}</div>;
}
// Number input with quiet − / + buttons instead of native spin arrows.
// Decimal fields (step < 1) still accept typed decimals but step by whole units.
function NumberStepper({ label, value, onChange, min, max, step, disabled, ...props }) {
  const by = Number(step) >= 1 ? Number(step) : 1;
  const lo = min === undefined ? -Infinity : Number(min);
  const hi = max === undefined ? Infinity : Number(max);
  const current = Number(value) || 0;
  const bump = dir => {
    const next = Math.min(hi, Math.max(lo, Math.round((current + dir * by) * 100) / 100));
    onChange?.({ target: { value: String(next) } });
  };
  return <div className="number-stepper">
    <button type="button" className="number-step" aria-label={`Decrease ${label}`} disabled={disabled || current - by < lo} onClick={() => bump(-1)}>−</button>
    <input className="input" type="number" inputMode={by === 1 && Number(step) === 1 ? 'numeric' : 'decimal'} autoComplete="off" {...props} min={min} max={max} step={step} disabled={disabled} value={value} onChange={onChange} />
    <button type="button" className="number-step" aria-label={`Increase ${label}`} disabled={disabled || current + by > hi} onClick={() => bump(1)}>+</button>
  </div>;
}
export function DateField({ label, value, onValue, error, ...props }) {
  const id = useId();
  const picker = useRef(null);
  const [text, setText] = useState(() => isoToDmy(value));
  const [synced, setSynced] = useState(value);
  if (value !== synced) { setSynced(value); setText(isoToDmy(value)); }
  // A complete but impossible date (31/02/2025) explains itself even before submit.
  const shownError = error || (text.length === 10 && !dmyToIso(text) ? 'Enter a valid date (dd/mm/yyyy)' : '');
  function commit(iso) { setSynced(iso); onValue(iso); }
  function type(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const next = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
    setText(next);
    commit(dmyToIso(next));
  }
  function openPicker() {
    try { picker.current?.showPicker(); } catch { document.getElementById(id)?.focus(); }
  }
  return <div className="control-field date-field">
    <label className="control-label" htmlFor={id}>{label}</label>
    <div className="combo-control">
      <input {...props} id={id} className="input" inputMode="numeric" placeholder="dd/mm/yyyy…" maxLength={10} autoComplete="off" value={text} aria-invalid={shownError ? true : undefined} aria-describedby={shownError ? `${id}-error` : undefined} onChange={event => type(event.target.value)} />
      <button type="button" className="combo-toggle date-toggle" aria-label="Choose date" onClick={openPicker}><Icon name="calendar" className="h-4 w-4" /></button>
      <input ref={picker} type="date" className="date-picker-native" tabIndex={-1} aria-hidden="true" aria-label={label} value={value || ''} onChange={event => { setText(isoToDmy(event.target.value)); commit(event.target.value); }} />
    </div>
    <FieldError id={`${id}-error`} error={shownError} />
  </div>;
}
// onRemoveOption(value) (optional) adds a × button to each option where isRemovable(value) is true, and
// Delete on the highlighted option removes it. The input keeps focus and nothing is selected. It may
// return a promise; resolving to false (failed removal) skips the "Removed" announcement.
export function ComboField({ label, options = [], value, onValue, error, onRemoveOption, isRemovable = () => true, ...props }) {
  const id = useId(), listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [announcement, setAnnouncement] = useState('');
  const wrap = useRef(null);
  const query = (value || '').trim().toLowerCase();
  const shown = options.filter(option => option.toLowerCase() !== query && option.toLowerCase().includes(query));
  const visible = open && shown.length > 0;
  const removable = option => Boolean(onRemoveOption) && isRemovable(option);
  // Keep the keyboard-highlighted option visible inside the scrolling list.
  useEffect(() => { if (visible && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [visible, active, id]);
  function pickOption(option) { onValue(option); setOpen(false); setActive(-1); }
  function remove(option) {
    const index = shown.indexOf(option), last = shown.length - 2;
    setOpen(true);
    Promise.resolve(onRemoveOption(option)).then(ok => {
      if (ok === false) return;
      setAnnouncement(`Removed ${option} from suggestions`);
      // The list is one shorter now: keep the highlight on a real option.
      setActive(current => Math.min(index >= 0 && index < current ? current - 1 : current, last));
    });
  }
  function onKeyDown(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => Math.min(shown.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
    else if (event.key === 'Enter' && visible && active >= 0) { event.preventDefault(); pickOption(shown[active]); }
    else if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); }
    else if (event.key === 'Delete' && visible && active >= 0 && removable(shown[active])) { event.preventDefault(); remove(shown[active]); }
  }
  const hintId = `${id}-remove-hint`;
  const describedBy = onRemoveOption ? { 'aria-describedby': [error && `${id}-error`, hintId].filter(Boolean).join(' ') } : {};
  return <div className="control-field combo-field" ref={wrap} onBlur={event => { if (!wrap.current?.contains(event.relatedTarget)) { setOpen(false); setActive(-1); } }}>
    <label className="control-label" htmlFor={id}>{label}</label>
    <div className="combo-control">
      <input {...props} {...invalidProps(error, `${id}-error`)} {...describedBy} id={id} className="input" role="combobox" aria-expanded={visible} aria-controls={visible ? listId : undefined} aria-autocomplete="list" aria-activedescendant={visible && active >= 0 ? `${id}-${active}` : undefined} autoComplete="off" value={value} onChange={event => { onValue(event.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} />
      {options.length > 0 && <button type="button" className="combo-toggle" tabIndex={-1} aria-label="Show suggestions" onMouseDown={event => event.preventDefault()} onClick={() => setOpen(!open)}><span aria-hidden="true" /></button>}
      {visible && <ul id={listId} role="listbox" className="combo-list">{shown.map((option, index) => {
        const canRemove = removable(option);
        const className = [index === active && 'is-active', canRemove && 'has-remove'].filter(Boolean).join(' ') || undefined;
        return <li key={option} id={`${id}-${index}`} role="option" aria-selected={index === active} className={className} onMouseDown={event => event.preventDefault()} onClick={() => pickOption(option)}>{canRemove ? <>
          <span className="combo-option-text">{option}</span>
          <button type="button" className="combo-remove" tabIndex={-1} aria-hidden="true" aria-label={`Remove ${option} from suggestions`} onMouseDown={event => event.preventDefault()} onClick={event => { event.stopPropagation(); remove(option); }}><Icon name="close" className="h-4 w-4" /></button>
        </> : option}</li>;
      })}</ul>}
    </div>
    {onRemoveOption && <>
      <span id={hintId} className="sr-only">Press Delete to remove the highlighted suggestion.</span>
      <span className="sr-only" role="status">{announcement}</span>
    </>}
    <FieldError id={`${id}-error`} error={error} />
  </div>;
}
export function Card({ children, className = '' }) {
  return <section className={`card control-card ${className}`}>{children}</section>;
}
export function ErrorMessage({ error }) {
  return error ? <p role="alert" className="control-error">{error}</p> : null;
}
