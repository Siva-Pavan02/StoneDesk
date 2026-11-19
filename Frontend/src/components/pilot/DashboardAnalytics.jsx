import { useId } from 'react';

const count = value => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value) || 0);

export default function DashboardAnalytics({ analytics, recoveries = [], onRetry }) {
  const id = useId();
  const { data, error, loading } = analytics;
  const heading = <header className="analytics-heading">
    <h2 id={`${id}-heading`}>Load status</h2>
    <p>All time</p>
  </header>;
  if (!data) return <section className="dashboard-analytics" aria-labelledby={`${id}-heading`} aria-busy={loading}>{heading}<div className="analytics-state" role={loading ? 'status' : 'alert'}>{loading ? 'Loading overview…' : <>Analytics could not be loaded.<button type="button" onClick={onRetry}>Try again</button></>}</div></section>;

  const { statusCounts = {} } = data;
  const unfinished = recoveries.filter(draft => !draft.serverId && draft.savedAt).length;
  const statuses = [
    ['Drafts', Number(statusCounts.Draft) || 0, 'var(--text-muted)'],
    ['Unfinished loads', unfinished, 'var(--ui-warning)'],
    ['Finalized loads', (Number(statusCounts.Dispatched) || 0) + (Number(statusCounts.Delivered) || 0), 'var(--ui-success)'],
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
  const chartLabel = `${count(total)} total loads: ${statuses.map(([label, value]) => `${label} ${count(value)}`).join(', ')}`;

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
