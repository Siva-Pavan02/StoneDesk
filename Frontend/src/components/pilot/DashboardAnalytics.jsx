import { useLanguage } from '../../i18n/LanguageContext';
import { money } from '../../utils/pilotDraft.js';
import Icon from './Icon.jsx';

const zone = 'Asia/Kolkata';
const count = value => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function change(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default function DashboardAnalytics({ analytics, onRetry }) {
  const { pick, language } = useLanguage();
  const locale = language === 'te' ? 'te-IN' : 'en-IN';
  const day = (value, options) => new Date(`${value}T00:00:00+05:30`).toLocaleDateString(locale, { timeZone: zone, ...options });
  const short = value => day(value, { day: 'numeric', month: 'short' });
  const { data, error, loading } = analytics;

  const heading = <div className="analytics-heading">
    <div>
      <h2 id="analytics-heading">{pick('Last 30 days', 'గత 30 రోజులు')}</h2>
      <p>{data ? `${short(data.period.from)} – ${short(data.period.to)}` : pick('Dispatched and delivered loads', 'డిస్పాచ్ మరియు డెలివరీ అయిన లోడ్లు')}</p>
    </div>
    <span className="analytics-note">{pick('Billed, not cash collected', 'బిల్లు చేసినది, వసూలు చేసినది కాదు')}</span>
  </div>;

  if (!data && loading) return <section className="dashboard-analytics" aria-labelledby="analytics-heading" aria-busy="true">{heading}<div className="analytics-skeleton" role="status" aria-label={pick('Loading analytics', 'విశ్లేషణ లోడ్ అవుతోంది')}><div /><div /><div /><div /></div></section>;
  if (!data) return <section className="dashboard-analytics" aria-labelledby="analytics-heading">{heading}<div className="analytics-state" role="alert"><p>{pick('Analytics could not be loaded. Your loads and bills are not affected.', 'విశ్లేషణ లోడ్ కాలేదు. మీ లోడ్లు మరియు బిల్లులపై ప్రభావం లేదు.')}</p><button type="button" className="text-button flex items-center gap-2 text-sm" onClick={onRetry}><Icon name="refresh" />{pick('Try again', 'మళ్ళీ ప్రయత్నించండి')}</button></div></section>;

  const { current, previous, daily, topDestinations, statusCounts, unreadable } = data;
  const delta = change(current.billed, previous.billed);
  const peak = Math.max(...daily.map(point => point.billed), 0);
  const billedDays = daily.filter(point => point.loads);
  const empty = !current.finalizedLoads;
  const deltaLabel = delta === null
    ? current.billed ? pick('No billing in the earlier 30 days', 'ముందటి 30 రోజుల్లో బిల్లులు లేవు') : ''
    : `${delta > 0 ? '+' : ''}${delta}% ${pick('vs earlier 30 days', 'ముందటి 30 రోజులతో పోల్చితే')}`;
  const chartLabel = pick(`Daily billed amount for the last 30 days. Total ${money(current.billed)} across ${current.finalizedLoads} loads.`, `గత 30 రోజుల రోజువారీ బిల్లు మొత్తం. ${current.finalizedLoads} లోడ్లకు మొత్తం ${money(current.billed)}.`);

  return <section className="dashboard-analytics" aria-labelledby="analytics-heading" aria-busy={loading}>
    {heading}
    {error && <div className="analytics-state analytics-state-inline" role="alert"><p>{pick('Showing earlier figures. Refresh failed.', 'పాత వివరాలు చూపిస్తున్నాం. రిఫ్రెష్ విఫలమైంది.')}</p><button type="button" className="text-button text-sm" onClick={onRetry}>{pick('Try again', 'మళ్ళీ ప్రయత్నించండి')}</button></div>}
    {empty ? <div className="analytics-state"><p>{pick('No dispatched or delivered loads in the last 30 days yet. Totals appear here once a bill is finalized.', 'గత 30 రోజుల్లో డిస్పాచ్ లేదా డెలివరీ అయిన లోడ్లు లేవు. బిల్లు ఖరారు చేయగానే మొత్తాలు ఇక్కడ కనిపిస్తాయి.')}</p></div> : <>
      <dl className="analytics-stats">
        <div className="analytics-stat analytics-stat-lead"><dt>{pick('Billed', 'బిల్లు మొత్తం')}</dt><dd>{money(current.billed)}</dd>{deltaLabel && <span className={`analytics-delta ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}`}>{deltaLabel}</span>}</div>
        <div className="analytics-stat"><dt>{pick('Finalized loads', 'ఖరారైన లోడ్లు')}</dt><dd>{count(current.finalizedLoads)}</dd><span className="analytics-delta">{pick(`${count(previous.finalizedLoads)} earlier`, `ముందు ${count(previous.finalizedLoads)}`)}</span></div>
        <div className="analytics-stat"><dt>{pick('Area dispatched', 'డిస్పాచ్ చేసిన విస్తీర్ణం')}</dt><dd>{count(current.areaSqFt)}<small> {pick('sq ft', 'చ.అ.')}</small></dd></div>
        <div className="analytics-stat"><dt>{pick('Pieces', 'ముక్కలు')}</dt><dd>{count(current.pieces)}</dd></div>
      </dl>
      <div className="analytics-body">
        <figure className="analytics-chart">
          <div className="analytics-bars" role="img" aria-label={chartLabel}>
            {daily.map(point => <span key={point.date} className={point.billed ? 'analytics-bar has-value' : 'analytics-bar'} style={{ height: point.billed && peak ? `${Math.max(6, (point.billed / peak) * 100)}%` : undefined }} title={`${short(point.date)}: ${money(point.billed)}`} />)}
          </div>
          <figcaption><span>{short(data.period.from)}</span><span>{pick('Peak day', 'అత్యధిక రోజు')} {money(peak)}</span><span>{short(data.period.to)}</span></figcaption>
          <details className="analytics-table">
            <summary>{pick('View daily values', 'రోజువారీ విలువలు చూడండి')}</summary>
            <table className="business-table"><thead><tr><th scope="col">{pick('Date', 'తేదీ')}</th><th scope="col">{pick('Loads', 'లోడ్లు')}</th><th scope="col">{pick('Billed', 'బిల్లు')}</th></tr></thead><tbody>{billedDays.map(point => <tr key={point.date}><th scope="row">{day(point.date, { day: 'numeric', month: 'short', year: 'numeric' })}</th><td>{point.loads}</td><td>{money(point.billed)}</td></tr>)}</tbody></table>
          </details>
        </figure>
        <div className="analytics-insights">
          <h3>{pick('Insights', 'ముఖ్యాంశాలు')}</h3>
          <ul>
            <li><span>{pick('Average per load', 'లోడ్‌కు సగటు')}</span><strong>{money(current.averageBilled)}</strong></li>
            <li><span>{pick('Drafts in this period', 'ఈ కాలంలో డ్రాఫ్ట్‌లు')}</span><strong>{statusCounts.Draft}</strong></li>
            <li><span>{pick('Delivered', 'డెలివరీ అయినవి')}</span><strong>{statusCounts.Delivered}</strong></li>
          </ul>
          {!!topDestinations.length && <>
            <h3>{pick('Top destinations', 'ప్రధాన గమ్యస్థానాలు')}</h3>
            <ol>{topDestinations.map(item => <li key={item.name}><span>{item.name}<small>{pick(`${item.loads} loads`, `${item.loads} లోడ్లు`)}</small></span><strong>{money(item.billed)}</strong></li>)}</ol>
          </>}
          {unreadable > 0 && <p className="analytics-warning" role="note">{pick(`${unreadable} loads have unreadable totals and are not included.`, `${unreadable} లోడ్ల మొత్తాలు చదవలేనందున చేర్చలేదు.`)}</p>}
        </div>
      </div>
    </>}
  </section>;
}
