import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { deleteDispatch, request, settingsPath } from "../../lib/pilotApi.js";
import {
  fromDispatch,
  newDraft,
  readDrafts,
  clearDraft,
  flushDraft,
  MAX_DRAFTS,
} from "../../utils/pilotDraft.js";
import { BackButton, Button, Card, ErrorMessage } from "./Controls.jsx";
import BusinessSetup from "./BusinessSetup.jsx";
import NewLoad from "./NewLoad.jsx";
import WorkspaceShell from "./WorkspaceShell.jsx";
import LoadHub from "./LoadHub.jsx";
import AccountSettings from "./AccountSettings.jsx";
import { NEW_LOAD_ROUTE, profileSaveTarget, resolveRoute } from "../../utils/workspaceRoutes.js";
const BillView = lazy(() => import("./BillView.jsx"));
const LoadingRequirements = lazy(() => import("../LoadingListScreen.jsx"));
const route = () => {
  const { route: next, replaced } = resolveRoute(window.location.hash.slice(1));
  if (replaced) window.history.replaceState(null, "", "#" + next);
  return next;
};

export default function PilotApp({ user, onLogout, onUserChange }) {
  const [settings, setSettings] = useState(null),
    [loads, setLoads] = useState([]);
  const [view, setView] = useState(route),
    [record, setRecord] = useState(null);
  const [initialDraft, setInitialDraft] = useState(null),
    [query, setQuery] = useState("");
  const [error, setError] = useState(""),
    [historyError, setHistoryError] = useState("");
  const [busy, setBusy] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [updatedAt, setUpdatedAt] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [recoveries, setRecoveries] = useState([]);
  const [analytics, setAnalytics] = useState({
    data: null,
    error: "",
    loading: true,
  });
  const analyticsRequest = useRef(0);
  // Analytics only appear on the dashboard; fetch them there, and again only after loads change.
  const analyticsStale = useRef(true);
  const loadsStale = useRef(true);
  const loadsKey = useRef(null);
  const loadsRequest = useRef(0);
  const loadsInFlight = useRef(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim().slice(0, 120)), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const requestedPage = view.split(/[/?]/)[0];
  const listStatus = requestedPage === 'entries' ? new URLSearchParams(view.split('?')[1] || '').get('status') : null;
  const listParams = new URLSearchParams();
  if (['home', 'entries'].includes(requestedPage) && search) listParams.set('q', search);
  if (listStatus && listStatus !== 'all') listParams.set('status', listStatus);
  const listPath = `/dispatches${listParams.size ? `?${listParams}` : ''}`;
  const admin = user.role === "Admin",
    canFinalize = user.role !== "Yard Manager";
  // Only a missing business name blocks the workspace; New load offers to add the first product.
  const needsSetup = settings && !settings.businessName;
  const current =
    needsSetup && !["settings", "profile"].includes(view)
      ? "profile"
      : view.split(/[/?]/)[0];
  function navigate(target) {
    const next = resolveRoute(target).route;
    window.location.hash = next;
    setView(next);
    setError("");
    window.scrollTo(0, 0);
  }
  const refreshAnalytics = useCallback(async () => {
    const ticket = ++analyticsRequest.current;
    analyticsStale.current = false;
    setAnalytics((prev) => ({ ...prev, error: "", loading: true }));
    try {
      const data = await request("/dispatches/analytics");
      if (ticket === analyticsRequest.current)
        setAnalytics({ data, error: "", loading: false });
    } catch (err) {
      if (ticket === analyticsRequest.current)
        setAnalytics((prev) => ({
          ...prev,
          error: err.message || "Unable to load analytics. Try again.",
          loading: false,
        }));
    }
  }, []);
  const refreshLoads = useCallback(async () => {
    if (loadsInFlight.current?.path === listPath) return;
    const ticket = ++loadsRequest.current;
    const promise = request(listPath);
    loadsInFlight.current = { path: listPath, promise };
    setRefreshing(true);
    try {
      const res = await promise;
      if (ticket !== loadsRequest.current) return;
      setLoads(res.data);
      loadsKey.current = listPath;
      loadsStale.current = false;
      setNextCursor(res.nextCursor);
      setHistoryError("");
      setUpdatedAt(Date.now());
    } catch (err) {
      if (ticket === loadsRequest.current) setHistoryError(err.message);
    } finally {
      if (ticket === loadsRequest.current) { loadsInFlight.current = null; setRefreshing(false); }
    }
  }, [listPath]);
  async function loadMore() {
    if (!nextCursor || refreshing || loadsKey.current !== listPath) return;
    const ticket = ++loadsRequest.current;
    setRefreshing(true);
    try {
      const res = await request(`${listPath}${listPath.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(nextCursor)}`);
      if (ticket !== loadsRequest.current) return;
      setLoads((prev) => [...prev, ...res.data]);
      setNextCursor(res.nextCursor);
    } catch (err) {
      if (ticket === loadsRequest.current) setHistoryError(err.message);
    } finally {
      if (ticket === loadsRequest.current) setRefreshing(false);
    }
  }
  const load = useCallback(() => {
    return request(settingsPath(user.organizationId))
      .then(setSettings)
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false));
  }, [user.organizationId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const changed = () => setView(route());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  // readDrafts is async — read it into state so we never pass a Promise as a prop
  useEffect(() => {
    if (!settings?.id) return;
    let cancelled = false;
    readDrafts(undefined, settings.id).then((value) => {
      if (!cancelled) setRecoveries(value);
    });
    return () => {
      cancelled = true;
    };
  }, [settings?.id, view]);
  const draftsFullMessage = `This phone already keeps ${MAX_DRAFTS} unfinished loads. Continue or delete one before starting another.`;
  // LoadHub asks for confirmation inline before calling this; returns whether it was removed.
  async function deleteRecovery(draft) {
    if (!(await clearDraft(settings.id, undefined, draft.clientRequestId))) {
      setError(
        "Could not delete the unfinished load. Check browser storage.",
      );
      return false;
    }
    setRecoveries(await readDrafts(undefined, settings.id));
    return true;
  }
  useEffect(() => {
    if (!view.startsWith("entries") || !settings?.businessName) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      analyticsStale.current = true;
      refreshLoads();
    }, 30000);
    return () => clearInterval(interval);
  }, [view, settings?.businessName, refreshLoads]);
  useEffect(() => {
    if (!view.startsWith("bill/")) return;
    const id = view.slice(5);
    if (record?.id === id) return;
    let cancelled = false;
    request(`/dispatches/${id}`)
      .then((data) => {
        if (!cancelled) setRecord(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [view, record?.id]);
  // The list refreshes on return only when a mutation marked it stale.
  function home() {
    navigate("home");
  }
  // `next` lets business setup pass the settings it just saved. Click handlers pass an
  // event, so only treat the argument as settings when it looks like settings.
  async function newLoad(next) {
    const source = next && (next.id || next.businessName) ? next : settings;
    if (!source?.businessName) return navigate("profile");
    // Unfinished loads are kept side by side, up to MAX_DRAFTS.
    if ((await readDrafts(undefined, source.id)).length >= MAX_DRAFTS) {
      if (current !== "home") navigate("home");
      setError(draftsFullMessage);
      return;
    }
    setInitialDraft({
      ...newDraft(source.defaultRoyaltyFee),
      supervisor: user.name,
    });
    navigate(NEW_LOAD_ROUTE);
  }
  async function resume(value) {
    const list = await readDrafts(undefined, settings.id);
    const local = list.find((d) => d.serverId === value.id);
    // A phone copy edited after the last server save holds the user's newest
    // work; open it instead of silently discarding it. If the draft changed on
    // the server since (another device), the server copy wins.
    if (local && local.savedAt >= new Date(value.updatedAt).getTime()) {
      const { savedAt: _savedAt, ...draft } = local;
      setInitialDraft(draft);
      navigate("load");
      return;
    }
    if (!local && list.length >= MAX_DRAFTS) {
      setError(draftsFullMessage);
      return;
    }
    if (local && !(await clearDraft(settings.id, undefined, local.clientRequestId))) {
      setError(
        "Could not replace the copy on this phone. Check browser storage.",
      );
      return;
    }
    setInitialDraft(fromDispatch(value));
    navigate("load");
  }
  // Admin-only: open the load-entry screen seeded from a finalized invoice.
  // The revise draft lives only in memory (never in the recovery storage), so
  // an unfinished revision cannot later be resumed as a new dispatch.
  function reviseInvoice(value) {
    if (!admin || value.status === "Draft") return;
    setInitialDraft({
      ...fromDispatch(value),
      reviseOf: {
        id: value.id,
        updatedAt: value.updatedAt,
        slip: value.dispatchSlipNumber || "",
      },
    });
    navigate("load");
  }
  function closeRevise() {
    const id = initialDraft?.reviseOf?.id;
    setInitialDraft(null);
    // Refetch so a bill changed elsewhere (409 on revise) shows its latest version.
    setRecord(null);
    navigate(id ? `bill/${id}` : "home");
  }
  function saved(data) {
    // A completed revision must not reopen if the user navigates back to #load.
    if (initialDraft?.reviseOf) setInitialDraft(null);
    ++loadsRequest.current;
    loadsInFlight.current = null;
    setRefreshing(false);
    setRecord(data);
    navigate(`bill/${data.id}`);
    analyticsStale.current = true;
    loadsStale.current = true;
  }
  // Drop a deleted dispatch from the cached list and ignore any list response
  // already in flight, so the row cannot come back from a stale fetch.
  function removeLoad(id) {
    ++loadsRequest.current;
    loadsInFlight.current = null;
    setRefreshing(false);
    setLoads((prev) => prev.filter((l) => l.id !== id));
    if (record?.id === id) setRecord(null);
    analyticsStale.current = true;
    loadsStale.current = true;
  }
  async function deleteLoad(id) {
    // On 403/409 the error propagates and the row stays so LoadHub can explain why.
    await deleteDispatch(id);
    removeLoad(id);
    await dropLocalCopies(id);
    if (current === "home") refreshAnalytics();
  }
  // A deleted server draft must not live on as an unfinished load on this phone.
  async function dropLocalCopies(id) {
    if (!settings?.id) return;
    const local = (await readDrafts(undefined, settings.id)).filter((d) => d.serverId === id);
    for (const d of local) await clearDraft(settings.id, undefined, d.clientRequestId);
    if (local.length) setRecoveries(await readDrafts(undefined, settings.id));
  }
  // Let any in-flight autosave finish before the session ends.
  async function logout() {
    if (settings?.id) await flushDraft(settings.id);
    return onLogout();
  }
  // BillView may call onDeleted() or onDeleted(id); fall back to the open record.
  function deleted(id) {
    const target = typeof id === "string" || typeof id === "number" ? id : record?.id;
    if (target) {
      removeLoad(target);
      dropLocalCopies(target);
    }
    home();
  }
  useEffect(() => {
    // Settings, setup and bill pages do not use dispatch lists.
    if (!settings || !['home', 'entries', 'load'].includes(current)) return;
    if (loadsStale.current || loadsKey.current !== listPath ||
      (loadsInFlight.current && loadsInFlight.current.path !== listPath)) refreshLoads();
  }, [current, settings, listPath, refreshLoads]);
  useEffect(() => {
    if (current === "home" && settings && analyticsStale.current)
      refreshAnalytics();
  }, [current, settings, refreshAnalytics]);
  let content;
  const openingBill =
    view.startsWith("bill/") && record?.id !== view.slice(5) && !error;
  if (busy || openingBill)
    content = (
      <div role="status" className="space-y-4">
        <p className="font-semibold">
          {"Loading workspace…"}
        </p>
        <div className="h-24 rounded-2xl bg-surface-container-high" />
        <div className="h-44 rounded-2xl bg-surface-container-high" />
      </div>
    );
  else if (!settings)
    content = (
      <>
        {!error && (
          <p role="alert" className="control-error">
            {"Couldn’t load your workspace. Check your connection, then retry."}
          </p>
        )}
        <Button label="Retry connection" onClick={load} />
      </>
    );
  else if (current === "profile" && !admin)
    content = (
      <Card>
        <p>
          {"Ask your administrator to complete business setup."}
        </p>
      </Card>
    );
  else if (current === "profile")
    content = (
      <BusinessSetup
        settings={settings}
        user={user}
        onSaved={(data) => {
          setSettings(data);
          const to = profileSaveTarget(data);
          if (to === NEW_LOAD_ROUTE) newLoad(data);
          else if (to) navigate(to);
        }}
      />
    );
  else if (current === "requirements")
    content = (
      <Suspense
        fallback={<p role="status">{"Loading…"}</p>}
      >
        <LoadingRequirements
          organizationId={user.organizationId}
          settings={settings}
          onClose={() => navigate("entries")}
        />
      </Suspense>
    );
  else if (current === "load")
    content = (
      <NewLoad
        recentLoads={loads}
        user={user}
        key={
          initialDraft?.reviseOf
            ? `revise:${initialDraft.reviseOf.id}`
            : initialDraft?.clientRequestId || "recovery"
        }
        settings={settings}
        initialDraft={initialDraft}
        canFinalize={canFinalize}
        onBack={initialDraft?.reviseOf ? closeRevise : home}
        onSaved={saved}
        onSettingsChanged={setSettings}
      />
    );
  else if (current === "bill")
    content =
      record && record.id === view.slice(5) ? (
        <Suspense
          fallback={<p role="status">{"Loading bill…"}</p>}
        >
          <BillView
            record={record}
            admin={admin}
            canFinalize={canFinalize}
            onChanged={saved}
            onBack={home}
            onResume={resume}
            onEdit={reviseInvoice}
            onDeleted={deleted}
          />
        </Suspense>
      ) : (
        <BackButton
          label="Back to dashboard"
          onClick={home}
        />
      );
  else if (current === "settings")
    content = (
      <AccountSettings
        settings={settings}
        user={user}
        section={view.split("/")[1]}
        onChanged={setSettings}
        onDeleted={onLogout}
        onUserChange={onUserChange}
      />
    );
  else
    content = (
      <>
        <ErrorMessage error={historyError} />
        <LoadHub
          key={current}
          loads={loads}
          admin={admin}
          onDelete={deleteLoad}
          view={current}
          status={
            new URLSearchParams(view.split("?")[1] || "").get("status") ||
            "all"
          }
          query={search}
          onFilterChange={value => navigate(value === 'all' ? 'entries' : `entries?status=${value}`)}
          onOpen={(id) => {
            // Reuse the cached full bill unless the list shows it changed since.
            const listed = loads.find((l) => l.id === id);
            if (record?.id === id && listed?.updatedAt !== record.updatedAt)
              setRecord(null);
            navigate(`bill/${id}`);
          }}
          onRefresh={() => {
            if (current === "home") refreshAnalytics();
            else analyticsStale.current = true;
            return refreshLoads();
          }}
          onLoadMore={loadMore}
          hasMore={!!nextCursor}
          loading={refreshing}
          analytics={analytics}
          onRetryAnalytics={refreshAnalytics}
          recoveries={recoveries}
          maxDrafts={MAX_DRAFTS}
          onContinue={(draft) => {
            setInitialDraft(draft);
            navigate("load");
          }}
          onDeleteRecovery={deleteRecovery}
          onNavigate={navigate}
          onNew={newLoad}
          updatedAt={updatedAt}
        />
      </>
    );
  return (
    <WorkspaceShell
      settings={settings}
      user={user}
      view={current}
      navigate={navigate}
      onLogout={logout}
      onNew={newLoad}
      query={query}
      setQuery={setQuery}
      attention={loads.filter((l) => l.status === "Draft").length}
    >
      <ErrorMessage error={error} />
      {content}
    </WorkspaceShell>
  );
}
