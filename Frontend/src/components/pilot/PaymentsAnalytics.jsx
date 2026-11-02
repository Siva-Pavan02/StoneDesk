import { useId } from 'react';
import { money } from '../../utils/pilotDraft.js';
import Icon from './Icon.jsx';

const periods = ['3', '7', '30', 'all'];
const countFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const partyColors = ['var(--ui-info)', 'var(--ui-success)', 'var(--ui-warning)', 'var(--ui-accent)', 'var(--ui-danger)', 'var(--ui-ink)'];
const count = value => countFormat.format(Number(value) || 0);
const dateLabel = (value, monthly = false) => new Date(`${value}T00:00:00+05:30`).toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata',
  ...(monthly ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })
});

export default function PaymentsAnalytics({ analytics, selectedPeriod = '3', onPeriodChange, onRetry, onViewParty }) {
  const id = useId();
  const { data, error, loading } = analytics;
  const periodLabel = selectedPeriod === 'all' ? 'All time' : `Last ${selectedPeriod} days`;
  const header = <header className="payments-heading">
    <div><h1 id={`${id}-heading`}>Payments</h1><p>{periodLabel}{data?.period.from ? ` · ${dateLabel(data.period.from)} to ${dateLabel(data.period.to)}` : ''}</p></div>
    <div className="payments-heading-actions">
      <button type="button" className="payments-refresh" onClick={onRetry} disabled={loading}><Icon name="refresh" />Refresh</button>
      <div className="analytics-period-filter" role="group" aria-label="Payments period">
        {periods.map(period => <button key={period} type="button" aria-pressed={selectedPeriod === period} onClick={() => onPeriodChange?.(period)}>{period === 'all' ? 'All time' : `${period} days`}</button>)}
      </div>
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
  const circumference = 2 * Math.PI * 64;
  const slices = outstandingParties.reduce((result, party, index) => {
    const length = party.outstanding / current.outstanding * circumference;
    const previous = result[index - 1];
    result.push({ party, color: partyColors[index % partyColors.length], length, offset: previous ? previous.offset + previous.length : 0 });
    return result;
  }, []);

  return <section className="payments-analytics" aria-labelledby={`${id}-heading`} aria-busy={loading}>
    {header}
    {error && <div className="analytics-state" role="alert">Showing earlier figures. Refresh failed.<button type="button" onClick={onRetry}>Try again</button></div>}
    <dl className="payments-summary">
      <div><dt>Billed in period</dt><dd>{money(data.current.billed)}</dd><small>By load date</small></div>
      <div><dt>Received in period</dt><dd>{money(current.received)}</dd><small>By payment date</small></div>
      <div><dt>Invoices paid in full</dt><dd>{count(current.completedInvoices)}<small>{money(current.completedInvoiceTotal)} invoice value</small></dd></div>
      <div><dt>Outstanding</dt><dd>{money(current.outstanding)}</dd><small>All time</small></div>
    </dl>
    <section className="payments-receivables" aria-labelledby={`${id}-parties`}>
      <div className="payments-section-heading">
        <div><h2 id={`${id}-parties`}>Payments by party</h2><p className="analytics-note">All-time billed totals and remaining balances.</p></div>
      </div>
      {outstandingParties.length ? <div className="payments-party-breakdown">
        <div className="payments-donut-wrap">
          <svg className="payments-donut" viewBox="0 0 180 180" role="img" aria-label={`Outstanding by party, total due ${money(current.outstanding)}`}>
            <circle className="payments-donut-track" cx="90" cy="90" r="64" />
            {slices.map(({ party, color, length, offset: sliceOffset }) => (
              <circle key={party.party} className="payments-donut-segment" cx="90" cy="90" r="64"
                stroke={color} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-sliceOffset}>
                <title>{party.party}: due {money(party.outstanding)}</title>
              </circle>
            ))}
          </svg>
        </div>
        <ol className="payments-party-list">
          {slices.map(({ party, color }) => <li key={party.party} style={{ '--party-color': color }}>
            <div className="payments-party-heading">
              <strong className="payments-party-name"><span aria-hidden="true" />{party.party}</strong>
              <button type="button" className="payments-invoices-link" onClick={() => onViewParty?.(party.party)}>View invoices</button>
            </div>
            <dl className="payments-party-amounts">
              <div className="payments-party-amount">
                <div><dt>Total billed</dt><dd>{money(party.billed)}</dd></div>
                <span className="payments-party-amount-bar payments-party-amount-bar-billed" aria-hidden="true"><span style={{ width: '100%' }} /></span>
              </div>
              <div className="payments-party-amount">
                <div><dt>Due</dt><dd>{money(party.outstanding)}</dd></div>
                <span className="payments-party-amount-bar payments-party-amount-bar-due" aria-hidden="true">
                  <span style={{ width: `${party.billed > 0 ? Math.min(100, party.outstanding / party.billed * 100) : 0}%` }} />
                </span>
              </div>
            </dl>
          </li>)}
        </ol>
      </div> : <p className="analytics-empty">No outstanding balances.</p>}
    </section>
  </section>;
}
