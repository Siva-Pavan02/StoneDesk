import { money } from '../../utils/pilotDraft.js';
import Icon from './Icon.jsx';

const zone = 'Asia/Kolkata';

function change(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default function DashboardAnalytics({ analytics, onRetry }) {
  const locale = 'en-IN';
  const countFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const count = value => countFormat.format(Number(value));
  const day = (value, options) => new Date(`${value}T00:00:00+05:30`).toLocaleDateString(locale, { timeZone: zone, ...options });
  const short = value => day(value, { day: 'numeric', month: 'short' });
  const { data, error, loading } = analytics;

  const heading = <div className="analytics-heading">
    <div>
      <h2 id="analytics-heading">Last 30 days</h2>
      <p>{data ? `${short(data.period.from)} – ${short(data.period.to)}` : 'Dispatched and delivered loads'}</p>
    </div>
    <span className="analytics-note">Billed, not cash collected</span>
  </div>;

  if (!data && loading) return <section className="dashboard-analytics" aria-labelledby="analytics-heading" aria-busy="true">{heading}<div className="analytics-skeleton" role="status" aria-label="Loading analytics"><div /><div /><div /><div /></div></section>;
  if (!data) return <section className="dashboard-analytics" aria-labelledby="analytics-heading">{heading}<div className="analytics-state" role="alert"><p>Analytics could not be loaded. Your loads and bills are not affected.</p><button type="button" className="text-button flex items-center gap-2 text-sm" onClick={onRetry}><Icon name="refresh" />Try again</button></div></section>;

  const { current, previous, daily, topDestinations, statusCounts, unreadable } = data;
  const delta = change(current.billed, previous.billed);
  const peak = Math.max(...daily.map(point => point.billed), 0);
  const billedDays = daily.filter(point => point.loads);
  const empty = !current.finalizedLoads;
  const deltaLabel = delta === null
    ? current.billed ? 'No billing in the earlier 30 days' : ''
    : 'vs earlier 30 days';
  const deltaPercent = delta === null ? '' : `${delta > 0 ? '+' : ''}${delta}%`;
  const chartLabel = `Daily billed amount for the last 30 days. Total ${money(current.billed)} across ${current.finalizedLoads} loads.`;

  return <section className="dashboard-analytics" aria-labelledby="analytics-heading" aria-busy={loading}>
    {heading}
    {error && <div className="analytics-state analytics-state-inline" role="alert"><p>Showing earlier figures. Refresh failed.</p><button type="button" className="text-button text-sm" onClick={onRetry}>Try again</button></div>}
    {empty ? <div className="analytics-state"><p>No dispatched or delivered loads in the last 30 days yet. Totals appear here once a bill is finalized.</p></div> : <>
      <dl className="analytics-stats">
        <div className="analytics-stat analytics-stat-lead"><dt>Billed</dt><dd>{money(current.billed)}</dd>{deltaLabel && <span className="analytics-delta">{deltaPercent && <span className={`analytics-delta-chip ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}`}>{deltaPercent}</span>} {deltaLabel}</span>}</div>
        <div className="analytics-stat"><dt>Finalized loads</dt><dd>{count(current.finalizedLoads)}</dd><span className="analytics-delta">{`${count(previous.finalizedLoads)} earlier`}</span></div>
        <div className="analytics-stat"><dt>Area dispatched</dt><dd>{count(current.areaSqFt)}<small> sq ft</small></dd></div>
        <div className="analytics-stat"><dt>Pieces</dt><dd>{count(current.pieces)}</dd></div>
      </dl>
      <div className="analytics-body">
        <figure className="analytics-chart">
          <div className="analytics-bars" role="img" aria-label={chartLabel}>
            {daily.map(point => <span key={point.date} className={point.billed ? 'analytics-bar has-value' : 'analytics-bar'} style={{ height: point.billed && peak ? `${Math.max(6, (point.billed / peak) * 100)}%` : undefined }} title={`${short(point.date)}: ${money(point.billed)}`} />)}
          </div>
          <figcaption><span>{short(data.period.from)}</span><span>Peak day {money(peak)}</span><span>{short(data.period.to)}</span></figcaption>
          <details className="analytics-table">
            <summary>View daily values</summary>
            <table className="business-table"><thead><tr><th scope="col">Date</th><th scope="col">Loads</th><th scope="col">Billed</th></tr></thead><tbody>{billedDays.map(point => <tr key={point.date}><th scope="row">{day(point.date, { day: 'numeric', month: 'short', year: 'numeric' })}</th><td className="numeric">{count(point.loads)}</td><td className="numeric">{money(point.billed)}</td></tr>)}</tbody></table>
          </details>
        </figure>
        <div className="analytics-insights">
          <h3>Insights</h3>
          <ul>
            <li><span>Average per load</span><strong>{money(current.averageBilled)}</strong></li>
            <li><span>Drafts in this period</span><strong>{statusCounts.Draft}</strong></li>
            <li><span>Delivered</span><strong>{statusCounts.Delivered}</strong></li>
          </ul>
          {!!topDestinations.length && <>
            <h3>Top destinations</h3>
            <ol>{topDestinations.map(item => <li key={item.name}><span>{item.name}<small>{`${item.loads} loads`}</small></span><strong>{money(item.billed)}</strong></li>)}</ol>
          </>}
          {unreadable > 0 && <p className="analytics-warning" role="note">{`${unreadable} loads have unreadable totals and are not included.`}</p>}
        </div>
      </div>
    </>}
  </section>;
}
