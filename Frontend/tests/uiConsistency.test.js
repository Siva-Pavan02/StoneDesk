// Source-level guard for the single UI system: one button set, one back control, one theme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
// The marketing page keeps its own .mk-* set (same green, pill shape) and is checked separately.
const MARKETING = new Set(['LandingPage.jsx', 'ProductShowcase.jsx', 'MarketingMotion.jsx', 'SampleA4Invoice.jsx']);
function files(dir, ext) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path, ext);
    return ext.test(entry.name) ? [[relative(SRC, path), readFileSync(path, 'utf8')]] : [];
  });
}
const jsx = files(SRC, /\.jsx$/).filter(([path]) => !MARKETING.has(path.split(/[\\/]/).pop()));
const css = files(SRC, /\.css$/).filter(([path]) => !/a4Invoice\.css$|landing\.css$/.test(path));

test('retired one-off button classes are gone from components and stylesheets', () => {
  const retired = /\b(?:st-link|mn-ghost|st-danger-button|st-danger-submit|invoice-danger-button|invoice-danger-quiet|delivery-bar-link|references-back|references-remove)\b/;
  for (const [path, text] of [...jsx, ...css]) assert.doesNotMatch(text, retired, path);
});

test('every back control is the shared BackButton', () => {
  for (const [path, text] of jsx) {
    if (path.endsWith('Controls.jsx')) continue;
    // Raw <button>/<Button> whose visible label starts with "Back".
    assert.doesNotMatch(text, /<button[^>]*>\s*(?:<Icon[^>]*\/>\s*)?Back\b/, `${path}: raw back <button>`);
    assert.doesNotMatch(text, /<Button\b[^>]*\blabel="Back\b/, `${path}: back rendered as <Button>`);
    assert.doesNotMatch(text, /material-symbols|arrow_back/, `${path}: Material Symbols icon`);
  }
  const controls = readFileSync(join(SRC, 'components', 'pilot', 'Controls.jsx'), 'utf8');
  assert.match(controls, /export function BackButton\(/);
  assert.match(controls, /className=\{`back-button/);
});

test('Button offers exactly the shared variants and screens do not restyle them', () => {
  const controls = readFileSync(join(SRC, 'components', 'pilot', 'Controls.jsx'), 'utf8');
  assert.match(controls, /new Set\(\['primary', 'secondary', 'ghost', 'danger', 'danger-quiet'\]\)/);
  const index = readFileSync(join(SRC, 'index.css'), 'utf8');
  for (const variant of ['primary', 'secondary', 'ghost', 'danger', 'danger-quiet']) assert.match(index, new RegExp(`\\.pilot \\.control-button-${variant} \\{`));
  assert.match(index, /\.pilot \.btn \{[^}]*border-radius: var\(--ui-radius-button\)/);
  // Variant colours and the button radius are defined once, in index.css: no screen-scoped
  // selector may recolour or reshape a shared button variant.
  const canonical = /^\.pilot \.control-button-[a-z-]+(?::hover:not\(:disabled\)|:focus-visible)?(?:, \.pilot \.control-button-[a-z-]+:focus-visible)?$/;
  for (const [path, text] of css) {
    const rules = text.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]*\{[^{}]*\}/g) || [];
    for (const rule of rules) {
      const [rawSelector, body] = rule.split('{');
      const selector = rawSelector.trim();
      if (!/control-button-(?:primary|secondary|ghost|danger)/.test(selector) || canonical.test(selector)) continue;
      assert.doesNotMatch(body, /background|border-color|border-radius|(?:^|[;\s])color:/, `${path}: ${selector} restyles a shared button`);
    }
  }
});

test('app screens use theme colours, not raw Tailwind palette utilities', () => {
  const palette = /\b(?:[a-z-]+:)*(?:bg|text|border|ring|accent)-(?:slate|gray|teal|red|green|orange|amber|emerald|stone)-\d{2,3}\b/;
  for (const [path, text] of jsx) assert.doesNotMatch(text, palette, path);
});

test('initial loading page is branded, accessible, and motion-safe', () => {
  const app = readFileSync(join(SRC, 'App.jsx'), 'utf8');
  const loading = readFileSync(join(SRC, 'components', 'pilot', 'LoadingPage.jsx'), 'utf8');
  const index = readFileSync(join(SRC, 'index.css'), 'utf8');
  assert.match(app, /fallback=\{<LoadingPage\s*\/>\}/);
  assert.match(app, /view === "loading" \?[\s\S]*?<LoadingPage\s*\/>/);
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-live="polite"/);
  assert.match(loading, /aria-label="Opening StoneDesk"/);
  assert.match(loading, /<BrandLogo\b/);
  assert.match(index, /\.loading-page-progress span\s*\{/);
  assert.match(index, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important/);
});

test('load summary offers a direct Admin price edit for each product type', () => {
  const summary = readFileSync(join(SRC, 'components', 'pilot', 'LoadSummary.jsx'), 'utf8');
  const newLoad = readFileSync(join(SRC, 'components', 'pilot', 'NewLoad.jsx'), 'utf8');
  const priceDialog = readFileSync(join(SRC, 'components', 'pilot', 'ProductPriceDialog.jsx'), 'utf8');
  assert.match(summary, /<Icon name="edit"[^>]*\/><span>Edit<\/span>/);
  assert.match(summary, /onEditPrice/);
  assert.match(newLoad, /canEditPrice/);
  assert.match(newLoad, /repriceGroupRows/);
  assert.match(priceDialog, /<dialog\b/);
  assert.match(priceDialog, /Apply price/);
});

test('measurement cards use an explicit compact title, detail, amount, action layout', () => {
  const newLoad = readFileSync(join(SRC, 'components', 'pilot', 'NewLoad.jsx'), 'utf8');
  const workspace = readFileSync(join(SRC, 'styles', 'workspace.css'), 'utf8');
  assert.match(newLoad, /className="measurement-record-detail"/);
  assert.match(newLoad, /measurement-record-finish/);
  assert.match(workspace, /\.pilot\.workspace \.measurement-record\s*\{[\s\S]*grid-template-columns:/);
  assert.match(workspace, /measurement-record-detail/);
  assert.match(workspace, /padding: 8px 16px/);
  assert.match(workspace, /height: 32px/);
});

test('load summary uses an explicit compact mobile organization', () => {
  const summary = readFileSync(join(SRC, 'components', 'pilot', 'LoadSummary.jsx'), 'utf8');
  const index = readFileSync(join(SRC, 'index.css'), 'utf8');
  assert.match(summary, /load-summary-product-row/);
  assert.match(index, /@media \(max-width: 639px\)[\s\S]*load-summary-product/);
  assert.match(index, /repeat\(2, minmax\(0, 1fr\)\)/);
});

test('dashboard draft filter belongs with the loads activity heading', () => {
  const hub = readFileSync(join(SRC, 'components', 'pilot', 'LoadHub.jsx'), 'utf8');
  const workspace = readFileSync(join(SRC, 'styles', 'workspace.css'), 'utf8');
  assert.match(hub, /dashboard-activity-heading[\s\S]*dashboard-record-filter/);
  assert.doesNotMatch(hub, /dashboard-priority[\s\S]*dashboard-priority-action/);
  assert.match(workspace, /\.dashboard-record-filter/);
  assert.match(workspace, /button\[aria-pressed="true"\]/);
});

test('dashboard load status offers Today and All filters', () => {
  const dashboard = readFileSync(join(SRC, 'components', 'pilot', 'DashboardAnalytics.jsx'), 'utf8');
  const app = readFileSync(join(SRC, 'components', 'pilot', 'PilotApp.jsx'), 'utf8');
  const workspace = readFileSync(join(SRC, 'styles', 'workspace.css'), 'utf8');
  assert.match(dashboard, /aria-label="Load status period"/);
  assert.match(dashboard, /\[\['today', 'Today'\], \['all', 'All'\]\]/);
  assert.match(dashboard, /onPeriodChange\(value\)/);
  assert.match(app, /useState\('today'\)/);
  assert.match(app, /\/dispatches\/status-counts\?period=\$\{period\}/);
  assert.match(app, /listParams\.set\('limit', '5'\)/);
  assert.match(workspace, /\.analytics-period-filter/);
  assert.match(workspace, /\.analytics-period-filter button\[aria-pressed="true"\]/);
});

test('payments period options use one capsule filter', () => {
  const payments = readFileSync(join(SRC, 'components', 'pilot', 'PaymentsAnalytics.jsx'), 'utf8');
  const workspace = readFileSync(join(SRC, 'styles', 'workspace.css'), 'utf8');
  assert.match(payments, /analytics-period-filter/);
  assert.match(payments, /aria-label=\{period === 'all' \? 'All' : `\$\{period\} days`\}/);
  assert.match(payments, />\{period === 'all' \? 'All' : period\}/);
  assert.match(workspace, /\.analytics-period-filter\s*\{[\s\S]*border-radius: 999px/);
  assert.match(workspace, /\.analytics-period-filter button\[aria-pressed="true"\]/);
});

test('payment invoice links and expansion controls are accessible', () => {
  const payments = readFileSync(join(SRC, 'components', 'pilot', 'PaymentsAnalytics.jsx'), 'utf8');
  const workspace = readFileSync(join(SRC, 'styles', 'workspace.css'), 'utf8');
  assert.match(payments, /aria-label="Payments period"/);
  assert.match(payments, /payments-invoice-action[\s\S]*<a href=/);
  assert.match(payments, /aria-controls=\{`payments-invoices-/);
  assert.match(payments, /panelId=\{`payments-invoices-/);
  assert.match(payments, /className="payments-refresh" aria-label="Refresh payment analytics"/);
  assert.match(workspace, /@media \(max-width: 360px\)[\s\S]*payments-heading-actions/);
  assert.match(workspace, /\.payments-invoice-action a[\s\S]*height: 24px[\s\S]*min-height: 0/);
});

test('payments activity no longer renders a receipt trend graph', () => {
  const payments = readFileSync(join(SRC, 'components', 'pilot', 'PaymentsAnalytics.jsx'), 'utf8');
  const workspace = readFileSync(join(SRC, 'styles', 'workspace.css'), 'utf8');
  assert.doesNotMatch(payments, /payments-trend|Receipts over time/);
  assert.doesNotMatch(workspace, /\.payments-trend/);
});

test('mobile party invoice expansion uses a compact organized row layout', () => {
  const workspace = readFileSync(join(SRC, 'styles', 'workspace.css'), 'utf8');
  assert.match(workspace, /@media \(max-width: 480px\)[\s\S]*\.payments-invoice-list > li\s*\{[\s\S]*grid-template-columns:/);
  assert.match(workspace, /\.payments-invoice-panel h3 \{ display: none; \}/);
  assert.match(workspace, /\.payments-invoice-action a[\s\S]*height: 24px/);
});
