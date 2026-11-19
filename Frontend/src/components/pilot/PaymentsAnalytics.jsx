import { useEffect, useId, useRef, useState } from 'react';
import { request } from '../../lib/pilotApi.js';
import { money } from '../../utils/pilotDraft.js';
import Icon from './Icon.jsx';

const periods = ['3', '7', '30', 'all'];
const countFormat = new Intl.NumberFormat('en-IN');
const count = value => countFormat.format(Number(value) || 0);
const dateLabel = (value, monthly = false) => new Date(`${value}T00:00:00+05:30`).toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata',
  ...(monthly ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })
});

function PartyInvoices({ party, panelId, onOpenInvoice }) {
  const [page, setPage] = useState({ rows: [], nextCursor: null, loading: true, error: '' });
  const [retry, setRetry] = useState(0);
  const loadingMore = useRef(false);

  useEffect(() => {
    let active = true;
    request(`/dispatches/receivables?party=${encodeURIComponent(party)}`)
      .then(result => {
        if (active) setPage({ rows: result.data, nextCursor: result.nextCursor, loading: false, error: '' });
      })
      .catch(error => {
        if (active) setPage(prev => ({ ...prev, loading: false, error: error.message }));
      });
    return () => { active = false; };
  }, [party, retry]);

  async function loadMore() {
    if (page.loading || loadingMore.current || !page.nextCursor) return;
    loadingMore.current = true;
    setPage(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const result = await request(`/dispatches/receivables?party=${encodeURIComponent(party)}&cursor=${encodeURIComponent(page.nextCursor)}`);
      setPage(prev => ({ rows: [...prev.rows, ...result.data], nextCursor: result.nextCursor, loading: false, error: '' }));
    } catch (error) {
      setPage(prev => ({ ...prev, loading: false, error: error.message }));
    } finally {
      loadingMore.current = false;
    }
  }

  return <section id={panelId} className="payments-invoice-panel" aria-label={`Invoices with a balance for ${party}`}>
    <h3>Invoices with a balance</h3>
    {page.error && <p role="alert" className="payments-invoice-error">Couldn’t load unpaid invoices. Try again.</p>}
    {page.loading && !page.rows.length && <p role="status" className="analytics-note">Loading unpaid invoices…</p>}
    {!page.loading && !page.error && !page.rows.length && <p className="analytics-note">No invoices with a balance remain for this party. Refresh to update the summary.</p>}
    {page.rows.length > 0 && <ol className="payments-invoice-list">
      {page.rows.map(invoice => <li key={invoice.id}>
        <div>
          <strong title={invoice.dispatchSlipNumber}>{invoice.dispatchSlipNumber || 'Invoice'}</strong>
          <span>{dateLabel(invoice.date.slice(0, 10))} · {invoice.status === 'PARTIALLY_PAID' ? 'Partially paid' : 'Unpaid'}</span>
        </div>
        <div className="payments-invoice-action">
          <strong>{money(invoice.balance)}</strong>
          <a href={`#bill/${encodeURIComponent(invoice.id)}`} onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            onOpenInvoice?.(invoice.id);
          }}>Open invoice</a>
        </div>
      </li>)}
    </ol>}
    {page.error && !page.rows.length && <button type="button" className="payments-invoices-link" onClick={() => { setPage(prev => ({ ...prev, loading: true, error: '' })); setRetry(value => value + 1); }}>Try again</button>}
    {page.nextCursor && <button type="button" className="payments-invoices-link" disabled={page.loading} onClick={loadMore}>{page.loading ? 'Loading…' : page.error ? 'Retry more invoices' : 'Show more invoices'}</button>}
  </section>;
}

