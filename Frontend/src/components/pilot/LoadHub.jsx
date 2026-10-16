import { useEffect, useRef, useState } from "react";
import { money } from "../../utils/pilotDraft.js";
import { Button, Card } from "./Controls.jsx";
import Icon from "./Icon.jsx";
import DashboardAnalytics from "./DashboardAnalytics.jsx";

// Hash links: let Cmd/Ctrl/Shift/middle-click open a new tab, handle plain clicks in-app.
const isPlainClick = (e) =>
  e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
// The table and the mobile cards render the same controls; focus the copy that is on screen.
function focusShown(selector) {
  requestAnimationFrame(() => {
    const target = [...document.querySelectorAll(selector)].find(
      (element) => element.getClientRects().length > 0,
    );
    target?.focus();
  });
}

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
  recoveries = [],
  maxDrafts = 5,
  onContinue,
  onDeleteRecovery,
  onNavigate,
  onNew,
  updatedAt,
  analytics,
  onRetryAnalytics,
  admin = false,
  onDelete,
}) {
  const locale = "en-IN";
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
  // Several loads are often started the same day, so today's show the time.
  const timeFormat = new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });
  const savedLabel = (value) => {
    const at = new Date(value);
    const sameDay = (a, b) =>
      dateFormat.format(a) === dateFormat.format(b);
    return sameDay(at, new Date(now))
      ? `${"today"} ${timeFormat.format(at)}`
      : `${loadDate(value)} ${timeFormat.format(at)}`;
  };
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
  // Per-row confirm toggle, one delete in flight. Anyone may delete a draft;
  // only admins may delete finalized invoices (the API enforces both).
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const canDelete = (item) =>
    typeof onDelete === "function" && (item.status === "Draft" || admin);
  async function confirmDelete(id, isDraft) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await onDelete(id);
      setConfirmId(null);
      focusShown("#workspace-main");
    } catch (err) {
      const message = isDraft
        ? err?.status === 409
          ? "This draft was finalized or changed. Refresh and try again."
          : err?.status === 403
            ? "You are not permitted to delete this draft."
            : err?.message ||
              "Could not delete the draft."
        : err?.status === 409
          ? "This load changed. Refresh and try again."
          : err?.status === 403
            ? "Only an Admin can delete this load."
            : err?.message ||
              "Could not delete the invoice. Check your connection and try again.";
      setDeleteError({ id, message });
    } finally {
      setDeletingId(null);
    }
  }
  function openConfirm(id) {
    setConfirmId(id);
    setDeleteError(null);
    focusShown(`[data-delete-cancel="${id}"]`);
  }
  function cancelConfirm(id) {
    setConfirmId(null);
    setDeleteError(null);
    focusShown(`[data-delete-trigger="${id}"]`);
  }
  // Unsaved phone drafts use the same inline confirm as invoice rows.
  const [confirmRecovery, setConfirmRecovery] = useState(null);
  async function deleteRecovery(item) {
    const deleted = await onDeleteRecovery(item);
    setConfirmRecovery(null);
    if (deleted === false)
      focusShown(`[data-recovery-trigger="${item.clientRequestId}"]`);
    else focusShown("#resume-heading, #workspace-main");
  }
  // Navigation stays a real link (new tab, copy address) while plain clicks stay in-app.
  const billLink = (id) => ({
    href: `#bill/${id}`,
    onClick: (event) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      onOpen(id);
    },
  });
  const pageLink = (target) => ({
    href: `#${target}`,
    onClick: (event) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      onNavigate(target);
    },
  });
  const deleteControl = (item) => {
    if (!canDelete(item)) return null;
    const busy = deletingId === item.id;
    const lorry = item.logistics?.truckNumber || "";
    const isDraft = item.status === "Draft";
    const label = [lorry, item.partyName].filter(Boolean).join(" ");
    const error = deleteError?.id === item.id ? deleteError.message : "";
    return (
      <div className="load-delete" data-state={confirmId === item.id ? "confirming" : "idle"}>
        {confirmId === item.id ? (
          <>
            <span className="load-delete-question" role="status">
              {isDraft
                ? "Delete this draft?"
                : "Delete this invoice and its payments?"}
            </span>
            <button
              type="button"
              className="btn control-button control-button-danger load-delete-confirm"
              disabled={busy}
              aria-busy={busy}
              onClick={(event) => {
                event.stopPropagation();
                confirmDelete(item.id, isDraft);
              }}
            >
              {busy
                ? "Deleting…"
                : "Yes, delete"}
              <span className="sr-only">{` ${lorry}`}</span>
            </button>
            <button
              type="button"
              className="btn control-button control-button-secondary load-delete-cancel"
              data-delete-cancel={item.id}
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                cancelConfirm(item.id);
              }}
            >
              {"Cancel"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="icon-delete-button"
            data-delete-trigger={item.id}
            disabled={deletingId !== null}
            aria-label={
              isDraft
                ? `Delete draft ${label}`
                : `Delete invoice ${lorry}`
            }
            title="Delete"
            onClick={(event) => {
              event.stopPropagation();
              openConfirm(item.id);
            }}
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
        )}
        {error && (
          <p role="alert" className="control-error load-delete-error">
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
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
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
    home: "Your yard, at a glance",
    entries: "Loading entries",
  };
  const heading = titles[view] || titles.home;
  const visible = view === "home" ? filtered.slice(0, 5) : filtered;
  const stateLabel = (item) =>
    item.status === "Draft"
        ? "Draft"
        : item.status === "Delivered"
          ? "Delivered"
          : "In transit";
  return (
    <div className={view === "home" ? "dashboard-home" : "space-y-5"}>
      <header className={view === "home" ? "dashboard-heading" : ""}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-on-surface">
            {"From the first measurement to the final bill."}
          </p>
        </div>
      </header>
      {view === "home" && (
        <>
          {recoveries.length > 0 && (
            <section
              className="dashboard-resume-list"
              aria-labelledby="resume-heading"
            >
              <div className="dashboard-resume-top">
                <h2 id="resume-heading" className="surface-kicker" tabIndex={-1}>
                  {"Pick up where you left off"}
                </h2>
                <span className="priority-status is-pending">
                  {`${recoveries.length} of ${maxDrafts} unsaved`}
                </span>
              </div>
              <ul className="dashboard-resume-items">
                {recoveries.map((item, index) => {
                  const name =
                    item.partyName ||
                    item.truckNumber ||
                    "Unfinished load";
                  return (
                    <li key={item.clientRequestId} className="dashboard-resume" style={{ "--index": index }}>
                      <div className="dashboard-resume-text">
                        <p className="dashboard-resume-name">{name}</p>
                        <p className="queue-sub">
                          {item.rows.length} {"rows"}
                          {item.truckNumber && item.partyName ? ` · ${item.truckNumber}` : ""}
                          {item.savedAt
                            ? ` · ${"saved"} ${savedLabel(item.savedAt)}`
                            : ""}
                        </p>
                      </div>
                      <div className="dashboard-resume-actions">
                        {confirmRecovery === item.clientRequestId ? (
                          <div className="load-delete" data-state="confirming">
                            <span className="load-delete-question" role="status">
                              {item.serverId
                                ? "Discard the unsaved changes on this phone? The saved draft stays in your loads."
                                : "Delete this unsaved load?"}
                            </span>
                            <button
                              type="button"
                              className="btn control-button control-button-danger load-delete-confirm"
                              onClick={() => deleteRecovery(item)}
                            >
                              {"Yes, delete"}
                              <span className="sr-only">{` ${name}`}</span>
                            </button>
                            <button
                              type="button"
                              className="btn control-button control-button-secondary load-delete-cancel"
                              data-recovery-cancel={item.clientRequestId}
                              onClick={() => {
                                setConfirmRecovery(null);
                                focusShown(`[data-recovery-trigger="${item.clientRequestId}"]`);
                              }}
                            >
                              {"Cancel"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="icon-delete-button dashboard-resume-delete"
                            data-recovery-trigger={item.clientRequestId}
                            aria-label={`Delete unsaved load ${name}`}
                            title="Delete"
                            onClick={() => {
                              setConfirmRecovery(item.clientRequestId);
                              focusShown(`[data-recovery-cancel="${item.clientRequestId}"]`);
                            }}
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        )}
                        {confirmRecovery !== item.clientRequestId && <Button
                          className="dashboard-resume-action"
                          label="Continue"
                          aria-label={`Continue ${name}`}
                          onClick={() => onContinue(item)}
                        >
                          <Icon name="arrow" className="h-4 w-4" />
                        </Button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <div className="dashboard-overview">
            <section
              className="dashboard-priority"
              aria-labelledby="priority-heading"
            >
              <div className="dashboard-priority-top">
                <span className="surface-kicker">
                  {"Needs your attention"}
                </span>
                <span
                  className={`priority-status ${drafts.length ? "is-pending" : "is-clear"}`}
                >
                  {drafts.length
                    ? "Pending"
                    : "Up to date"}
                </span>
              </div>
              {onNew && (
                <button
                  type="button"
                  className="dashboard-create-load"
                  onClick={onNew}
                >
                  <Icon name="plus" />
                  <span>{"Create load"}</span>
                </button>
              )}
              <h2 id="priority-heading">
                <strong>{drafts.length}</strong>
                <span>
                  {"drafts to review"}
                </span>
              </h2>
              {oldestDrafts.length ? (
                <ul className="dashboard-queue">
                  {oldestDrafts.map((item) => (
                    <li key={item.id}>
                      <a
                        className="dashboard-queue-row"
                        {...billLink(item.id)}
                      >
                        <span className="queue-main">
                          <span className="queue-lorry" translate="no">
                            {item.logistics?.truckNumber || "—"}
                          </span>
                          <span className="queue-sub">
                            {item.partyName || "No party"}
                            {" · "}
                            {loadArea(item.summary?.totalDispatchVolumeSqFt)}{" "}
                            {"sq ft"}
                          </span>
                        </span>
                        <span className="queue-side">
                          <span className="queue-amount">
                            {money(item.summary?.netBillableAmount || 0)}
                          </span>
                          <span className="queue-sub">{age(item.date)}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-queue-empty">
                  {"Nothing waiting for review."}
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
                    ? "Show recent loads"
                    : `Show all ${drafts.length} drafts below`}
                  <span className="action-icon-disc">
                    <Icon name="arrow" />
                  </span>
                </button>
              )}
            </section>
            <div className="dashboard-supporting">
              <section className="dashboard-support-metric" aria-labelledby="road-metric-label">
                <div className="dashboard-metric-label">
                  <span id="road-metric-label">
                    {"On the road"} · {transit.length}
                  </span>
                  <Icon name="truck" />
                </div>
                {roadLoads.length ? (
                  <ul className="dashboard-queue">
                    {roadLoads.map((item) => {
                      const days = daysSince(item.date);
                      return (
                        <li key={item.id}>
                          <a
                            className="dashboard-queue-row"
                            {...billLink(item.id)}
                          >
                            <span className="queue-main">
                              <span className="queue-lorry" translate="no">
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
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="dashboard-queue-empty">
                    {"No lorries on the road."}
                  </p>
                )}
                <a
                  className="dashboard-metric-link"
                  {...pageLink("entries?status=Dispatched")}
                >
                  {"Loads in transit"}
                  <Icon name="arrow" />
                </a>
              </section>
              <section className="dashboard-support-metric" aria-labelledby="billed-metric-label">
                <div className="dashboard-metric-label">
                  <span id="billed-metric-label">{"Billed this month"}</span>
                  <Icon name="bill" />
                </div>
                <strong className="dashboard-metric-value">
                  {money(sumBilled(monthBills))}
                </strong>
                <p className="queue-sub">
                  {`${monthBills.length} bills · ${money(sumBilled(invoices))} all time`}
                </p>
                <a
                  className="dashboard-metric-link"
                  {...pageLink("entries")}
                >
                  {"All loads"}
                  <Icon name="arrow" />
                </a>
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
          aria-label="Filter loads"
        >
          {[
            ["all", "All", loads.length],
            ["Draft", "Draft", drafts.length],
            ["Dispatched", "In transit", transit.length],
            [
              "Delivered",
              "Delivered",
              loads.filter((l) => l.status === "Delivered").length,
            ],
          ].map(([value, label, count]) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              data-tone={value}
              onClick={() => setFilter(value)}
              className="load-filter"
            >
              {label}
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
                ? "Drafts to review"
                : "Recent loads"
              : `${filtered.length} ${"records"}`}
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
                ? "Refreshing…"
                : refreshPhase === "done"
                  ? "Updated"
                  : "Refresh"}
            </span>
          </button>
        </div>
        {loading && !loads.length && (
          <div
            className="records-skeleton"
            role="status"
            aria-label="Loading records"
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
                className="h-8 w-8 text-primary"
              />
            </span>
            <h3 className="text-lg font-bold">
              {search || priorityOnly
                ? "No matching loads"
                : view === "entries" && filter === "Dispatched"
                  ? "No lorries on the road"
                  : view === "entries" && filter === "Draft"
                    ? "No drafts"
                    : view === "entries" && filter === "Delivered"
                      ? "No deliveries yet"
                      : "A fresh page for your yard"}
            </h3>
            <p className="text-on-surface">
              {search || priorityOnly
                ? "Try another search or choose a different filter."
                : view === "entries" && filter === "Dispatched"
                  ? "Finalize a bill to dispatch a load. It will appear here until it is delivered."
                  : "Use New load in the header to add measurements and prepare a bill."}
            </p>
          </Card>
        )}
        {visible.length > 0 && (
          <div className="desktop-load-table table-scroll">
            <table className="business-table">
              <caption className="sr-only">
                {view === "home"
                  ? "Recent saved loads"
                  : "Loading entries"}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{"Lorry / party"}</th>
                  <th scope="col">{"Status"}</th>
                  <th scope="col">{"Date"}</th>
                  <th scope="col" className="numeric">
                    {"Area (sq ft)"}
                  </th>
                  <th scope="col" className="numeric">
                    {"Amount"}
                  </th>
                  <th scope="col">
                    <span className="sr-only">
                      {"Actions"}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">
                      <strong translate="no">{item.logistics.truckNumber}</strong>
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
                    <td className="load-actions-cell">
                      <div className="load-actions">
                      {deleteControl(item)}
                      <a
                        className="table-open-button"
                        aria-label={`Open load ${item.logistics.truckNumber}`}
                        {...billLink(item.id)}
                      >
                        <Icon name="arrow" />
                      </a>
                      </div>
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
                  <h3 className="break-words text-lg font-bold" translate="no">
                    {item.logistics.truckNumber}
                  </h3>
                  <p className="mt-1 break-words text-sm text-on-surface">
                    {item.partyName || item.logistics.buyerDestination}
                  </p>
                </div>
                <span
                  className={`status-tag status-${item.status.toLowerCase()}`}
                >
                  {stateLabel(item)}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-outline-variant pt-3 text-sm">
                <span>
                  {loadDate(item.date)} ·{" "}
                  {loadArea(item.summary.totalDispatchVolumeSqFt)}{" "}
                  {"sq ft"}
                </span>
                <strong className="tabular-nums">
                  {money(item.summary.netBillableAmount)}
                </strong>
              </div>
              <div className="load-actions load-actions-card">
                <a
                  className="btn control-button control-button-secondary load-open-wide justify-between"
                  {...billLink(itemId)}
                >
                  <span className="control-label">
                    {item.status === "Draft"
                      ? "Review draft"
                      : "View invoice"}
                  </span>
                  <Icon name="arrow" />
                </a>
                {deleteControl(item)}
              </div>
            </Card>
          );
        })}
        {view === "home" && loads.length > 5 && (
          <a
            className="btn control-button control-button-secondary w-full"
            {...pageLink("entries")}
          >
            <span className="control-label">
              {"View all loads"}
            </span>
          </a>
        )}
      </section>
      {view !== "home" && hasMore && (
        <Button
          className="w-full"
          label={loading ? "Loading…" : "Load more"}
          onClick={onLoadMore}
          disabled={loading}
          aria-busy={loading}
        />
      )}
      {updatedAt && (
        <p
          className={`text-xs text-on-surface-variant ${view === "home" ? "dashboard-updated" : ""}`}
        >
          {"Updated"}{" "}
          {new Intl.DateTimeFormat(locale, {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(updatedAt))}
          {view === "entries"
            ? " · refreshes every 30 seconds"
            : ""}
        </p>
      )}
    </div>
  );
}
