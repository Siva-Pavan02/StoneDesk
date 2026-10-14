import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { money } from "../../utils/pilotDraft.js";
import { Button, Card } from "./Controls.jsx";
import Icon from "./Icon.jsx";
import DashboardAnalytics from "./DashboardAnalytics.jsx";

export default function LoadHub({
  loads,
  view,
  status = "all",
  query,
  onFilterChange,
  onOpen,
  onRefresh,
  onLoadMore,
  hasMore,
  loading,
  recovery,
  onContinue,
  onNavigate,
  onNew,
  updatedAt,
  analytics,
  onRetryAnalytics,
  admin = false,
  onDelete,
}) {
  const { pick, language } = useLanguage();
  const locale = language === "te" ? "te-IN" : "en-IN";
  const dateFormat = new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const areaFormat = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const loadDate = (value) => dateFormat.format(new Date(value));
  const loadArea = (value) => areaFormat.format(Number(value) || 0);
  const [filter, setFilterState] = useState(status);
  const [linkedStatus, setLinkedStatus] = useState(status);
  if (linkedStatus !== status) {
    setLinkedStatus(status);
    setFilterState(status);
  }
  function setFilter(value) {
    setFilterState(value);
    if (onFilterChange) return onFilterChange(value);
    window.history.replaceState(
      null,
      "",
      value === "all" ? "#entries" : `#entries?status=${value}`,
    );
  }
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [refreshPhase, setRefreshPhase] = useState("idle");
  const [now] = useState(() => Date.now());
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
  // Admin-only delete of finalized rows: per-row confirm toggle, one in flight.
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const canDelete = (item) =>
    admin && typeof onDelete === "function" && item.status !== "Draft";
  async function confirmDelete(id) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await onDelete(id);
      setConfirmId(null);
    } catch (err) {
      const message =
        err?.status === 409
          ? pick(
              "This invoice has recorded payments. Remove the payments before deleting.",
              "ఈ బిల్లుకు చెల్లింపులు నమోదయ్యాయి. తొలగించే ముందు చెల్లింపులను తీసివేయండి.",
            )
          : err?.status === 403
            ? pick(
                "You are not permitted to delete invoices.",
                "బిల్లులను తొలగించడానికి మీకు అనుమతి లేదు.",
              )
            : err?.message ||
              pick("Could not delete the invoice.", "బిల్లును తొలగించలేకపోయాము.");
      setDeleteError({ id, message });
    } finally {
      setDeletingId(null);
    }
  }
  const deleteControl = (item) => {
    if (!canDelete(item)) return null;
    const busy = deletingId === item.id;
    const lorry = item.logistics?.truckNumber || "";
    const error = deleteError?.id === item.id ? deleteError.message : "";
    return (
      <div className="load-delete flex flex-wrap items-center justify-end gap-2 text-sm">
        {confirmId === item.id ? (
          <>
            <span className="text-gray-700">
              {pick("Delete this invoice?", "ఈ బిల్లును తొలగించాలా?")}
            </span>
            <button
              type="button"
              className="text-button text-red-700"
              disabled={busy}
              aria-busy={busy}
              onClick={(event) => {
                event.stopPropagation();
                confirmDelete(item.id);
              }}
            >
              {busy
                ? pick("Deleting…", "తొలగిస్తోంది…")
                : pick("Yes, delete", "అవును, తొలగించండి")}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                setConfirmId(null);
                setDeleteError(null);
              }}
            >
              {pick("Cancel", "రద్దు")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="text-button text-red-700"
            disabled={deletingId !== null}
            aria-label={pick(
              `Delete invoice ${lorry}`,
              `${lorry} బిల్లును తొలగించండి`,
            )}
            onClick={(event) => {
              event.stopPropagation();
              setConfirmId(item.id);
              setDeleteError(null);
            }}
          >
            {pick("Delete", "తొలగించు")}
          </button>
        )}
        {error && (
          <p role="alert" className="control-error w-full text-right">
            {error}
          </p>
        )}
      </div>
    );
  };
  const refreshBusy =
    refreshPhase === "refreshing" ||
    (loading && refreshPhase === "idle" && !loads.length);
  const drafts = loads.filter((l) => l.status === "Draft");
  const transit = loads.filter((l) => l.status === "Dispatched");
  const invoices = loads.filter((l) => l.status !== "Draft");
  const byOldest = (a, b) => new Date(a.date) - new Date(b.date);
  const oldestDrafts = [...drafts].sort(byOldest).slice(0, 3);
  const roadLoads = [...transit].sort(byOldest).slice(0, 3);
  const dayKey = (value) =>
    new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const daysSince = (value) =>
    value
      ? Math.max(
          0,
          Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(value))) / 864e5),
        )
      : 0;
  const age = (value) => {
    const days = daysSince(value);
    if (days === 0) return pick("Today", "ఈరోజు");
    if (days === 1) return pick("Yesterday", "నిన్న");
    return pick(`${days} days ago`, `${days} రోజుల క్రితం`);
  };
  const monthKey = dayKey(now).slice(0, 7);
  const monthBills = invoices.filter(
    (l) => l.date && dayKey(l.date).slice(0, 7) === monthKey,
  );
  const sumBilled = (list) =>
    list.reduce((sum, l) => sum + (l.summary?.netBillableAmount || 0), 0);
  const search = query.trim().toLowerCase();
  const filtered = loads.filter(
    (l) =>
      (!priorityOnly || view !== "home" || l.status === "Draft") &&
      (view !== "entries" || filter === "all" || l.status === filter) &&
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
            {pick(
              "From the first measurement to the final bill.",
              "మొదటి కొలత నుండి చివరి బిల్లు వరకు.",
            )}
          </p>
        </div>
      </header>
      {view === "home" && (
        <>
          {recovery && (
            <section
              className="dashboard-resume"
              aria-labelledby="resume-heading"
            >
              <div className="dashboard-resume-text">
                <div className="dashboard-resume-top">
                  <h2 id="resume-heading" className="surface-kicker">
                    {pick("Pick up where you left off", "మీ లోడ్ కొనసాగించండి")}
                  </h2>
                  <span className="priority-status is-pending">
                    {pick("Unsaved", "సేవ్ కాలేదు")}
                  </span>
                </div>
                <p className="dashboard-resume-name">
                  {recovery.partyName ||
                    recovery.truckNumber ||
                    pick(
                      "An unfinished load is saved on this phone.",
                      "ఈ ఫోన్‌లో పూర్తి కాని లోడ్ సేవ్ అయింది.",
                    )}
                </p>
              </div>
              <Button
                className="dashboard-resume-action"
                en="Continue unsaved load"
                te="లోడ్ కొనసాగించండి"
                onClick={onContinue}
              >
                <Icon name="arrow" className="h-4 w-4" />
              </Button>
            </section>
          )}
          <div className="dashboard-overview">
            <section
              className="dashboard-priority"
              aria-labelledby="priority-heading"
            >
              <div className="dashboard-priority-top">
                <span className="surface-kicker">
                  {pick("Needs your attention", "మీ తనిఖీ అవసరం")}
                </span>
                <span
                  className={`priority-status ${drafts.length ? "is-pending" : "is-clear"}`}
                >
                  {drafts.length
                    ? pick("Pending", "పెండింగ్")
                    : pick("Up to date", "తాజాగా ఉంది")}
                </span>
              </div>
              {onNew && (
                <button
                  type="button"
                  className="dashboard-create-load"
                  onClick={onNew}
                >
                  <Icon name="plus" />
                  <span>{pick("Create load", "లోడ్ సృష్టించండి")}</span>
                </button>
              )}
              <h2 id="priority-heading">
                <strong>{drafts.length}</strong>
                <span>
                  {pick("drafts to review", "తనిఖీ చేయవలసిన డ్రాఫ్ట్‌లు")}
                </span>
              </h2>
              {oldestDrafts.length ? (
                <ul className="dashboard-queue">
                  {oldestDrafts.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="dashboard-queue-row"
                        onClick={() => onOpen(item.id)}
                      >
                        <span className="queue-main">
                          <span className="queue-lorry">
                            {item.logistics?.truckNumber || "—"}
                          </span>
                          <span className="queue-sub">
                            {item.partyName || pick("No party", "పార్టీ లేదు")}
                            {" · "}
                            {loadArea(item.summary?.totalDispatchVolumeSqFt)}{" "}
                            {pick("sq ft", "చ.అ.")}
                          </span>
                        </span>
                        <span className="queue-side">
                          <span className="queue-amount">
                            {money(item.summary?.netBillableAmount || 0)}
                          </span>
                          <span className="queue-sub">{age(item.date)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-queue-empty">
                  {pick(
                    "Nothing waiting for review.",
                    "తనిఖీ కోసం ఏమీ లేదు.",
                  )}
                </p>
              )}
              {(drafts.length > 0 || priorityOnly) && (
                <button
                  type="button"
                  aria-pressed={priorityOnly}
                  className="dashboard-priority-action"
                  onClick={() => setPriorityOnly((value) => !value)}
                >
                  {priorityOnly
                    ? pick("Show recent loads", "ఇటీవలి లోడ్లు చూడండి")
                    : pick(
                        `Show all ${drafts.length} drafts below`,
                        `క్రింద మొత్తం ${drafts.length} డ్రాఫ్ట్‌లు చూడండి`,
                      )}
                  <span className="action-icon-disc">
                    <Icon name="arrow" />
                  </span>
                </button>
              )}
            </section>
            <div className="dashboard-supporting">
              <section className="dashboard-support-metric">
                <div className="dashboard-metric-label">
                  <span>
                    {pick("On the road", "ప్రయాణంలో")} · {transit.length}
                  </span>
                  <Icon name="truck" />
                </div>
                {roadLoads.length ? (
                  <ul className="dashboard-queue">
                    {roadLoads.map((item) => {
                      const days = daysSince(item.date);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="dashboard-queue-row"
                            onClick={() => onOpen(item.id)}
                          >
                            <span className="queue-main">
                              <span className="queue-lorry">
                                {item.logistics?.truckNumber || "—"}
                              </span>
                              <span className="queue-sub">
                                {item.logistics?.buyerDestination ||
                                  item.partyName ||
                                  "—"}
                              </span>
                            </span>
                            <span
                              className={`queue-age${days >= 3 ? " is-late" : ""}`}
                            >
                              {age(item.date)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="dashboard-queue-empty">
                    {pick("No lorries on the road.", "ప్రయాణంలో లారీలు లేవు.")}
                  </p>
                )}
                <button
                  type="button"
                  className="dashboard-metric-link"
                  onClick={() => onNavigate("entries?status=Dispatched")}
                >
                  {pick("Loads in transit", "ప్రయాణంలో లోడ్లు")}
                  <Icon name="arrow" />
                </button>
              </section>
              <section className="dashboard-support-metric">
                <div className="dashboard-metric-label">
                  <span>{pick("Billed this month", "ఈ నెల బిల్లులు")}</span>
                  <Icon name="bill" />
                </div>
                <strong className="dashboard-metric-value">
                  {money(sumBilled(monthBills))}
                </strong>
                <p className="queue-sub">
                  {pick(
                    `${monthBills.length} bills · ${money(sumBilled(invoices))} all time`,
                    `${monthBills.length} బిల్లులు · మొత్తం ${money(sumBilled(invoices))}`,
                  )}
                </p>
                <button
                  type="button"
                  className="dashboard-metric-link"
                  onClick={() => onNavigate("entries")}
                >
                  {pick("All loads", "అన్ని లోడ్లు")}
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
      {view === "entries" && (
        <div
          className="load-filters"
          role="group"
          aria-label={pick("Filter loads", "లోడ్ ఫిల్టర్")}
        >
          {[
            ["all", "All", "అన్నీ", loads.length],
            ["Draft", "Draft", "డ్రాఫ్ట్", drafts.length],
            ["Dispatched", "In transit", "ప్రయాణంలో", transit.length],
            [
              "Delivered",
              "Delivered",
              "డెలివరీ అయింది",
              loads.filter((l) => l.status === "Delivered").length,
            ],
          ].map(([value, en, te, count]) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              data-tone={value}
              onClick={() => setFilter(value)}
              className="load-filter"
            >
              {pick(en, te)}
              <span className="load-filter-count">{count}</span>
            </button>
          ))}
        </div>
      )}
      <section
        className="dashboard-activity"
        aria-labelledby="load-hub-records-heading"
      >
        <div className="dashboard-activity-heading flex items-center justify-between gap-3">
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
        {!loading && !filtered.length && (
          <Card className="dashboard-empty items-start gap-4 py-7">
            <span className="dashboard-empty-icon">
              <Icon
                name="truck"
                className="h-8 w-8 text-teal-800"
              />
            </span>
            <h3 className="text-lg font-bold">
              {search || priorityOnly
                ? pick("No matching loads", "లోడ్లు కనబడలేదు")
                : view === "entries" && filter === "Dispatched"
                  ? pick("No lorries on the road", "ప్రయాణంలో లారీలు లేవు")
                  : view === "entries" && filter === "Draft"
                    ? pick("No drafts", "డ్రాఫ్ట్‌లు లేవు")
                    : view === "entries" && filter === "Delivered"
                      ? pick("No deliveries yet", "ఇంకా డెలివరీలు లేవు")
                      : pick(
                          "A fresh page for your yard",
                          "మీ యార్డ్ కోసం కొత్త పేజీ",
                        )}
            </h3>
            <p className="text-gray-700">
              {search || priorityOnly
                ? pick(
                    "Try another search or choose a different filter.",
                    "వేరొక పదంతో వెతకండి లేదా మరో ఫిల్టర్ ఎంచుకోండి.",
                  )
                : view === "entries" && filter === "Dispatched"
                  ? pick(
                      "Finalize a bill to dispatch a load. It will appear here until it is delivered.",
                      "లోడ్ డిస్పాచ్ చేయడానికి బిల్లును ఖరారు చేయండి. డెలివరీ అయ్యే వరకు ఇది ఇక్కడ కనిపిస్తుంది.",
                    )
                  : pick(
                    "Use New load in the header to add measurements and prepare a bill.",
                    "కొలతలు జోడించి బిల్లు సిద్ధం చేయడానికి హెడర్‌లో కొత్త లోడ్ ఎంచుకోండి.",
                  )}
            </p>
          </Card>
        )}
        {visible.length > 0 && (
          <div className="desktop-load-table table-scroll">
            <table className="business-table">
              <caption className="sr-only">
                {view === "home"
                  ? pick("Recent saved loads", "ఇటీవల సేవ్ చేసిన లోడ్లు")
                  : pick("Loading entries", "లోడ్ వివరాలు")}
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
                      {admin
                        ? pick("Actions", "చర్యలు")
                        : pick("Open load", "లోడ్ తెరవండి")}
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
                    <td className="tabular-nums">{loadDate(item.date)}</td>
                    <td className="numeric">
                      {loadArea(item.summary.totalDispatchVolumeSqFt)}
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
                      {deleteControl(item)}
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
              className="load-record mobile-load-record gap-3"
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
                  {stateLabel(item)}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-gray-200 pt-3 text-sm">
                <span>
                  {loadDate(item.date)} ·{" "}
                  {loadArea(item.summary.totalDispatchVolumeSqFt)}{" "}
                  {pick("sq ft", "చ.అ.")}
                </span>
                <strong className="tabular-nums">
                  {money(item.summary.netBillableAmount)}
                </strong>
              </div>
              <Button
                className="w-full justify-between"
                en={item.status === "Draft" ? "Review draft" : "View invoice"}
                te={
                  item.status === "Draft" ? "డ్రాఫ్ట్ చూడండి" : "బిల్లు చూడండి"
                }
                onClick={() => onOpen(itemId)}
              >
                <Icon name="arrow" />
              </Button>
              {deleteControl(item)}
            </Card>
          );
        })}
        {view === "home" && loads.length > 5 && (
          <Button
            className="w-full"
            en="View all loads"
            te="అన్ని లోడ్లు చూడండి"
            onClick={() => onNavigate("entries")}
          />
        )}
      </section>
      {view !== "home" && hasMore && (
        <Button
          className="w-full"
          en="Load more"
          te="మరిన్ని చూడండి"
          onClick={onLoadMore}
          disabled={loading}
        />
      )}
      {updatedAt && (
        <p
          className={`text-xs text-gray-600 ${view === "home" ? "dashboard-updated" : ""}`}
        >
          {pick("Updated", "నవీకరించబడింది")}{" "}
          {new Intl.DateTimeFormat(locale, {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(updatedAt))}
          {view === "entries"
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
