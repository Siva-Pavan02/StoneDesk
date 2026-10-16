import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles/a4Invoice.css', import.meta.url), 'utf8');
const fonts = new URL('../public/fonts/', import.meta.url);

test('StoneDesk green palette and A4 print geometry; the reference grey and Segoe UI are gone', () => {
  for (const value of ['--ink: #203d36', '--muted: #526661', '--accent: #17645d', '--border: #d4e0db', '--line: #eaf0ed',
    '--tint: #f1f6f3', '--total-bg: #e0ece6', '--subtotal-bg: #e9f3ee', '--subtotal-border: #c6ddd2', '--subtotal-marker: #5e9b8a', '--column-rule: #cfdcd6'])
    assert.ok(css.includes(value), value);
  for (const old of ['#242424', '#666666', '#353535', '#dddddd', '#eef3fa', '#8297b0', 'Segoe UI']) assert.ok(!css.replace(/\.a4-preview-feedback[^}]*\}/g, '').includes(old), old);
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
