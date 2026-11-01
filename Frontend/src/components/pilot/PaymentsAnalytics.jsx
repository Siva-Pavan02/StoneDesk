import { useId, useState } from 'react';
import { money } from '../../utils/pilotDraft.js';
import Icon from './Icon.jsx';

const periods = ['3', '7', '30', 'all'];
const countFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const compactMoneyFormat = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const count = value => countFormat.format(Number(value) || 0);
const compactMoney = value => `₹${compactMoneyFormat.format(value)}`;
const dateLabel = (value, monthly = false) => new Date(`${value}T00:00:00+05:30`).toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata',
  ...(monthly ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })
});

export default function PaymentsAnalytics({ analytics, selectedPeriod = '3', onPeriodChange, onRetry, onViewParty }) {
  const id = useId();
  const [activePoint, setActivePoint] = useState(null);
  const { data, error, loading } = analytics;
  const periodLabel = selectedPeriod === 'all' ? 'All time' : `Last ${selectedPeriod} days`;
  const header = <header className="payments-heading">
    <div><p className="surface-kicker">FINANCE</p><h1 id={`${id}-heading`}>Payments</h1><p>{periodLabel}{data?.period.from ? ` · ${dateLabel(data.period.from)} to ${dateLabel(data.period.to)}` : ''}</p></div>
    <div className="payments-heading-actions">
      <button type="button" className="payments-refresh" onClick={onRetry} disabled={loading}><Icon name="refresh" />Refresh</button>
      <div className="analytics-period-filter" role="group" aria-label="Payments period">
        {periods.map(period => <button key={period} type="button" aria-pressed={selectedPeriod === period} onClick={() => { setActivePoint(null); onPeriodChange?.(period); }}>{period === 'all' ? 'All time' : `${period} days`}</button>)}
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

  const { current, trend = [], parties = [] } = paymentAnalytics;
  const monthly = data.period.granularity === 'month';
  const maxAmount = Math.max(1, ...trend.map(point => Math.max(point.received, point.completedInvoiceTotal)));
  const slotWidth = 552 / Math.max(1, trend.length);
  const barWidth = Math.min(18, slotWidth * 0.34);
  const x = index => 36 + (index + 0.5) * slotWidth;
  const y = amount => 184 - amount / maxAmount * 144;
  const point = trend[activePoint ?? trend.length - 1];
  const hasActivity = trend.some(point => point.received > 0 || point.completedInvoices > 0);
  const outstandingParties = parties.filter(party => party.outstanding > 0);
  const maxOutstanding = Math.max(1, ...outstandingParties.map(party => party.outstanding));
  const statusLabel = party => party.unpaidInvoices && party.partialInvoices
    ? 'Mixed'
    : party.partialInvoices
      ? 'Part-paid'
      : 'Unpaid';

  return <section className="payments-analytics" aria-labelledby={`${id}-heading`} aria-busy={loading}>
    {header}
    {error && <div className="analytics-state" role="alert">Showing earlier figures. Refresh failed.<button type="button" onClick={onRetry}>Try again</button></div>}
    <dl className="payments-summary">
      <div><dt>Total billed</dt><dd>{money(data.current.billed)}</dd><small>By load date</small></div>
      <div><dt>Received</dt><dd>{money(current.received)}</dd><small>By payment date</small></div>
      <div><dt>Invoices paid in full</dt><dd>{count(current.completedInvoices)}<small>{money(current.completedInvoiceTotal)} invoice value</small></dd></div>
      <div><dt>Outstanding</dt><dd>{money(current.outstanding)}</dd><small>All time</small></div>
    </dl>
    <div className="payments-grid">
      <section className="payments-trend" aria-labelledby={`${id}-trend`}>
        <div className="payments-section-heading">
          <div><h2 id={`${id}-trend`}>Collections and completed invoices</h2><p className="analytics-note">Receipts by payment date · completions by final payment date</p></div>
          <ul className="payments-legend" aria-label="Chart series">
            <li><span className="is-received" />Received</li>
            <li><span className="is-completed" />Paid in full</li>
          </ul>
        </div>
        {hasActivity ? <>
          <p className="payments-readout" aria-live="polite">
            {point && `${dateLabel(point.date, monthly)} · Received ${money(point.received)} · ${count(point.completedInvoices)} invoices paid in full (${money(point.completedInvoiceTotal)})`}
          </p>
          <svg className="payments-trend-chart" viewBox="0 0 608 218" role="group" aria-label="Payments and completed invoices by date">
            {[0, maxAmount].map(value => <g key={value}>
              <line x1="36" x2="588" y1={y(value)} y2={y(value)} stroke="var(--ui-border)" />
              <text x="30" y={y(value) + 4} textAnchor="end">{compactMoney(value)}</text>
            </g>)}
            {trend.map((entry, index) => {
              const center = x(index);
              const values = [
                { key: 'received', amount: entry.received, color: 'var(--ui-info)' },
                { key: 'completed', amount: entry.completedInvoiceTotal, color: 'var(--ui-success)' }
              ];
              return <g key={entry.date} tabIndex="0" role="img"
                aria-label={`${dateLabel(entry.date, monthly)}: received ${money(entry.received)}; ${count(entry.completedInvoices)} invoices paid in full, invoice value ${money(entry.completedInvoiceTotal)}`}
                onFocus={() => setActivePoint(index)} onMouseEnter={() => setActivePoint(index)} onClick={() => setActivePoint(index)}>
                <rect x={center - slotWidth / 2} y="24" width={slotWidth} height="164" fill="transparent" />
                {values.map((value, seriesIndex) => <rect key={value.key}
                  className={`payments-trend-bar is-${value.key}`}
                  x={center + (seriesIndex ? 1 : -1) * (barWidth + 1) / 2 - barWidth / 2}
                  y={y(value.amount)}
                  width={barWidth}
                  height={184 - y(value.amount)}
                  rx="2"
                  fill={value.color}
                  opacity={activePoint === null || activePoint === index ? 1 : 0.42}
                />)}
                <title>{dateLabel(entry.date, monthly)}: received {money(entry.received)}; invoices paid in full {money(entry.completedInvoiceTotal)}</title>
              </g>;
            })}
            <text x="36" y="210">{dateLabel(trend[0].date, monthly)}</text>
            <text x="588" y="210" textAnchor="end">{trend.length > 1 ? dateLabel(trend.at(-1).date, monthly) : ''}</text>
          </svg>
        </> : <p className="analytics-empty">No payment activity in this period.</p>}
      </section>
      <section className="payments-parties" aria-labelledby={`${id}-parties`}>
        <div className="payments-section-heading">
          <div><h2 id={`${id}-parties`}>Outstanding by party</h2><p className="analytics-note">All-time unpaid balance · independent of period</p></div>
        </div>
        {outstandingParties.length ? <ol className="payments-party-bars">
          {outstandingParties.map(party => <li key={party.party}>
            <div className="payments-party-heading">
              <strong className="payments-party-name">{party.party}</strong>
              <strong>{money(party.outstanding)}</strong>
            </div>
            <div className="payments-party-track" aria-hidden="true"><span style={{ width: `${party.outstanding / maxOutstanding * 100}%` }} /></div>
            <div className="payments-party-footer">
              <span className={`analytics-payment-status is-${statusLabel(party).toLowerCase().replace('-', '')}`}>{statusLabel(party)}</span>
              <button type="button" className="payments-invoices-link" onClick={() => onViewParty?.(party.party)}>View invoices</button>
            </div>
          </li>)}
        </ol> : <p className="analytics-empty">No outstanding balances.</p>}
      </section>
    </div>
  </section>;
}
