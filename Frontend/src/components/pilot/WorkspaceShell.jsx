import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { logoUrl } from "../../lib/pilotApi.js";
import Icon from "./Icon.jsx";

const navigation = [
  ["home", "home", "Dashboard", "డ్యాష్‌బోర్డ్"],
  ["entries", "loads", "Loading entries", "లోడ్ వివరాలు"],
  ["monitor", "truck", "Monitor & dispatch", "లోడ్ మానిటర్"],
  ["invoices", "bill", "Invoices", "బిల్లులు"],
  ["settings", "settings", "Settings", "సెట్టింగ్స్"],
];
export default function WorkspaceShell({
  settings,
  user,
  view,
  navigate,
  onNew,
  query,
  setQuery,
  attention,
  children,
}) {
  const { pick } = useLanguage();
  const drawer = useRef(null),
    notifications = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef(null),
    searchToggle = useRef(null);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  function closeSearch() {
    setSearchOpen(false);
    searchToggle.current?.focus();
  }
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const navigationView = ["profile", "products", "references"].includes(view)
    ? "settings"
    : view === "requirements"
      ? "entries"
      : view;
  function openDrawer() {
    drawer.current.showModal();
    setDrawerOpen(true);
  }
  function closeDrawer() {
    drawer.current.close();
    setDrawerOpen(false);
  }
  function go(viewName) {
    closeDrawer();
    navigate(viewName);
  }
  return (
    <div className="pilot workspace min-h-dvh bg-gray-50 text-gray-900">
      <a
        href="#workspace-main"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("workspace-main");
          main?.focus({ preventScroll: true });
          main?.scrollIntoView({ block: "start" });
        }}
      >
        {pick("Skip to content", "విషయానికి వెళ్ళండి")}
      </a>
      <aside
        className="workspace-sidebar"
        aria-label={pick("Workspace", "వర్క్‌స్పేస్")}
      >
        <div className="sidebar-brand">
          <span className="brand-mark">
            <Icon name="loads" />
          </span>
          <div>
            <strong>StoneDesk</strong>
            <p className="text-xs text-gray-600">
              {pick("Your yard. In order.", "మీ యార్డ్. క్రమబద్ధంగా.")}
            </p>
          </div>
        </div>
        <p className="eyebrow px-4 mb-3">{pick("WORKSPACE", "వర్క్‌స్పేస్")}</p>
        <nav aria-label={pick("Desktop navigation", "డెస్క్‌టాప్ నావిగేషన్")}>
          {navigation.map(([key, icon, en, te]) => (
            <button
              key={key}
              className="sidebar-link"
              aria-current={navigationView === key ? "page" : undefined}
              onClick={() => navigate(key)}
            >
              <Icon name={icon} />
              <span>{pick(en, te)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-account flex items-center gap-3 px-3">
          <span className="account-monogram" aria-hidden="true">
            {initials}
          </span>
          <span className="min-w-0">
            <strong className="block truncate font-medium">{user.name}</strong>
            <span className="block text-xs text-gray-600">
              {pick(
                user.role,
                user.role === "Admin"
                  ? "అడ్మిన్"
                  : user.role === "Yard Manager"
                    ? "యార్డ్ మేనేజర్"
                    : "డిస్పాచర్",
              )}
            </span>
          </span>
        </div>
      </aside>
      <header className="workspace-header">
        <div className="workspace-toolbar">
          <div className="workspace-brand">
            <button
              type="button"
              className="icon-button mobile-menu"
              aria-label={pick("Open navigation", "మెనూ తెరవండి")}
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              aria-controls="workspace-navigation-dialog"
              onClick={openDrawer}
            >
              <span className="menu-lines" aria-hidden="true">
                <span />
                <span />
              </span>
            </button>
            <div className="workspace-organization">
              <span className="workspace-organization-mark">
                {settings?.logoPath ? (
                  <img src={logoUrl(settings.logoPath)} alt="" />
                ) : (
                  <Icon name="loads" />
                )}
              </span>
              <div className="workspace-organization-text">
                <p
                  className="workspace-organization-name"
                  title={settings?.businessName || "StoneDesk"}
                >
                  {settings?.businessName || "StoneDesk"}
                </p>
                <p className="workspace-organization-caption">
                  {pick("Yard workspace", "యార్డ్ వర్క్‌స్పేస్")}
                </p>
              </div>
            </div>
          </div>
          <form
            className={`workspace-search${searchOpen ? " is-open" : ""}`}
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate("entries");
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && searchOpen) closeSearch();
            }}
          >
            <label className="sr-only" htmlFor="global-search">
              {pick(
                "Search lorry, party or invoice ID",
                "లారీ, పార్టీ లేదా బిల్లు వెతకండి",
              )}
            </label>
            <button
              type="submit"
              className="icon-button workspace-search-submit"
              aria-label={pick("Search", "వెతకండి")}
            >
              <Icon name="search" />
            </button>
            <input
              ref={searchInput}
              id="global-search"
              type="search"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={pick(
                "Lorry, party or bill ID",
                "లారీ, పార్టీ లేదా బిల్లు",
              )}
            />
            <button
              type="button"
              className="icon-button workspace-search-close"
              aria-label={pick("Close search", "శోధన మూసివేయండి")}
              onClick={closeSearch}
            >
              <Icon name="close" />
            </button>
          </form>
          <div className="workspace-header-actions">
            <button
              ref={searchToggle}
              type="button"
              className="icon-button workspace-search-toggle"
              aria-label={pick("Open search", "శోధన తెరవండి")}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen(true)}
            >
              <Icon name="search" />
            </button>
            {view !== "load" && (
              <button
                type="button"
                className="btn workspace-create-load"
                title={pick("Create a new load", "కొత్త లోడ్ సృష్టించండి")}
                aria-label={pick("Create a new load", "కొత్త లోడ్ సృష్టించండి")}
                onClick={onNew}
              >
                <Icon name="plus" />
                <span>{pick("New load", "కొత్త లోడ్")}</span>
              </button>
            )}
            <button
              type="button"
              className="icon-button workspace-notifications"
              aria-label={pick("Notifications and tasks", "నోటిఫికేషన్లు")}
              aria-haspopup="dialog"
              onClick={() => notifications.current.showModal()}
            >
              <Icon name="bell" />
              {attention > 0 && (
                <span className="workspace-attention-dot" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>
      <main
        id="workspace-main"
        tabIndex={-1}
        className="workspace-main space-y-5"
        data-view={view}
      >
        {children}
      </main>
      <dialog
        ref={drawer}
        id="workspace-navigation-dialog"
        className="app-dialog nav-drawer"
        aria-labelledby="nav-title"
        onClose={() => setDrawerOpen(false)}
        onCancel={() => setDrawerOpen(false)}
      >
        <div className="flex min-h-full flex-col p-5">
          <div className="flex items-center gap-3 border-b border-gray-200 pb-5">
            {settings?.logoPath ? (
              <img
                src={logoUrl(settings.logoPath)}
                className="h-12 w-12 object-contain"
                alt=""
              />
            ) : (
              <span className="brand-mark">
                <Icon name="loads" />
              </span>
            )}
            <strong id="nav-title" className="min-w-0 flex-1 break-words">
              {settings?.businessName || "StoneDesk"}
            </strong>
            <button
              type="button"
              className="icon-button"
              aria-label={pick("Close navigation", "మెనూ మూసివేయండి")}
              onClick={closeDrawer}
            >
              <span className="menu-lines is-open" aria-hidden="true">
                <span />
                <span />
              </span>
            </button>
          </div>
          <nav
            className="space-y-2 py-5"
            aria-label={pick("Main navigation", "ప్రధాన నావిగేషన్")}
          >
            {navigation.map(([key, icon, en, te]) => (
              <button
                key={key}
                aria-current={navigationView === key ? "page" : undefined}
                onClick={() => go(key)}
                className={`sidebar-link ${navigationView === key ? "bg-teal-50 text-teal-900" : ""}`}
              >
                <Icon name={icon} />
                {pick(en, te)}
              </button>
            ))}
          </nav>
          <div className="mt-auto border-t border-gray-200 pt-5 flex items-center gap-3">
            <span className="account-monogram" aria-hidden="true">
              {initials}
            </span>
            <span className="min-w-0">
              <strong className="block truncate font-medium">
                {user.name}
              </strong>
              <span className="text-sm text-gray-600">
                {pick(
                  user.role,
                  user.role === "Admin"
                    ? "అడ్మిన్"
                    : user.role === "Yard Manager"
                      ? "యార్డ్ మేనేజర్"
                      : "డిస్పాచర్",
                )}
              </span>
            </span>
          </div>
        </div>
      </dialog>
      <dialog
        ref={notifications}
        className="app-dialog"
        aria-labelledby="attention-title"
      >
        <div className="space-y-4 p-6">
          <h2 id="attention-title" className="text-xl font-bold">
            {pick("Needs attention", "చేయవలసినవి")}
          </h2>
          <p>
            {attention}{" "}
            {pick(
              "saved drafts to review.",
              "సేవ్ చేసిన డ్రాఫ్ట్‌లు తనిఖీ చేయాలి.",
            )}
          </p>
          <button
            className="btn w-full min-h-12 bg-teal-800 text-white"
            onClick={() => {
              notifications.current.close();
              navigate("entries");
            }}
          >
            {pick("View loading entries", "లోడ్ వివరాలు చూడండి")}
          </button>
          <button
            className="text-button w-full"
            onClick={() => notifications.current.close()}
          >
            {pick("Close", "మూసివేయండి")}
          </button>
        </div>
      </dialog>
    </div>
  );
}
