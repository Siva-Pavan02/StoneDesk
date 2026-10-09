import React, { useId, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { translatePilotMessage } from '../../i18n/pilotMessages.js';
export function Label({ en, te }) {
  const { pick } = useLanguage();
  return <span className="control-label">{pick(en, te)}</span>;
}
export function Button({ en, te, primary = false, children, className = '', ...props }) {
  return <button type="button" {...props} className={`btn control-button ${primary ? 'control-button-primary' : 'control-button-secondary'} ${className}`}><Label en={en} te={te} />{primary && children ? <span className="action-icon-disc" aria-hidden="true">{children}</span> : children}</button>;
}
export function Field({ en, te, children, ...props }) {
  const { pick } = useLanguage();
  const generatedId = useId();
  const controlId = children?.props.id || props.id || generatedId;
  return <div className="control-field"><label className="control-label" htmlFor={controlId}>{pick(en, te)}</label>{children ? React.cloneElement(children, { id: controlId }) : <input className="input" {...props} id={controlId} />}</div>;
}
export function ComboField({ en, te, options = [], value, onValue, ...props }) {
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
      <input {...props} id={id} className="input" role="combobox" aria-expanded={visible} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={visible && active >= 0 ? `${id}-${active}` : undefined} autoComplete="off" value={value} onChange={event => { onValue(event.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} />
      {options.length > 0 && <button type="button" className="combo-toggle" tabIndex={-1} aria-label={pick('Show suggestions', 'సూచనలు చూపించు')} onMouseDown={event => event.preventDefault()} onClick={() => setOpen(!open)}><span aria-hidden="true" /></button>}
      {visible && <ul id={listId} role="listbox" className="combo-list">{shown.map((option, index) => <li key={option} id={`${id}-${index}`} role="option" aria-selected={index === active} className={index === active ? 'is-active' : undefined} onMouseDown={event => event.preventDefault()} onClick={() => pickOption(option)}>{option}</li>)}</ul>}
    </div>
  </div>;
}
export function Card({ children, className = '' }) {
  return <section className={`card control-card ${className}`}>{children}</section>;
}
export function ErrorMessage({ error }) {
  const { language } = useLanguage();
  return error ? <p role="alert" className="control-error">{translatePilotMessage(error, language)}</p> : null;
}
