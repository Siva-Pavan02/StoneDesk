import { useId, useState } from 'react';

const count = value => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
const dateLabel = (value, monthly = false) => new Date(`${value}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...(monthly ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' }) });

export default function DashboardAnalytics({ analytics, selectedPeriod = '3', onPeriodChange, onRetry }) {
  const id = useId();
  const [activePoint, setActivePoint] = useState(null);
  const { data, error, loading } = analytics;
  const heading = <header className="analytics-heading">
    <div><h2 id={`${id}-heading`}>Overview</h2><p>{selectedPeriod === 'all' ? 'All time' : `Last ${selectedPeriod} days`}{data?.period.from ? ` · ${dateLabel(data.period.from)} to ${dateLabel(data.period.to)}` : ''}</p></div>
    <div className="analytics-period-filter" role="group" aria-label="Analytics period">
      {['3', '7', '30', 'all'].map(period => <button key={period} type="button" aria-pressed={selectedPeriod === period} onClick={() => { setActivePoint(null); onPeriodChange?.(period); }}>{period === 'all' ? 'All time' : `${period} days`}</button>)}
    </div>
  </header>;
  if (!data) return <section className="dashboard-analytics" aria-labelledby={`${id}-heading`} aria-busy={loading}>{heading}<div className="analytics-state" role={loading ? 'status' : 'alert'}>{loading ? 'Loading overview…' : <>Analytics could not be loaded.<button type="button" onClick={onRetry}>Try again</button></>}</div></section>;

  const { trend = [], statusCounts = {} } = data;
  const monthly = data.period.granularity === 'month';
  const maxLoads = Math.max(1, ...trend.map(point => point.loads));
  const slotWidth = 552 / Math.max(1, trend.length);
  const barWidth = Math.min(48, slotWidth * 0.65);
  const x = index => 36 + (index + 0.5) * slotWidth;
  const y = loads => 172 - loads / maxLoads * 144;
  const point = trend[activePoint ?? trend.length - 1];
  const statuses = [['Draft', 'Draft', 'var(--text-muted)'], ['Dispatched', 'In transit', 'var(--ui-info)'], ['Delivered', 'Delivered', 'var(--ui-success)']];
  const statusTotal = statuses.reduce((total, [key]) => total + (statusCounts[key] || 0), 0);

  return <section className="dashboard-analytics" aria-labelledby={`${id}-heading`} aria-busy={loading}>
    {heading}
    {error && <div className="analytics-state" role="alert">Showing earlier figures. Refresh failed.<button type="button" onClick={onRetry}>Try again</button></div>}
    {!!data.unreadable && <p className="analytics-note" role="status">Some loads have incomplete totals and are excluded from dispatch volume and billing.</p>}
    <div className="analytics-domain"><h3>Logistics</h3><span>By load date · current status</span></div>
    <div className="analytics-grid">
      <section className="analytics-trend" aria-labelledby={`${id}-dispatch`}>
        <h4 id={`${id}-dispatch`}>{monthly ? 'Monthly' : 'Daily'} dispatch volume</h4>
        <p className="analytics-note">Dispatched and delivered loads</p>
        {trend.length ? <>
          <p className="analytics-readout" aria-live="polite">{point ? `${dateLabel(point.date, monthly)} · ${count(point.loads)} loads` : 'No dispatches'}</p>
          <svg className="analytics-columns" viewBox="0 0 608 208" role="group" aria-label="Dispatch volume bar chart">
            {[0, maxLoads].map(value => <g key={value}><line x1="36" x2="588" y1={y(value)} y2={y(value)} stroke="var(--ui-border)" /><text x="24" y={y(value) + 4} textAnchor="end">{count(value)}</text></g>)}
            {trend.map((entry, index) => <g key={entry.date} tabIndex="0" role="img" aria-label={`${dateLabel(entry.date, monthly)}: ${entry.loads} loads`} onFocus={() => setActivePoint(index)} onMouseEnter={() => setActivePoint(index)} onClick={() => setActivePoint(index)}>
              <rect x={x(index) - slotWidth / 2} y="24" width={slotWidth} height="152" fill="transparent" />
              <rect className="analytics-volume-bar" x={x(index) - barWidth / 2} y={y(entry.loads)} width={barWidth} height={172 - y(entry.loads)} rx="2" fill="var(--ui-accent)" opacity={activePoint === null || activePoint === index ? 1 : 0.45} />
              <title>{dateLabel(entry.date, monthly)}: {entry.loads} loads</title>
            </g>)}
            <text x="36" y="202">{dateLabel(trend[0].date, monthly)}</text><text x="588" y="202" textAnchor="end">{trend.length > 1 ? dateLabel(trend.at(-1).date, monthly) : ''}</text>
          </svg>
        </> : <p className="analytics-empty">No dispatch history yet.</p>}
      </section>
      <section className="analytics-fleet" aria-labelledby={`${id}-fleet`}>
        <h4 id={`${id}-fleet`}>Load status</h4><p className="analytics-note">Loads dated in this period, not vehicle availability</p>
        <div className="analytics-segments" aria-hidden="true">{statuses.map(([key, , color]) => <span key={key} style={{ width: `${statusTotal ? (statusCounts[key] || 0) / statusTotal * 100 : 0}%`, background: color }} />)}</div>
        <ul className="analytics-legend">{statuses.map(([key, label, color]) => <li key={key}><span className="analytics-dot" style={{ background: color }} /><span>{label}</span><strong>{count(statusCounts[key] || 0)}</strong></li>)}</ul>
        {!statusTotal && <p className="analytics-empty">No loads in this period.</p>}
      </section>
    </div>
  </section>;
}
