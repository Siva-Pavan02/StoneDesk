// Source-level guard for the single UI system: one button set, one back control, one theme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
// The marketing page keeps its own .mk-* set (same green, pill shape) and is checked separately.
// SettingsScreen.jsx is not imported anywhere (Trucks & destinations moved into New load).
const MARKETING = new Set(['LandingPage.jsx', 'ProductShowcase.jsx', 'MarketingMotion.jsx', 'SampleA4Invoice.jsx', 'SettingsScreen.jsx']);
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
