import React, { useId, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { translatePilotMessage } from '../../i18n/pilotMessages.js';
import Icon from './Icon.jsx';
const isoToDmy = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '';
function dmyToIso(text) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return '';
  const [, d, m, y] = match;
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  return date.getUTCFullYear() === +y && date.getUTCMonth() === +m - 1 && date.getUTCDate() === +d ? `${y}-${m}-${d}` : '';
}
export function Label({ en, te }) {
  const { pick } = useLanguage();
  return <span className="control-label">{pick(en, te)}</span>;
}
export function Button({ en, te, primary = false, children, className = '', ...props }) {
  return <button type="button" {...props} className={`btn control-button ${primary ? 'control-button-primary' : 'control-button-secondary'} ${className}`}><Label en={en} te={te} />{primary && children ? <span className="action-icon-disc" aria-hidden="true">{children}</span> : children}</button>;
}
// Inline message under one input. Linked to it through aria-describedby, so a
// screen reader reads it when the invalid field gets focus.
export function FieldError({ id, error, className = '', ...props }) {
  const { language } = useLanguage();
  return error ? <p {...props} id={id} className={`field-error ${className}`}>{translatePilotMessage(error, language)}</p> : null;
}
const invalidProps = (error, errorId) => error ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};
export function Field({ en, te, children, error, ...props }) {
  const { pick } = useLanguage();
  const generatedId = useId();
  const controlId = children?.props.id || props.id || generatedId;
  const errorId = `${controlId}-error`;
  const a11y = invalidProps(error, errorId);
  const label = <label className="control-label" htmlFor={controlId}>{pick(en, te)}</label>;
  const message = <FieldError id={errorId} error={error} />;
  if (!children && props.type === 'number') return <div className="control-field">{label}<NumberStepper {...props} {...a11y} id={controlId} name={pick(en, te)} />{message}</div>;
  return <div className="control-field">{label}{children ? React.cloneElement(children, { id: controlId, ...a11y }) : <input className="input" {...props} {...a11y} id={controlId} />}{message}</div>;
}
// Number input with quiet − / + buttons instead of native spin arrows.
// Decimal fields (step < 1) still accept typed decimals but step by whole units.
function NumberStepper({ name, value, onChange, min, max, step, disabled, ...props }) {
  const { pick } = useLanguage();
  const by = Number(step) >= 1 ? Number(step) : 1;
  const lo = min === undefined ? -Infinity : Number(min);
  const hi = max === undefined ? Infinity : Number(max);
  const current = Number(value) || 0;
  const bump = dir => {
    const next = Math.min(hi, Math.max(lo, Math.round((current + dir * by) * 100) / 100));
    onChange?.({ target: { value: String(next) } });
  };
  return <div className="number-stepper">
    <button type="button" className="number-step" aria-label={pick(`Decrease ${name}`, `${name} తగ్గించండి`)} disabled={disabled || current - by < lo} onClick={() => bump(-1)}>−</button>
    <input className="input" type="number" inputMode={by === 1 && Number(step) === 1 ? 'numeric' : 'decimal'} {...props} min={min} max={max} step={step} disabled={disabled} value={value} onChange={onChange} />
    <button type="button" className="number-step" aria-label={pick(`Increase ${name}`, `${name} పెంచండి`)} disabled={disabled || current + by > hi} onClick={() => bump(1)}>+</button>
  </div>;
}
export function DateField({ en, te, value, onValue, error, ...props }) {
  const { pick } = useLanguage();
  const id = useId();
  const picker = useRef(null);
  const [text, setText] = useState(() => isoToDmy(value));
  const [synced, setSynced] = useState(value);
  if (value !== synced) { setSynced(value); setText(isoToDmy(value)); }
  function commit(iso) { setSynced(iso); onValue(iso); }
  function type(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const next = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
    setText(next);
    commit(dmyToIso(next));
  }
  function openPicker() {
    try { picker.current?.showPicker(); } catch { picker.current?.focus(); }
  }
  return <div className="control-field date-field">
    <label className="control-label" htmlFor={id}>{pick(en, te)}</label>
    <div className="combo-control">
      <input {...props} id={id} className="input" inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10} autoComplete="off" value={text} aria-invalid={error || (text.length === 10 && !dmyToIso(text)) ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={event => type(event.target.value)} />
      <button type="button" className="combo-toggle date-toggle" aria-label={pick('Choose date', 'తేదీ ఎంచుకోండి')} onClick={openPicker}><Icon name="calendar" className="h-4 w-4" /></button>
      <input ref={picker} type="date" className="date-picker-native" tabIndex={-1} aria-hidden="true" aria-label={pick(en, te)} value={value || ''} onChange={event => { setText(isoToDmy(event.target.value)); commit(event.target.value); }} />
    </div>
    <FieldError id={`${id}-error`} error={error} />
  </div>;
}
export function ComboField({ en, te, options = [], value, onValue, error, ...props }) {
  const { pick } = useLanguage();
  const id = useId(), listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef(null);
  const query = (value || '').trim().toLowerCase();
  const shown = options.filter(option => option.toLowerCase() !== query && option.toLowerCase().includes(query));
  const visible = open && shown.length > 0;
  function pickOption(option) { onValue(option); setOpen(false); setActive(-1); }
  function onKeyDown(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => Math.min(shown.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
    else if (event.key === 'Enter' && visible && active >= 0) { event.preventDefault(); pickOption(shown[active]); }
    else if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); }
  }
  return <div className="control-field combo-field" ref={wrap} onBlur={event => { if (!wrap.current?.contains(event.relatedTarget)) { setOpen(false); setActive(-1); } }}>
    <label className="control-label" htmlFor={id}>{pick(en, te)}</label>
    <div className="combo-control">
      <input {...props} {...invalidProps(error, `${id}-error`)} id={id} className="input" role="combobox" aria-expanded={visible} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={visible && active >= 0 ? `${id}-${active}` : undefined} autoComplete="off" value={value} onChange={event => { onValue(event.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} />
      {options.length > 0 && <button type="button" className="combo-toggle" tabIndex={-1} aria-label={pick('Show suggestions', 'సూచనలు చూపించు')} onMouseDown={event => event.preventDefault()} onClick={() => setOpen(!open)}><span aria-hidden="true" /></button>}
      {visible && <ul id={listId} role="listbox" className="combo-list">{shown.map((option, index) => <li key={option} id={`${id}-${index}`} role="option" aria-selected={index === active} className={index === active ? 'is-active' : undefined} onMouseDown={event => event.preventDefault()} onClick={() => pickOption(option)}>{option}</li>)}</ul>}
    </div>
    <FieldError id={`${id}-error`} error={error} />
  </div>;
}
export function Card({ children, className = '' }) {
  return <section className={`card control-card ${className}`}>{children}</section>;
}
export function ErrorMessage({ error }) {
  const { language } = useLanguage();
  return error ? <p role="alert" className="control-error">{translatePilotMessage(error, language)}</p> : null;
}
