import React, { useEffect, useRef, useState } from 'react';
import { Button, ErrorMessage, FieldError } from './Controls.jsx';
import { money } from '../../utils/pilotDraft.js';
import { createInvoicePayment } from '../../lib/pilotApi.js';

export default function AddPaymentDialog({ open, dispatchId, invoiceTotal, received, balance, onCancel, onSaved }) {
  const dialog = useRef(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Validation of the amount shows under the amount input; `error` is for the server.
  const [amountError, setAmountError] = useState('');
  const amountInput = useRef(null);
  const unsaved = open && !busy && (amount !== '' || note.trim() !== '');
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      setAmount('');
      setNote('');
      setError('');
      setAmountError('');
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const num = Number(amount);
    const invalid = !Number.isFinite(num) || num <= 0
      ? 'Enter a valid amount greater than zero'
      : num > balance
        ? `Amount cannot exceed balance due (${money(balance)})`
        : '';
    setAmountError(invalid);
    if (invalid) {
      amountInput.current?.focus();
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
      const detail = err?.message ? ` (${err.message})` : '';
      setError(`The payment wasn’t saved. Check your connection and try again.${detail}`);
    } finally {
      setBusy(false);
    }
  }

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
      <form onSubmit={submit} noValidate className="add-payment-form space-y-4 p-3">
        <header className="dialog-header">
          <h2 id="add-payment-title" className="text-lg font-semibold text-primary">
            Add Payment
          </h2>
        </header>

        <div className="payment-dialog-metrics grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-surface rounded-lg border border-outline-variant text-xs text-center sm:text-left">
          <div className="p-2 bg-white rounded border border-outline-variant">
            <span className="text-on-surface-variant font-medium block mb-0.5">Invoice Total</span>
            <strong className="text-on-surface text-sm font-semibold block tabular-nums">{money(invoiceTotal)}</strong>
          </div>
          <div className="p-2 bg-success-container/50 rounded border border-outline-variant">
            <span className="text-success font-medium block mb-0.5">Received</span>
            <strong className="text-success text-sm font-semibold block tabular-nums">{money(received)}</strong>
          </div>
          <div className="p-2 bg-warning-container/60 rounded border border-warning-container">
            <span className="text-warning font-medium block mb-0.5">Balance Due</span>
            <strong className="text-warning text-sm font-bold block tabular-nums">{money(balance)}</strong>
          </div>
        </div>

        <ErrorMessage error={error} />

        <div className="control-field">
          <label className="control-label" htmlFor="payment-amount">
            Amount Received (₹)
          </label>
          <input
            ref={amountInput}
            id="payment-amount"
            name="amount"
            className="input"
            type="number"
            inputMode="decimal"
            autoComplete="off"
            step="0.01"
            min="0.01"
            max={balance}
            placeholder="0.00"
            disabled={busy}
            required
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError ? 'payment-amount-error' : undefined}
            value={amount}
            onChange={(e) => { setAmount(e.target.value); if (amountError) setAmountError(''); }}
          />
          <FieldError id="payment-amount-error" error={amountError} />
        </div>

        <div className="control-field">
          <label className="control-label" htmlFor="payment-note">
            Note (optional)
          </label>
          <input
            id="payment-note"
            name="note"
            autoComplete="off"
            className="input"
            type="text"
            maxLength={255}
            placeholder="e.g. Advance, Cheque #1234…"
            disabled={busy}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="dialog-actions flex justify-end gap-2 pt-2">
          <Button
            label="Cancel"
            disabled={busy}
            onClick={onCancel}
          />
          <Button primary type="submit" disabled={busy} label={busy ? 'Saving…' : 'Save Payment'} />
        </div>
      </form>
    </dialog>
  );
}
