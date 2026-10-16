// Source-level checks for the multi-line bank details field (Req 9.1-9.5, 12.3).
// Reads the JSX as text so no JSX runtime or new dependency is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const setup = read('../src/components/pilot/BusinessSetup.jsx');
const controls = read('../src/components/pilot/Controls.jsx');

// The single <Field .../> element that carries name="bankDetails".
function bankField() {
  const at = setup.indexOf('name="bankDetails"');
  assert.ok(at > 0, 'bankDetails field exists');
  const start = setup.lastIndexOf('<Field', at);
  const end = setup.indexOf('/>', at);
  assert.ok(start >= 0 && end > at, 'bankDetails Field element is self-closing');
  const element = setup.slice(start, end + 2);
  assert.equal(element.indexOf('<Field', 1), -1, 'slice holds exactly one Field');
  return element;
}

test('bank field is a labelled multiline Field with 5 rows (9.1)', () => {
  const field = bankField();
  assert.match(field, /\smultiline[\s/]/);
  assert.match(field, /\srows=\{5\}/);
  assert.match(field, /\slabel="[^"]+"/);
});

test('bank field is limited to 300 characters (9.2, 12.3)', () => {
  assert.match(bankField(), /\smaxLength=\{300\}/);
});

test('bank field has no Enter/submit key handler (9.3)', () => {
  const field = bankField();
  assert.doesNotMatch(field, /onKey(Down|Up|Press)/);
  assert.doesNotMatch(field, /enterKeyHint|enterTo\(/);
  // The surrounding form must not intercept keys either; only onSubmit saves.
  const form = /<form\b[^>]*>/.exec(setup)?.[0] || '';
  assert.match(form, /onSubmit=/);
  assert.doesNotMatch(form, /onKey(Down|Up|Press)/);
});

test('placeholder lists the 5 example lines in order and is not the value (9.4)', () => {
  const field = bankField();
  assert.match(field, /\splaceholder=\{BANK_PLACEHOLDER\}/);
  assert.match(field, /\svalue=\{form\.bankDetails\}/);
  const decl = /const BANK_PLACEHOLDER = \[([^\]]*)\]\.join\('\\n'\);/.exec(setup);
  assert.ok(decl, 'BANK_PLACEHOLDER is an array joined by newlines');
  const lines = [...decl[1].matchAll(/'([^']*)'/g)].map(m => m[1]);
  assert.deepEqual(lines, [
    'Account holder: Venkata Granites',
    'Bank: State Bank of India',
    'A/c no: 1234 5678 9012',
    'IFSC: SBIN0001234',
    'UPI: venkata@okhdfc',
  ]);
  assert.equal(lines.join('\n').split('\n').length, 5);
});

test('helper text "One detail per line" is set on the field (9.5)', () => {
  assert.match(bankField(), /\shelper="One detail per line"/);
});

test('Controls Field renders multiline as a styled textarea with shared wiring (9.1)', () => {
  assert.match(controls, /export function Field\(\{[^}]*\bhelper\b[^}]*\bmultiline = false\b[^}]*\}\)/);
  const branch = /if \(!children && multiline\) return (.*);/.exec(controls)?.[1] || '';
  assert.match(branch, /<textarea className="input input-multiline" \{\.\.\.props\} \{\.\.\.a11y\} id=\{controlId\} \/>/);
  assert.match(branch, /\{labelEl\}/, 'textarea keeps the shared label');
  assert.match(branch, /\{message\}/, 'textarea keeps helper and error messages');
  assert.match(controls, /<label className="control-label" htmlFor=\{controlId\}>/);
  // Multiline branch sits before the generic <input> fallback.
  assert.ok(controls.indexOf('multiline) return') < controls.indexOf('<input className="input" {...props}'));
});

test('Controls Field links helper text through aria-describedby (9.5)', () => {
  assert.match(controls, /const helperId = `\$\{controlId\}-helper`;/);
  assert.match(controls, /const describedBy = \[helper && helperId, error && errorId\]\.filter\(Boolean\)\.join\(' '\);/);
  assert.match(controls, /'aria-describedby': describedBy/);
  assert.match(controls, /<p id=\{helperId\} className="field-helper">\{helper\}<\/p>/);
});