export default function PaymentsAnalytics({ analytics, selectedPeriod = '3', onPeriodChange, onRetry, onOpenInvoice }) {
  const id = useId();
  const [openParty, setOpenParty] = useState(null);
  const { data, error, loading } = analytics;
  const periodLabel = selectedPeriod === 'all' ? 'All time' : `Last ${selectedPeriod} days`;
  const header = <header className="payments-heading">
    <div><h1 id={`${id}-heading`}>Payment insights</h1></div>
    <div className="payments-heading-actions">
      <div className="analytics-period-filter" role="group" aria-label="Payments period">
        {periods.map(period => <button
          key={period}
          type="button"
          aria-label={period === 'all' ? 'All' : `${period} days`}
          aria-pressed={selectedPeriod === period}
          onClick={() => onPeriodChange?.(period)}
        >{period === 'all' ? 'All' : period}</button>)}
      </div>
      <button type="button" className="payments-refresh" aria-label="Refresh payment analytics" onClick={onRetry} disabled={loading}><Icon name="refresh" /></button>
    </div>
  </header>;

  if (!data) return <section className="payments-analytics" aria-labelledby={`${id}-heading`} aria-busy={loading}>
    {header}
    <div className="analytics-state" role={loading ? 'status' : 'alert'}>
      {loading ? 'Loading payment analytics…' : <>Payment analytics could not be loaded.<button type="button" onClick={onRetry}>Try again</button></>}
    </div>
  </section>;

  const paymentAnalytics = data.paymentAnalytics;
  if (!paymentAnalytics) return <section className="payments-analytics" aria-labelledby={`${id}-heading`} aria-busy={loading}>
    {header}<div className="analytics-state" role="alert">Payment analytics are unavailable.<button type="button" onClick={onRetry}>Try again</button></div>
  </section>;

  const { current, parties = [] } = paymentAnalytics;
  const outstandingParties = parties.filter(party => party.outstanding > 0);

  return <section className="payments-analytics" aria-labelledby={`${id}-heading`} aria-busy={loading}>
    {header}
    {error && <div className="analytics-state" role="alert">Showing earlier figures. Refresh failed.<button type="button" onClick={onRetry}>Try again</button></div>}
    <section className="payments-kpis" aria-labelledby={`${id}-summary`}>
      <div className="payments-kpi-heading">
        <h2 id={`${id}-summary`}>Payment summary</h2>
      </div>
      <dl className="payments-kpi-grid">
        <div className="payments-kpi">
          <dt><span className="payments-eyebrow">All time</span>Outstanding balance</dt>
          <dd className="payments-hero-amount">{money(current.outstanding)}</dd>
        </div>
        <div className="payments-kpi">
          <dt><span className="payments-eyebrow">All time</span>Unpaid invoices</dt>
          <dd>{count(current.unpaidInvoices)}</dd>
        </div>
        <div className="payments-kpi">
          <dt><span className="payments-eyebrow">All time</span>Partially paid</dt>
          <dd>{count(current.partialInvoices)}</dd>
        </div>
        <div className="payments-kpi">
          <dt><span className="payments-eyebrow">{periodLabel}</span>Amount received</dt>
          <dd>{money(current.received)}</dd>
        </div>
        <div className="payments-kpi">
          <dt><span className="payments-eyebrow">{periodLabel}</span>Invoices paid in full</dt>
          <dd>{count(current.completedInvoices)}</dd>
        </div>
      </dl>
    </section>
    <section className="payments-receivables" aria-labelledby={`${id}-parties`}>
      <div className="payments-section-heading">
        <div><h2 id={`${id}-parties`}>Outstanding by party</h2><p className="analytics-note">All-time balances from unpaid and partially paid invoices.</p></div>
      </div>
      {outstandingParties.length ? <><div className="payments-party-labels" aria-hidden="true"><span>Party</span><span>Balance due</span><span>Invoices</span></div><ol className="payments-party-list">
        {outstandingParties.map(party => <li key={party.party}>
          <div className="payments-party-row">
            <div className="payments-party-identity"><strong>{party.party}</strong><span>{count(party.unpaidInvoices + party.partialInvoices)} open {party.unpaidInvoices + party.partialInvoices === 1 ? 'invoice' : 'invoices'}</span></div>
            <strong className="payments-party-balance">{money(party.outstanding)}</strong>
            <button type="button" className="payments-invoices-link" aria-expanded={openParty === party.party} aria-controls={`payments-invoices-${encodeURIComponent(party.party)}`} onClick={() => setOpenParty(value => value === party.party ? null : party.party)}>{openParty === party.party ? 'Hide invoices' : 'View unpaid invoices'}</button>
          </div>
          {openParty === party.party && <PartyInvoices key={`${party.party}:${party.outstanding}`} party={party.party} panelId={`payments-invoices-${encodeURIComponent(party.party)}`} onOpenInvoice={onOpenInvoice} />}
        </li>)}
      </ol></> : <p className="analytics-empty">No outstanding balances.</p>}
    </section>
  </section>;
}
