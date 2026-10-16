import React, { useEffect, useRef, useState } from 'react';
import { Button, ErrorMessage } from './Controls.jsx';
import { money } from '../../utils/pilotDraft.js';
import { getInvoicePayments } from '../../lib/pilotApi.js';
import AddPaymentDialog from './AddPaymentDialog.jsx';

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export default function PaymentSection({ dispatchId, canRecordPayment = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The dialog unmounts on close; return focus to its trigger, or the heading if the trigger is gone.
  const addButton = useRef(null);
  const heading = useRef(null);
  function closeDialog() {
    setDialogOpen(false);
    requestAnimationFrame(() => (addButton.current || heading.current)?.focus());
  }
  function retry() {
    setError('');
    setLoading(true);
    setAttempt((value) => value + 1);
  }

  useEffect(() => {
    let active = true;
    getInvoicePayments(dispatchId)
      .then((res) => {
        if (active) {
          setData(res);
          setError('');
        }
      })
      .catch((err) => {
        // Keep the raw detail; the sentence around it is added at render.
        if (active) setError(err?.message || String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dispatchId, attempt]);

  function onPaymentSaved(updatedSummary) {
    setData(updatedSummary);
    closeDialog();
  }

  if (loading && !data) {
    return (
      <section className="payment-section-card payment-panel" aria-busy="true">
        <p className="payment-panel-loading" role="status">Loading payment details…</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="payment-section-card payment-panel">
        <ErrorMessage error={`Payment details couldn’t be loaded. Check your connection and try again. (${error})`} />
        <Button label="Try again" onClick={retry} />
      </section>
    );
  }

  const invoiceTotal = data?.invoiceTotal || 0;
  const received = data?.received || 0;
  const balance = data?.balance || 0;
  const status = data?.status || 'PAYMENT_DUE';
  const payments = data?.payments || [];

  const statusConfig = {
    PAYMENT_DUE: {
      text: 'Payment Due',
      tone: 'due'
    },
    PARTIALLY_PAID: {
      text: 'Partially Paid',
      tone: 'partial'
    },
    PAID: {
      text: 'Paid',
      tone: 'paid'
    }
  };

  const badge = statusConfig[status] || statusConfig.PAYMENT_DUE;
  const progress = invoiceTotal > 0 ? Math.min(100, Math.max(0, (received / invoiceTotal) * 100)) : 0;

  return (
    <section className="payment-section-card payment-panel" aria-labelledby="payment-panel-title">
      <header className="payment-panel-head">
        <div className="payment-panel-heading">
          <h2 id="payment-panel-title" ref={heading} tabIndex={-1}>Payment</h2>
          <span className="payment-status" data-tone={badge.tone} role="status">{badge.text}</span>
        </div>
        {canRecordPayment && balance > 0 && (
          <button
            type="button"
            ref={addButton}
            className="btn control-button control-button-primary payment-add-button"
            onClick={() => setDialogOpen(true)}
          >
            <span aria-hidden="true">+</span> Add Payment
          </button>
        )}
      </header>

      <dl className="payment-stats">
        <div className="payment-stat">
          <dt>Invoice Total</dt>
          <dd>{money(invoiceTotal)}</dd>
        </div>
        <div className="payment-stat" data-tone="received">
          <dt>Received</dt>
          <dd>{money(received)}</dd>
        </div>
        <div className="payment-stat" data-tone={balance > 0 ? 'due' : 'paid'}>
          <dt>Balance Due</dt>
          <dd>{money(balance)}</dd>
        </div>
      </dl>
      <div className="payment-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress / 100})` }} /></div>

      {payments.length > 0 && (
        <div className="payment-history-block">
          <h3>Payment History</h3>
          <ul>
            {payments.map((p) => (
              <li key={p.id}>
                <div className="min-w-0">
                  <strong>{money(p.amount)}</strong>
                  {p.note && <span className="payment-note">{p.note}</span>}
                </div>
                <div className="payment-meta">
                  <span>{formatDate(p.createdAt)}</span>
                  {p.createdBy && <span className="payment-by" title={p.createdBy}>{'by '}<span translate="no">{p.createdBy}</span></span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dialogOpen && (
        <AddPaymentDialog
          open={dialogOpen}
          dispatchId={dispatchId}
          invoiceTotal={invoiceTotal}
          received={received}
          balance={balance}
          onCancel={closeDialog}
          onSaved={onPaymentSaved}
        />
      )}
    </section>
  );
}
