import { useRef, useState } from "react";
import { logoUrl } from "../../lib/pilotApi.js";
import Icon from "./Icon.jsx";
import BrandLogo from "./BrandLogo.jsx";
import LogoutDialog from "./LogoutDialog.jsx";
import { navigationKey, visibleNavigation } from "../../utils/workspaceRoutes.js";
import { roleLabel } from "../../utils/roles.js";

// Hash links: let Cmd/Ctrl/Shift/middle-click open a new tab, handle plain clicks in-app.
const isPlainClick = (e) =>
  e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

export default function WorkspaceShell({
  settings,
  user,
  view,
  navigate,
  onLogout,
  attention,
  children,
}) {
  const drawer = useRef(null), notifications = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  // Stand-in for the business's own logo until one is uploaded. Deliberately not
  // the StoneDesk logo: this spot belongs to the customer's business.
  const businessInitials =
    (settings?.businessName || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || null;
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const businessMark = businessInitials ? (
    <span className="business-initials" aria-hidden="true">{businessInitials}</span>
  ) : (
    <Icon name="products" />
  );
  const navigation = visibleNavigation(user.role);
  const navigationView = navigationKey(view);
  function closeDrawer() {
    if (drawer.current?.open) drawer.current.close();
    setDrawerOpen(false);
  }
  function openItem(key) {
    if (key === "load") {
      if (view !== "load") onNew();
    } else navigate(key);
  }
  function logout() {
    closeDrawer();
    setConfirmingLogout(true);
  }
  function navigationLinks() {
    return navigation.map(([key, icon, label]) => (
      <a
        key={key}
        href={`#${key}`}
        className="sidebar-link"
        aria-current={navigationView === key ? "page" : undefined}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          if (drawer.current.open) closeDrawer();
          openItem(key);
        }}
      >
        <Icon name={icon} />
        <span>{label}</span>
      </a>
    ));
  }
  return (
    <div className="pilot workspace min-h-dvh bg-surface text-on-surface">
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
        {"Skip to content"}
      </a>
      <aside className="workspace-sidebar" aria-label="Workspace">
        <div className="sidebar-brand">
          <BrandLogo size={44} className="brand-mark" />
          <div>
            <strong translate="no">StoneDesk</strong>
          </div>
        </div>
        <p className="eyebrow px-4 mb-3">{"WORKSPACE"}</p>
        <nav aria-label="Desktop navigation">{navigationLinks()}</nav>
        <div className="sidebar-account flex items-center gap-3 px-3">
          <span className="account-monogram" aria-hidden="true">{initials}</span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate font-medium">{user.name}</strong>
            <span className="block text-xs text-on-surface-variant">{roleLabel(user.role)}</span>
          </span>
          <button type="button" className="icon-button sidebar-logout" aria-label="Log out" title="Log out" onClick={logout}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <header className="workspace-header">
        <div className="workspace-toolbar">
          <div className="workspace-brand">
            <button
              type="button"
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              aria-controls="workspace-navigation-dialog"
              onClick={() => { drawer.current.showModal(); setDrawerOpen(true); }}
            >
              <span className="menu-lines" aria-hidden="true"><span /><span /></span>
            </button>
            <div className="workspace-organization">
              <span className="workspace-organization-mark">
                {settings?.logoPath ? (
                  <img src={logoUrl(settings.logoPath)} alt="" width={26} height={26} />
                ) : (
                  businessMark
                )}
              </span>
              <div className="workspace-organization-text">
                <p
                  className="workspace-organization-name"
                  translate="no"
                  title={settings?.businessName || "StoneDesk"}
                >
                  {settings?.businessName || "StoneDesk"}
                </p>
              </div>
            </div>
          </div>
          <div className="workspace-header-actions">
            <button
              type="button"
              className="icon-button workspace-notifications"
              aria-label={
                attention > 0
                  ? `Notifications and tasks, ${attention} drafts to review`
                  : "Notifications and tasks"
              }
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
      <dialog
        ref={drawer}
        id="workspace-navigation-dialog"
        className="app-dialog nav-drawer"
        aria-labelledby="nav-title"
        onClose={() => setDrawerOpen(false)}
        onCancel={() => setDrawerOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}
      >
        <div className="nav-drawer-inner">
          <div className="nav-drawer-head">
            <span className="workspace-organization-mark nav-drawer-business-mark">{businessMark}</span>
            <strong id="nav-title" className="nav-drawer-title" translate="no">{settings?.businessName || "StoneDesk"}</strong>
            <button type="button" className="icon-button" aria-label="Close navigation" onClick={closeDrawer}>
              <span className="menu-lines is-open" aria-hidden="true"><span /><span /></span>
            </button>
          </div>
          <p className="nav-drawer-label" aria-hidden="true">{"Menu"}</p>
          <nav className="nav-drawer-nav" aria-label="Main navigation">{navigationLinks()}</nav>
          <div className="nav-drawer-footer">
            <div className="nav-drawer-account">
              <span className="account-monogram" aria-hidden="true">{initials}</span>
              <span className="min-w-0">
                <strong className="block truncate font-medium">{user.name}</strong>
                <span className="block text-xs text-on-surface-variant">{roleLabel(user.role)}</span>
              </span>
            </div>
            <button type="button" className="nav-drawer-logout" onClick={logout}><Icon name="logout" />{"Log out"}</button>
          </div>
        </div>
      </dialog>
      <main
        id="workspace-main"
        tabIndex={-1}
        className="workspace-main space-y-5"
        data-view={view}
      >
        {children}
      </main>
      <dialog
        ref={notifications}
        className="app-dialog"
        aria-labelledby="attention-title"
      >
        <div className="space-y-4 p-6">
          <h2 id="attention-title" className="text-xl font-bold">
            {"Needs attention"}
          </h2>
          <p>
            {attention > 0 ? (
              <>
                {attention}{" "}
                {"saved drafts to review."}
              </>
            ) : (
              "Nothing waiting for review."
            )}
          </p>
          <a
            href="#entries"
            className="btn w-full min-h-12 bg-primary text-white"
            onClick={(event) => {
              if (!isPlainClick(event)) return;
              event.preventDefault();
              notifications.current.close();
              navigate("entries");
            }}
          >
            {"View loading entries"}
          </a>
          <button
            className="text-button w-full"
            onClick={() => notifications.current.close()}
          >
            {"Close"}
          </button>
        </div>
      </dialog>
      <LogoutDialog
        open={confirmingLogout}
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={async () => {
          await onLogout();
          setConfirmingLogout(false);
        }}
      />
    </div>
  );
}
