import BrandLogo from "./BrandLogo";

export default function LoadingPage() {
  return (
    <div
      className="pilot loading-page min-h-dvh"
      role="status"
      aria-live="polite"
      aria-label="Opening StoneDesk"
    >
      <div className="loading-page-content">
        <div className="loading-page-brand">
          <BrandLogo size={44} className="loading-page-logo" />
          <span translate="no">StoneDesk</span>
        </div>
        <div className="loading-page-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
