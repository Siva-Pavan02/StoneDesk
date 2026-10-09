import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { money } from "../../utils/pilotDraft.js";
import { Button, Card } from "./Controls.jsx";
import Icon from "./Icon.jsx";
import DashboardAnalytics from "./DashboardAnalytics.jsx";

export default function LoadHub({
  loads,
  view,
  query,
  onOpen,
  onRefresh,
  onLoadMore,
  hasMore,
  loading,
  recovery,
  onContinue,
  onNavigate,
  updatedAt,
  analytics,
  onRetryAnalytics,
}) {
  const { pick } = useLanguage();
  const [filter, setFilter] = useState("all");
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [refreshPhase, setRefreshPhase] = useState("idle");
  const doneTimer = useRef(null);
  useEffect(() => () => clearTimeout(doneTimer.current), []);
  async function handleRefresh() {
    clearTimeout(doneTimer.current);
    setRefreshPhase("refreshing");
    await Promise.all([
      onRefresh(),
      new Promise((resolve) => setTimeout(resolve, 700)),
    ]);
    setRefreshPhase("done");
    doneTimer.current = setTimeout(() => setRefreshPhase("idle"), 1800);
  }
  const refreshBusy =
    refreshPhase === "refreshing" ||
    (loading && refreshPhase === "idle" && !loads.length);
  const drafts = loads.filter((l) => l.status === "Draft");
  const transit = loads.filter((l) => l.status === "Dispatched");
  const invoices = loads.filter((l) => l.status !== "Draft");
  const search = query.trim().toLowerCase();
  const filtered = loads.filter(
    (l) =>
      (view !== "invoices" || l.status !== "Draft") &&
      (!priorityOnly || view !== "home" || l.status === "Draft") &&
      (filter === "all" || l.status === filter) &&
      [
        l.partyName,
        l.logistics?.truckNumber,
        l.dispatchSlipNumber,
        l.logistics?.buyerDestination,
      ].some((s) => s?.toLowerCase().includes(search)),
  );
  const titles = {
    home: ["Your yard, at a glance", "మీ యార్డ్ వివరాలు"],
    entries: ["Loading entries", "లోడ్ వివరాలు"],
    monitor: ["Monitor & dispatch", "లోడ్ మానిటర్"],
    invoices: ["Invoices", "బిల్లులు"],
  };
  const heading = titles[view] || titles.home;
  const visible = view === "home" ? filtered.slice(0, 5) : filtered;
  const stateLabel = (item) =>
    pick(
      item.status === "Draft"
        ? "Draft"
        : item.status === "Delivered"
          ? "Delivered"
          : "In transit",
      item.status === "Draft"
        ? "డ్రాఫ్ట్"
        : item.status === "Delivered"
          ? "డెలివరీ అయింది"
          : "ప్రయాణంలో",
    );
  return (
    <div className={view === "home" ? "dashboard-home" : "space-y-5"}>
      <header className={view === "home" ? "dashboard-heading" : ""}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {pick(...heading)}
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            {view === "invoices"
              ? pick(
                  "Final bills. Original values. Ready to share.",
                  "ఖరారు చేసిన బిల్లులు. అసలు మొత్తాలు. షేర్ చేయడానికి సిద్ధం.",
                )
              : pick(
                  "From the first measurement to the final bill.",
                  "మొదటి కొలత నుండి చివరి బిల్లు వరకు.",
                )}
          </p>
        </div>
        {view === "entries" && (
          <Button
            className="pill-button"
            en="Loading requirements"
            te="లోడింగ్ అవసరాలు"
            onClick={() => onNavigate("requirements")}
          />
        )}
      </header>
      {view === "home" && (
        <>
          {recovery && (
            <Card className="gap-3 border-l-4 border-l-teal-700">
              <h2 className="font-bold">
                {pick("Pick up where you left off", "మీ లోడ్ కొనసాగించండి")}
              </h2>
              <p className="text-sm text-gray-700 break-words">
                {recovery.partyName ||
                  recovery.truckNumber ||
                  pick(
                    "An unfinished load is saved on this phone.",
                    "ఈ ఫోన్‌లో పూర్తి కాని లోడ్ సేవ్ అయింది.",
                  )}
              </p>
              <Button
                en="Continue unsaved load"
                te="లోడ్ కొనసాగించండి"
                onClick={onContinue}
              />
            </Card>
          )}
          <div className="dashboard-overview">
            <div className="surface-bezel dashboard-priority-shell">
              <section
                className="dashboard-priority"
                aria-labelledby="priority-heading"
              >
                <div className="dashboard-priority-top">
                  <span className="surface-kicker">
                    {pick("Needs your attention", "మీ తనిఖీ అవసరం")}
                  </span>
                  <span className="priority-icon">
                    <Icon name="loads" />
                  </span>
                </div>
                <h2 id="priority-heading">
                  <strong>{drafts.length}</strong>
                  <span>
                    {pick("drafts to review", "తనిఖీ చేయవలసిన డ్రాఫ్ట్‌లు")}
                  </span>
                </h2>
                <p>
                  {drafts.length
                    ? pick(
                        "Check measurements and rates before the next dispatch.",
                        "తదుపరి డిస్పాచ్‌కు ముందు కొలతలు మరియు ధరలు తనిఖీ చేయండి.",
                      )
                    : pick(
                        "Nothing waiting for review. Your saved loads are up to date.",
                        "తనిఖీ కోసం ఏమీ లేదు. మీ సేవ్ చేసిన లోడ్లు తాజాగా ఉన్నాయి.",
                      )}
                </p>
                <button
                  type="button"
                  disabled={!drafts.length}
                  aria-pressed={priorityOnly}
                  className="dashboard-priority-action"
                  onClick={() => setPriorityOnly((value) => !value)}
                >
                  {priorityOnly
                    ? pick("Show recent loads", "ఇటీవలి లోడ్లు చూడండి")
                    : pick("Review drafts below", "క్రింద డ్రాఫ్ట్‌లు చూడండి")}
                  <span className="action-icon-disc">
                    <Icon name="arrow" />
                  </span>
                </button>
              </section>
            </div>
            <div className="dashboard-supporting">
              <section className="dashboard-support-metric">
                <div className="dashboard-metric-label">
                  <span>{pick("Lorries in transit", "ప్రయాణంలో లారీలు")}</span>
                  <Icon name="truck" />
                </div>
                <strong className="dashboard-metric-value">
                  {transit.length}
                </strong>
                <button
                  type="button"
                  className="dashboard-metric-link"
                  onClick={() => onNavigate("monitor")}
                >
                  {pick("Monitor dispatch", "లోడ్ మానిటర్")}
                  <Icon name="arrow" />
                </button>
              </section>
              <section className="dashboard-support-metric">
                <div className="dashboard-metric-label">
                  <span>
                    {pick(
                      "Billed · loaded records",
                      "బిల్లులు · లోడ్ చేసిన రికార్డులు",
                    )}
                  </span>
                  <Icon name="bill" />
                </div>
                <strong className="dashboard-metric-value">
                  {money(
                    invoices.reduce(
                      (sum, l) => sum + l.summary.netBillableAmount,
                      0,
                    ),
                  )}
                </strong>
                <button
                  type="button"
                  className="dashboard-metric-link"
                  onClick={() => onNavigate("invoices")}
                >
                  {pick("View invoices", "బిల్లులు చూడండి")}
                  <Icon name="arrow" />
                </button>
              </section>
            </div>
          </div>
          {analytics && (
            <DashboardAnalytics
              analytics={analytics}
              onRetry={onRetryAnalytics}
            />
          )}
        </>
      )}
      <section
        className={view === "home" ? "dashboard-activity" : "space-y-5"}
        aria-labelledby="load-hub-records-heading"
      >
        <div
          className={`flex items-center justify-between gap-3 ${view === "home" ? "dashboard-activity-heading" : ""}`}
        >
          <h2 id="load-hub-records-heading" className="font-bold">
            {view === "home"
              ? priorityOnly
                ? pick("Drafts to review", "తనిఖీ చేయవలసినవి")
                : pick("Recent loads", "ఇటీవలి లోడ్లు")
              : `${filtered.length} ${pick("records", "రికార్డులు")}`}
          </h2>
          <button
            type="button"
            disabled={loading || refreshPhase === "refreshing"}
            aria-busy={refreshBusy}
            className="text-button refresh-button flex items-center gap-2 text-sm"
            onClick={handleRefresh}
          >
            <span className={refreshBusy ? "refresh-spin" : ""}>
              <Icon name={refreshPhase === "done" ? "check" : "refresh"} />
            </span>
            <span aria-live="polite">
              {refreshBusy
                ? pick("Refreshing…", "లోడ్ అవుతోంది…")
                : refreshPhase === "done"
                  ? pick("Updated", "నవీకరించబడింది")
                  : pick("Refresh", "రిఫ్రెష్")}
            </span>
          </button>
        </div>
        {loading && !loads.length && (
          <div
            className="records-skeleton"
            role="status"
            aria-label={pick("Loading records", "రికార్డులు లోడ్ అవుతున్నాయి")}
          >
            <div />
            <div />
            <div />
          </div>
        )}
        {view !== "home" && view !== "invoices" && (
          <div
            className="load-filters"
            aria-label={pick("Filter loads", "లోడ్ ఫిల్టర్")}
          >
            {[
              ["all", "All loads", "అన్ని లోడ్లు"],
              ["Draft", "Draft", "డ్రాఫ్ట్"],
              ["Dispatched", "In transit", "ప్రయాణంలో"],
              ["Delivered", "Delivered", "డెలివరీ అయింది"],
            ].map(([value, en, te]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`min-h-12 rounded-xl border-2 px-3 text-sm font-semibold ${filter === value ? "bg-teal-800 border-teal-800 text-white" : "bg-white border-gray-300"}`}
              >
                {pick(en, te)}
              </button>
            ))}
          </div>
        )}
        {view === "monitor" && (
          <p className="text-sm text-gray-700">
            {pick(
              "Saved drafts keep your measurements. Finalize a bill to dispatch the load.",
              "సేవ్ చేసిన డ్రాఫ్ట్‌లలో మీ కొలతలు ఉంటాయి. డిస్పాచ్ కోసం బిల్లును ఖరారు చేయండి.",
            )}
          </p>
        )}
        {!loading && !filtered.length && (
          <Card
            className={`items-start gap-4 py-7 ${view === "home" ? "dashboard-empty" : ""}`}
          >
            <span className={view === "home" ? "dashboard-empty-icon" : ""}>
              <Icon
                name={view === "invoices" ? "bill" : "truck"}
                className="h-8 w-8 text-teal-800"
              />
            </span>
            <h3 className="text-lg font-bold">
              {search || filter !== "all" || priorityOnly
                ? pick("No matching loads", "లోడ్లు కనబడలేదు")
                : view === "invoices"
                  ? pick(
                      "Your first bill starts with a load",
                      "మొదటి బిల్లు లోడ్‌తో ప్రారంభమవుతుంది",
                    )
                  : pick(
                      "A fresh page for your yard",
                      "మీ యార్డ్ కోసం కొత్త పేజీ",
                    )}
            </h3>
            <p className="text-gray-700">
              {search || filter !== "all" || priorityOnly
                ? pick(
                    "Try another search or choose a different filter.",
                    "వేరొక పదంతో వెతకండి లేదా మరో ఫిల్టర్ ఎంచుకోండి.",
                  )
                : pick(
                    "Use New load in the header to add measurements and prepare a bill.",
                    "కొలతలు జోడించి బిల్లు సిద్ధం చేయడానికి హెడర్‌లో కొత్త లోడ్ ఎంచుకోండి.",
                  )}
            </p>
          </Card>
        )}
        {view === "home" && visible.length > 0 && (
          <div className="desktop-load-table table-scroll">
            <table className="business-table">
              <caption className="sr-only">
                {pick("Recent saved loads", "ఇటీవల సేవ్ చేసిన లోడ్లు")}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{pick("Lorry / party", "లారీ / పార్టీ")}</th>
                  <th scope="col">{pick("Status", "స్థితి")}</th>
                  <th scope="col">{pick("Date", "తేదీ")}</th>
                  <th scope="col" className="numeric">
                    {pick("Area (sq ft)", "విస్తీర్ణం (చ.అ.)")}
                  </th>
                  <th scope="col" className="numeric">
                    {pick("Amount", "మొత్తం")}
                  </th>
                  <th scope="col">
                    <span className="sr-only">
                      {pick("Open load", "లోడ్ తెరవండి")}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">
                      <strong>{item.logistics.truckNumber}</strong>
                      <span className="record-party">
                        {item.partyName || item.logistics.buyerDestination}
                      </span>
                    </th>
                    <td>
                      <span
                        className={`status-tag status-${item.status.toLowerCase()}`}
                      >
                        {stateLabel(item)}
                      </span>
                    </td>
                    <td>
                      {new Date(item.date).toLocaleDateString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </td>
                    <td className="numeric">
                      {item.summary.totalDispatchVolumeSqFt}
                    </td>
                    <td className="numeric">
                      {money(item.summary.netBillableAmount)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-open-button"
                        aria-label={pick(
                          `Open load ${item.logistics.truckNumber}`,
                          `${item.logistics.truckNumber} లోడ్ తెరవండి`,
                        )}
                        onClick={() => onOpen(item.id)}
                      >
                        <Icon name="arrow" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {visible.map((item) => {
          const itemId = item.id;
          return (
            <Card
              key={itemId}
              className={`load-record gap-3 ${view === "home" ? "mobile-load-record" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-bold">
                    {item.logistics.truckNumber}
                  </h3>
                  <p className="mt-1 break-words text-sm text-gray-700">
                    {item.partyName || item.logistics.buyerDestination}
                  </p>
                </div>
                <span
                  className={`status-tag status-${item.status.toLowerCase()}`}
                >
                  {view === "invoices"
                    ? pick("Billed", "బిల్లు సిద్ధం")
                    : stateLabel(item)}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-gray-200 pt-3 text-sm">
                <span>
                  {new Date(item.date).toLocaleDateString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  · {item.summary.totalDispatchVolumeSqFt}{" "}
                  {pick("sq ft", "చ.అ.")}
                </span>
                <strong className="tabular-nums">
                  {money(item.summary.netBillableAmount)}
                </strong>
              </div>
              <Button
                className="w-full justify-between"
                en={
                  item.status === "Draft"
                    ? "Review draft"
                    : view === "monitor"
                      ? "Open dispatch"
                      : "View invoice"
                }
                te={
                  item.status === "Draft" ? "డ్రాఫ్ట్ చూడండి" : "బిల్లు చూడండి"
                }
                onClick={() => onOpen(itemId)}
              >
                <Icon name="arrow" />
              </Button>
            </Card>
          );
        })}
        {view !== "home" && hasMore && (
          <Button
            className="w-full"
            en="Load more"
            te="మరిన్ని చూడండి"
            onClick={onLoadMore}
            disabled={loading}
          />
        )}
        {view === "home" && loads.length > 5 && (
          <Button
            className="w-full"
            en="View all loads"
            te="అన్ని లోడ్లు చూడండి"
            onClick={() => onNavigate("entries")}
          />
        )}
      </section>
      {updatedAt && (
        <p
          className={`text-xs text-gray-600 ${view === "home" ? "dashboard-updated" : ""}`}
        >
          {pick("Updated", "నవీకరించబడింది")}{" "}
          {new Date(updatedAt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {view === "monitor"
            ? pick(
                " · refreshes every 30 seconds",
                " · ప్రతి 30 సెకన్లకు నవీకరణ",
              )
            : ""}
        </p>
      )}
    </div>
  );
}
