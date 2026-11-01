import { useRef } from "react";
import { logoUrl } from "../../lib/pilotApi.js";
import Icon from "./Icon.jsx";
import { navigationKey, visibleNavigation } from "../../utils/workspaceRoutes.js";

// Hash links: let Cmd/Ctrl/Shift/middle-click open a new tab, handle plain clicks in-app.
const isPlainClick = (e) =>
  e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

export default function WorkspaceShell({
  settings,
  user,
  view,
  navigate,
  attention,
  children,
}) {
  const notifications = useRef(null);
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
  const businessMark = businessInitials ? (
    <span className="business-initials" aria-hidden="true">{businessInitials}</span>
  ) : (
    <Icon name="products" />
  );
  const navigation = visibleNavigation(user.role);
  const navigationView = navigationKey(view);
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
      <header className="workspace-header">
        <div className="workspace-toolbar">
          <div className="workspace-brand">
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
          <nav className="workspace-nav" aria-label="Workspace navigation">
            {navigation.map(([key, icon, label]) => (
              <a
                key={key}
                href={`#${key}`}
                className="workspace-nav-link"
                aria-label={label}
                aria-current={navigationView === key ? "page" : undefined}
                onClick={(event) => {
                  if (!isPlainClick(event)) return;
                  event.preventDefault();
                  navigate(key);
                }}
              >
                <Icon name={icon} />
                <span aria-hidden="true">
                  {key === "home" ? "Home" : key === "entries" ? "Loads" : label}
                </span>
              </a>
            ))}
          </nav>
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
    </div>
  );
}
