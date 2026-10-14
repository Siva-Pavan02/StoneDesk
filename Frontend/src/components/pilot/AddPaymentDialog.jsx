import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button, ErrorMessage } from './Controls.jsx';
import { money } from '../../utils/pilotDraft.js';
import { createInvoicePayment } from '../../lib/pilotApi.js';

export default function AddPaymentDialog({ open, dispatchId, invoiceTotal, received, balance, onCancel, onSaved }) {
  const { pick } = useLanguage();
  const dialog = useRef(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      setAmount('');
      setNote('');
      setError('');
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setError(pick('Enter a valid amount greater than zero', 'సున్నా కంటే ఎక్కువ చెల్లుబాటు అయ్యే మొత్తాన్ని నమోదు చేయండి'));
      return;
    }
    if (num > balance) {
      setError(pick(`Amount cannot exceed balance due (${money(balance)})`, `మొత్తం మిగిలిన మొత్తం కంటే ఎక్కువ ఉండకూడదు (${money(balance)})`));
      return;
    }

    setBusy(true);
    setError('');
    try {
      const updated = await createInvoicePayment(dispatchId, {
        amount: num,
        note: note.trim() || undefined
      });
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isValid = Number(amount) > 0 && Number(amount) <= balance;

  return (
    <dialog
      ref={dialog}
      className="app-dialog pilot add-payment-dialog"
      aria-labelledby="add-payment-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <form onSubmit={submit} className="add-payment-form space-y-4 p-3">
        <header className="dialog-header">
          <h2 id="add-payment-title" className="text-lg font-semibold text-teal-950">
            {pick('Add Payment', 'చెల్లింపును జోడించండి')}
          </h2>
        </header>

        <div className="payment-dialog-metrics grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs text-center sm:text-left">
          <div className="p-2 bg-white rounded border border-stone-200">
            <span className="text-stone-500 font-medium block mb-0.5">{pick('Invoice Total', 'ఇన్వాయిస్ మొత్తం')}</span>
            <strong className="text-stone-900 text-sm font-semibold block">{money(invoiceTotal)}</strong>
          </div>
          <div className="p-2 bg-emerald-50/50 rounded border border-emerald-200">
            <span className="text-emerald-800 font-medium block mb-0.5">{pick('Received', 'స్వీకరించినది')}</span>
            <strong className="text-emerald-800 text-sm font-semibold block">{money(received)}</strong>
          </div>
          <div className="p-2 bg-amber-50/60 rounded border border-amber-300">
            <span className="text-amber-900 font-medium block mb-0.5">{pick('Balance Due', 'మిగిలినది')}</span>
            <strong className="text-amber-950 text-sm font-bold block">{money(balance)}</strong>
          </div>
        </div>

        <ErrorMessage error={error} />

        <div className="control-field">
          <label className="control-label" htmlFor="payment-amount">
            {pick('Amount Received (₹)', 'స్వీకరించిన మొత్తం (₹)')}
          </label>
          <input
            id="payment-amount"
            className="input"
            type="number"
            step="0.01"
            min="0.01"
            max={balance}
            placeholder="0.00"
            disabled={busy}
            autoFocus
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="control-field">
          <label className="control-label" htmlFor="payment-note">
            {pick('Note (optional)', 'గమనిక (ఐచ్ఛికం)')}
          </label>
          <input
            id="payment-note"
            className="input"
            type="text"
            maxLength={255}
            placeholder={pick('e.g. Advance, Cheque #1234', 'ఉదా. అడ్వాన్స్, చెక్ #1234')}
            disabled={busy}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="dialog-actions flex justify-end gap-2 pt-2">
          <Button
            en="Cancel"
            te="రద్దు"
            disabled={busy}
            onClick={onCancel}
          />
          <button
            type="submit"
            disabled={busy || !isValid}
            className="btn control-button control-button-primary"
          >
            {busy ? pick('Saving…', 'సేవ్ అవుతోంది…') : pick('Save Payment', 'చెల్లింపును సేవ్ చేయండి')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
