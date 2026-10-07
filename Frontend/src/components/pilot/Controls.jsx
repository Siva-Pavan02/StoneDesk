import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { translatePilotMessage } from '../../i18n/pilotMessages.js';
export function Label({ en, te }) {
  const { pick } = useLanguage();
  return <span className="text-left font-semibold">{pick(en, te)}</span>;
}
export function Button({ en, te, primary = false, children, className = '', ...props }) {
  return <button type="button" {...props} className={`btn rounded-xl shadow-none ${primary ? 'bg-teal-800 border-teal-800 text-white hover:bg-teal-900' : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-100'} ${className}`}><Label en={en} te={te} />{children}</button>;
}
export function Field({ en, te, children, ...props }) {
  return <label className="flex min-w-0 flex-col gap-2"><Label en={en} te={te} />{children || <input className="input rounded-xl" {...props} />}</label>;
}
export function Card({ children, className = '' }) {
  return <section className={`card bg-white border border-gray-200 rounded-lg p-4 ${className}`}>{children}</section>;
}
export function ErrorMessage({ error }) {
  const { language } = useLanguage();
  return error ? <p role="alert" className="rounded-xl border-2 border-red-300 bg-white p-4 font-semibold text-red-800">{translatePilotMessage(error, language)}</p> : null;
}
