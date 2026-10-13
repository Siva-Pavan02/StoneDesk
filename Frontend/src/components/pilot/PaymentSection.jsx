import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ErrorMessage } from './Controls.jsx';
import { money } from '../../utils/pilotDraft.js';
import { getInvoicePayments } from '../../lib/pilotApi.js';
import AddPaymentDialog from './AddPaymentDialog.jsx';

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export default function PaymentSection({ dispatchId, canRecordPayment = true }) {
  const { pick } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

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
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dispatchId]);

  function onPaymentSaved(updatedSummary) {
    setData(updatedSummary);
    setDialogOpen(false);
  }

  if (loading && !data) {
    return (
      <section className="payment-section-card bg-stone-50 border border-stone-200 rounded-lg p-4 text-sm text-stone-500">
        <p>{pick('Loading payment details…', 'చెల్లింపు వివరాలు లోడ్ అవుతున్నాయి…')}</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="payment-section-card bg-stone-50 border border-stone-200 rounded-lg p-4">
        <ErrorMessage error={error} />
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
      text: pick('Payment Due', 'చెల్లించవలసినది'),
      className: 'bg-amber-100 text-amber-900 border-amber-300'
    },
    PARTIALLY_PAID: {
      text: pick('Partially Paid', 'పాక్షికంగా చెల్లించబడింది'),
      className: 'bg-sky-100 text-sky-900 border-sky-300'
    },
    PAID: {
      text: pick('Paid', 'చెల్లించబడింది'),
      className: 'bg-emerald-100 text-emerald-900 border-emerald-300'
    }
  };

  const badge = statusConfig[status] || statusConfig.PAYMENT_DUE;

  return (
    <section className="payment-section-card bg-white border border-stone-200 rounded-lg shadow-sm p-4 space-y-4" aria-label={pick('Payment Summary', 'చెల్లింపు సారాంశం')}>
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div>
          <h2 className="text-xs uppercase tracking-wider font-semibold text-stone-500">
            {pick('Payment', 'చెల్లింపు')}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.className}`}>
            {badge.text}
          </span>
          {canRecordPayment && balance > 0 && (
            <button
              type="button"
              className="btn control-button control-button-primary text-xs py-1 px-3"
              onClick={() => setDialogOpen(true)}
            >
              + {pick('Add Payment', 'చెల్లింపును జోడించండి')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center sm:text-left">
        <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 transition-all duration-200 hover:shadow-sm">
          <span className="text-xs text-stone-500 font-medium block mb-0.5">{pick('Invoice Total', 'ఇన్వాయిస్ మొత్తం')}</span>
          <strong className="text-lg text-stone-900 font-semibold block">{money(invoiceTotal)}</strong>
        </div>
        <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200/80 transition-all duration-200 hover:shadow-sm">
          <span className="text-xs text-emerald-800 font-medium block mb-0.5">{pick('Received', 'స్వీకరించినది')}</span>
          <strong className="text-lg text-emerald-800 font-semibold block">{money(received)}</strong>
        </div>
        <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-300 transition-all duration-200 hover:shadow-sm">
          <span className="text-xs text-amber-900 font-medium block mb-0.5">{pick('Balance Due', 'మిగిలినది')}</span>
          <strong className="text-lg text-amber-950 font-bold block">{money(balance)}</strong>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="payment-history-block pt-2">
          <h3 className="text-xs font-semibold text-stone-600 mb-2 uppercase tracking-wider">
            {pick('Payment History', 'చెల్లింపు చరిత్ర')}
          </h3>
          <ul className="divide-y divide-stone-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="py-2 flex items-start justify-between gap-4">
                <div>
                  <strong className="text-stone-900 font-medium block">{money(p.amount)}</strong>
                  {p.note && <span className="text-stone-600 text-xs block">{p.note}</span>}
                </div>
                <div className="text-right text-xs text-stone-400 whitespace-nowrap">
                  <span>{formatDate(p.createdAt)}</span>
                  {p.createdBy && <span className="block text-stone-400">by {p.createdBy}</span>}
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
          onCancel={() => setDialogOpen(false)}
          onSaved={onPaymentSaved}
        />
      )}
    </section>
  );
}
