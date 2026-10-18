import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles/a4Invoice.css', import.meta.url), 'utf8');
const fonts = new URL('../public/fonts/', import.meta.url);

test('Monochrome invoice palette preserves A4 print geometry', () => {
  for (const value of ['--ink: #111111', '--muted: #4b4b4b', '--accent: #111111', '--border: #d1d1d1', '--line: #e5e5e5',
    '--tint: #f9f9f9', '--total-bg: #f3f3f3', '--subtotal-bg: #f3f3f3', '--subtotal-border: #d1d1d1', '--subtotal-marker: #6b6b6b', '--column-rule: #e5e5e5'])
    assert.ok(css.includes(value), value);
  for (const old of ['#242424', '#666666', '#353535', '#dddddd', '#eef3fa', '#8297b0', 'Segoe UI', '#203d36', '#526661', '#17645d']) assert.ok(!css.replace(/\.a4-preview-feedback[^}]*\}/g, '').includes(old), old);
  assert.match(css, /@page \{ size: A4 portrait; margin: 12mm; \}/);
  assert.match(css, /@media print \{[\s\S]*min-block-size: 272\.5mm/);
  assert.match(css, /\.page-height-ruler \{[^}]*inline-size: 186mm; block-size: 272\.5mm/);
});

test('three @font-face rules point at bundled Noto Sans files with the OFL licence', () => {
  const faces = [...css.matchAll(/@font-face \{([^}]*)\}/g)].map(([, body]) => body);
  assert.equal(faces.length, 3);
  for (const [weight, file] of [[400, 'NotoSans-Regular.ttf'], [600, 'NotoSans-SemiBold.ttf'], [700, 'NotoSans-Bold.ttf']]) {
    const face = faces.find(body => body.includes(`font-weight: ${weight};`));
    assert.ok(face, `weight ${weight}`);
    assert.match(face, /font-family: 'StoneDesk Invoice Sans'/);
    assert.ok(face.includes(`url('/fonts/${file}')`));
    assert.ok(existsSync(new URL(file, fonts)), file);
  }
  assert.match(readFileSync(new URL('OFL.txt', fonts), 'utf8'), /SIL Open Font License/);
  assert.match(css, /font-kerning: none/);
  assert.match(css, /font-synthesis: none/);
});

test('no generated content, no invoice container queries; narrow stacking is screen-only on the preview', () => {
  assert.doesNotMatch(css, /(?<![\w-])content\s*:/);
  assert.doesNotMatch(css, /@container invoice/);
  const screen = css.match(/@media screen \{\s*@container a4-preview \(max-width: 793px\) \{([\s\S]*?)\r?\n  \}\r?\n\}/);
  assert.ok(screen, 'stacking block');
  for (const line of screen[1].trim().split(/\r?\n/)) assert.match(line.trim(), /^\.a4-invoice\.sample-pages /);
  assert.match(css, /\.a4-invoice\.sample-pages \{[^}]*container: a4-preview \/ inline-size/);
});

test('measure host and bill-screen export rules are present', () => {
  assert.match(css, /\.a4-invoice\.a4-measure-host \{[^}]*position: fixed;[^}]*inline-size: 210mm;[^}]*visibility: hidden/);
  assert.match(css, /\.a4-invoice\.a4-measure-host \.sample-sheet \{[^}]*padding: 12mm/);
  for (const selector of ['.invoice-paper-shell.a4-preview-shell', '.bill-screen .invoice-export-panel', '.a4-preview-feedback[role="alert"]', '@media screen and (max-width: 359px)'])
    assert.ok(css.includes(selector), selector);
});


test('printed invoice uses only grayscale colors; warning red stays outside the sheet', () => {
  const invoiceCss = css.slice(css.indexOf('.a4-invoice, body.a4-body'));
  for (const [, hex] of invoiceCss.matchAll(/#([0-9a-f]{6})\b/gi)) {
    assert.equal(hex.slice(0, 2), hex.slice(2, 4), hex);
    assert.equal(hex.slice(2, 4), hex.slice(4, 6), hex);
  }
  for (const [, r, g, b] of invoiceCss.matchAll(/rgb\((\d+) (\d+) (\d+)/g)) {
    assert.equal(r, g); assert.equal(g, b);
  }
  assert.match(css, /thead th \{ background: var\(--total-bg\); color: var\(--ink\)/);
});
