import { useId } from 'react';

const count = value => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value) || 0);
const dateLabel = value => new Date(`${value}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
const dateOnly = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });

export default function DashboardAnalytics({ analytics, recoveries = [], onRetry }) {
  const id = useId();
  const { data, error, loading } = analytics;
  const today = data?.period.to;
  const heading = <header className="analytics-heading">
    <h2 id={`${id}-heading`}>Load status</h2>
    <p>{today ? `Today · ${dateLabel(today)}` : 'Today'}</p>
  </header>;
  if (!data) return <section className="dashboard-analytics" aria-labelledby={`${id}-heading`} aria-busy={loading}>{heading}<div className="analytics-state" role={loading ? 'status' : 'alert'}>{loading ? 'Loading overview…' : <>Analytics could not be loaded.<button type="button" onClick={onRetry}>Try again</button></>}</div></section>;

  const { todayStatusCounts = {} } = data;
  const unfinished = today ? recoveries.filter(draft => !draft.serverId && draft.savedAt && dateOnly.format(draft.savedAt) === today).length : 0;
  const statuses = [
    ['Drafts', Number(todayStatusCounts.Draft) || 0, 'var(--text-muted)'],
    ['Unfinished loads', unfinished, 'var(--ui-warning)'],
    ['Finalized loads', (Number(todayStatusCounts.Dispatched) || 0) + (Number(todayStatusCounts.Delivered) || 0), 'var(--ui-success)'],
  ];
  const total = statuses.reduce((sum, [, value]) => sum + value, 0);
  let position = 0;
  const pie = total
    ? statuses.map(([, value, color]) => {
        const start = position;
        position += value / total * 100;
        return `${color} ${start}% ${position}%`;
      }).join(', ')
    : 'var(--ui-border) 0% 100%';
  const chartLabel = `${count(total)} total loads today: ${statuses.map(([label, value]) => `${label} ${count(value)}`).join(', ')}`;

  return <section className="dashboard-analytics" aria-labelledby={`${id}-heading`} aria-busy={loading}>
    {heading}
    {error && <div className="analytics-state" role="alert">Showing earlier figures. Refresh failed.<button type="button" onClick={onRetry}>Try again</button></div>}
    <div className="analytics-status-content">
      <div className="analytics-pie" role="img" aria-label={chartLabel} style={{ '--analytics-pie': pie }}>
        <div className="analytics-pie-total"><strong>{count(total)}</strong><span>Total loads</span></div>
      </div>
      <ul className="analytics-legend" aria-label="Load status counts">
        {statuses.map(([label, value, color]) => <li key={label}><span className="analytics-dot" style={{ background: color }} /><span>{label}</span><strong>{count(value)}</strong></li>)}
      </ul>
    </div>
  </section>;
}
