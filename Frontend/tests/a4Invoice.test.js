import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { a4InvoiceFromDispatch, amountInWords, formatA4Dimension, formatA4Money, formatA4Number, formatA4Rate,
  prepareA4Invoice, sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { fixedSampleA4Pages, renderA4Invoice, renderA4Group, renderStandaloneA4Invoice } from '../src/utils/a4InvoiceRender.js';
import { packA4Groups, planA4Invoice } from '../src/utils/a4InvoicePagination.js';

const prepared = () => prepareA4Invoice(sampleA4Invoice());
const groupsOn = page => page.columns.map(column => column.map(fragment => fragment.group.id));
const fragments = pages => pages.flatMap(page => page.columns.flat());

test('approved fixture has all 168 actual entries and exact decimal-safe totals', () => {
  const model = prepared();
  assert.deepEqual(model.groups.map(group => group.id), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.ok(model.groups.every(group => group.entries.length === 7 && group.entries.filter(line => line.type === 'regular').length === 4 && group.entries.filter(line => line.type === 'top').length === 3));
  assert.equal(model.groups.flatMap(group => group.entries).length, 168);
  assert.deepEqual(model.groups[0].entries.map(line => line.quantity), [2, 3, 1, 2, 3, 1, 2]);
  assert.equal(model.groups[0].entries[3].area, '36.125');
  assert.equal(model.groups[0].entries[3].amount, '1445.00');
  assert.deepEqual(model.totals, {
    pieces: 336, regularArea: '3164.5', topArea: '2373.375', area: '5537.875',
    regularAmount: '126580.00', topAmount: '94935.00', materialTotal: '221515.00', netPayable: '222015.00',
  });
  assert.equal(formatA4Number(model.totals.topArea), '2,373.38');
  assert.equal(formatA4Number(model.totals.area), '5,537.88');
  assert.equal(formatA4Money(model.totals.netPayable), '₹222,015.00');
  assert.equal(formatA4Rate('1.005'), '₹1.005');
  assert.equal(formatA4Rate('25000.25'), '₹25,000.25');
  assert.equal(model.amountWords, 'Rupees Two Lakh Twenty-two Thousand Fifteen Only.');
  assert.deepEqual(model.warnings, []);
});

test('the sample columns are explicit and the final summary appears only once', () => {
  const model = prepared(), pages = fixedSampleA4Pages(model);
  assert.deepEqual(pages.map(groupsOn), [
    [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
    [[10, 11, 12], [13, 14, 15], [16, 17, 18]],
    [[19, 20], [21, 22], [23, 24]],
  ]);
  const html = renderA4Invoice(model, pages);
  assert.equal((html.match(/class="paper sample-sheet"/g) || []).length, 3);
  assert.equal((html.match(/class="row-block"/g) || []).length, 24);
  assert.equal((html.match(/data-entry-id=/g) || []).length, 168);
  assert.equal((html.match(/class="invoice-summary"/g) || []).length, 1);
  assert.equal((html.match(/class="closing"/g) || []).length, 1);
  assert.equal((html.match(/class="total"/g) || []).length, 24);
  assert.equal((html.match(/Reg\. subtotal/g) || []).length, 24);
  assert.equal((html.match(/Top subtotal/g) || []).length, 24);
  assert.equal((html.match(/class="type" scope="row" aria-label="Regular material"><\/th>/g) || []).length, 96);
  assert.equal((html.match(/class="type top" scope="row">Top<\/th>/g) || []).length, 72);
  assert.match(html, /Fictional data — not for payment/);
  assert.match(html, /5,537\.88/);
  assert.match(html, /₹222,015\.00/);
  assert.match(html, /Page 3 of 3/);
  assert.doesNotMatch(html, /Measurement details|24 rows|<h3[^>]*>Row /);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test('generated HTML is self-contained and keeps the exact approved palette', async () => {
  const css = await readFile(new URL('../src/styles/a4Invoice.css', import.meta.url), 'utf8');
  const sample = await readFile(new URL('../public/sample_invoice_24_rows.html', import.meta.url), 'utf8');
  assert.equal(sample, renderStandaloneA4Invoice(prepared(), fixedSampleA4Pages(prepared()), css), 'The committed HTML sample needs regeneration.');
  for (const color of ['#203d36', '#526661', '#17645d', '#e2e8e5', '#eef2f0', '#f1f6f3', '#e0ece6']) assert.ok(sample.includes(color));
  assert.match(sample, /@page \{ size: A4 portrait; margin: 12mm; \}/);
  assert.match(sample, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(sample, /<script|<link|https?:\/\//i);
});

test('production preserves saved lines, round-once summaries, categories and offline identity', () => {
  const record = {
    status: 'Dispatched', date: '2026-10-11', dispatchSlipNumber: 'LONG-INVOICE-REFERENCE-2026',
    partyName: 'Real client', supervisor: 'Supervisor', logistics: { truckNumber: 'AP 12 ZX 0400', buyerDestination: 'Town' },
    businessSnapshot: { businessName: 'Actual Stone Works', address: 'Yard Road', phone: '0123', signatoryName: 'Signed by A' },
    inventory: [{ stoneType: 'Stone', finish: 'Natural', ratePerSqFt: 1.005, measurementRows: [
      { rowNo: 5, lengthFt: 1, widthFt: 1, quantity: 1, category: 'Regular', lineTotal: 1.01 },
      { rowNo: 5, lengthFt: 1, widthFt: 1, quantity: 1, category: 'TOP', lineTotal: 1.01 },
    ] }],
    summary: { totalPieces: 2, totalDispatchVolumeSqFt: 2, baseMaterialTotal: 2.01, loadingAndRoyaltyFees: 0.1, netBillableAmount: 2.11 },
  };
  const model = a4InvoiceFromDispatch(record);
  assert.deepEqual(model.warnings, []);
  assert.deepEqual(model.groups.map(group => group.id), [5]);
  assert.deepEqual(model.groups[0].entries.map(entry => entry.amount), ['1.01', '1.01']);
  assert.equal(model.groups[0].total.amount, '2.01');
  assert.equal(model.totals.regularAmount, '1.01');
  assert.equal(model.totals.topAmount, '1.00');
  assert.equal(model.totals.netPayable, '2.11');
  assert.equal(model.amountWords, 'Rupees Two and Eleven Paise Only.');
  const html = renderA4Invoice(model, [{ columns: [[{ group: model.groups[0], from: 0, to: 2 }], [], []], summary: true }]);
  assert.match(html, /LONG-INVOICE-REFERENCE-2026/);
  assert.match(html, /Signed by A/);
  assert.match(html, /₹2\.11/);
  assert.match(html, /<dt>Rate \/ sq ft<\/dt><dd data-rate="sq-ft">₹1\.005<\/dd>/);
  assert.doesNotMatch(html, /SAMPLE · FICTIONAL|₹40\.00/);

  record.inventory[0].measurementRows[0].lineTotal = 2.01;
  const changed = a4InvoiceFromDispatch(record);
  assert.equal(changed.groups[0].entries[0].amount, '2.01', 'Never replace the saved amount with a guessed rate.');
  assert.ok(changed.warnings.some(warning => warning.includes('stored amount')));
  assert.ok(changed.warnings.some(warning => warning.includes('Net payable')));
});

test('payment summary lists each saved rate without inventing a rate for legacy rows', () => {
  const raw = sampleA4Invoice();
  raw.mode = 'production'; raw.status = 'Dispatched';
  raw.groups = [{ id: 1, entries: [
    { id: 'one', type: 'regular', lengthFt: 1, widthFt: 1, quantity: 1, ratePerSqFt: '40' },
    { id: 'two', type: 'regular', lengthFt: 1, widthFt: 1, quantity: 1, ratePerSqFt: '55.50' },
    { id: 'legacy', type: 'top', lengthFt: 1, widthFt: 1, quantity: 1, authoritativeAmount: '9.00' },
  ] }];
  const model = prepareA4Invoice(raw);
  const pages = [{ columns: [[{ group: model.groups[0], from: 0, to: 3 }], [], []], summary: true }];
  const html = renderA4Invoice(model, pages);
  assert.match(html, /<dt>Rates \/ sq ft<\/dt><dd data-rate="sq-ft">₹40\.00 · ₹55\.50 · Not recorded<\/dd>/);
  const telugu = renderA4Invoice(model, pages, 'document', (_, te) => te);
  assert.match(telugu, /<dt>చ\.అ\. ధరలు<\/dt><dd data-rate="sq-ft">₹40\.00 · ₹55\.50 · నమోదు కాలేదు<\/dd>/);
});

test('historical piece-only records, Top-only and Regular-only groups retain entries and omit empty subtotals', () => {
  const raw = sampleA4Invoice();
  raw.groups = [
    { id: 2, entries: [{ id: 'top', type: 'top', lengthFt: '3.125', widthFt: '4.001', quantity: 3, authoritativeAmount: '37.51' }] },
    { id: 8, entries: [{ id: 'reg', type: 'regular', lengthFt: '3.5', widthFt: '4.25', quantity: 1, authoritativeAmount: '14.88' }] },
  ];
  const model = prepareA4Invoice(raw);
  assert.equal(formatA4Dimension(model.groups[0].entries[0].lengthFt), '3.125');
  assert.equal(formatA4Dimension(model.groups[1].entries[0].lengthFt), '3½');
  assert.equal((renderA4Group(model.groups[0]).match(/subtotal/g) || []).length, 1);
  assert.match(renderA4Group(model.groups[0]), /Top subtotal/);
  assert.doesNotMatch(renderA4Group(model.groups[0]), /Reg\. subtotal/);
  assert.match(renderA4Group(model.groups[1]), /Reg\. subtotal/);
  assert.doesNotMatch(renderA4Group(model.groups[1]), /Top subtotal/);
  assert.equal(amountInWords('12345678.90'), 'Rupees One Crore Twenty-three Lakh Forty-five Thousand Six Hundred Seventy-eight and Ninety Paise Only.');
  assert.equal(formatA4Money('12345678.90'), '₹12,345,678.90');

  const legacy = { status: 'Delivered', date: '2026-10-11', dispatchSlipNumber: 'LEGACY', partyName: 'Legacy', supervisor: 'S',
    logistics: { truckNumber: 'T', buyerDestination: 'D' }, businessSnapshot: { businessName: 'Original' },
    inventory: [{ ratePerSqFt: 40, pieces: [{ lengthFt: 3, widthFt: 2 }, { lengthFt: 4, widthFt: 1 }] }],
    summary: { totalPieces: 2, totalDispatchVolumeSqFt: 10, baseMaterialTotal: 400, loadingAndRoyaltyFees: 0, netBillableAmount: 400 } };
  assert.deepEqual(a4InvoiceFromDispatch(legacy).groups[0].entries.map(entry => entry.quantity), [1, 1]);
});

test('untrusted text is escaped and invalid input is rejected, never replaced with fictional values', () => {
  const raw = sampleA4Invoice();
  raw.party = '<img src=x onerror="alert(1)">';
  raw.invoiceNumber = '<script>alert(2)</script>';
  const model = prepareA4Invoice(raw);
  const html = renderA4Invoice(model, fixedSampleA4Pages(model));
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|<img src=x/);
  for (const change of [
    fixture => { fixture.party = ''; },
    fixture => { fixture.groups[0].entries[0].lengthFt = 0; },
    fixture => { fixture.groups[0].entries[0].quantity = 1.5; },
    fixture => { fixture.groups[0].entries[0].type = 'unknown'; },
    fixture => { fixture.groups[1].id = 1; },
    fixture => { fixture.groups[0].entries[0].id = fixture.groups[0].entries[1].id; },
    fixture => { fixture.groups[0].entries[0].ratePerSqFt = null; },
    fixture => { fixture.loadingRoyalty = '19.999'; },
  ]) { const invalid = sampleA4Invoice(); change(invalid); assert.throws(() => prepareA4Invoice(invalid)); }
});

test('height packing keeps whole groups together; oversized groups split only between entries', () => {
  const small = (count, entries = 2) => Array.from({ length: count }, (_, index) => ({ id: index + 1, entries: Array.from({ length: entries }, (_, n) => ({ id: `${index}-${n}` })) }));
  const size = (group, from, to) => 12 + (to - from) * 11 + (to === group.entries.length ? 4 : 0);
  const groups = small(36);
  const pages = planA4Invoice({ mode: 'production', groups }, size, { regular: 90, final: 42 });
  assert.deepEqual(fragments(pages).map(part => part.group.id), groups.map(group => group.id));
  assert.equal(pages.filter(page => page.summary).length, 1);
  assert.equal(pages.at(-1).summary, true);
  for (const page of pages) for (const column of page.columns) assert.ok(column.reduce((height, part) => height + size(part.group, part.from, part.to), 0) <= (page.summary ? 42 : 90));

  const giant = small(1, 20), split = packA4Groups(giant, size, 95);
  const parts = fragments(split);
  assert.ok(parts.length >= 3);
  assert.deepEqual(parts.flatMap(part => giant[0].entries.slice(part.from, part.to).map(entry => entry.id)), giant[0].entries.map(entry => entry.id));
  assert.equal(parts.at(-1).to, 20);
  const sample = prepared();
  const giantGroup = { ...sample.groups[0], id: 80,
    entries: Array.from({ length: 20 }, (_, index) => ({ ...sample.groups[0].entries[index % 7], id: `oversized-${index}` })) };
  const html = parts.map(part => renderA4Group(giantGroup, part.from, part.to)).join('');
  assert.equal((html.match(/class="total"/g) || []).length, 1);
  assert.equal((html.match(/class="continuation-marker"/g) || []).length, parts.length - 1);
});

test('a separate summary page is used when one intact group cannot share its page with the closing block', () => {
  const raw = sampleA4Invoice(), model = prepareA4Invoice({ ...raw, mode: 'production', status: 'Dispatched', groups: raw.groups.slice(0, 1) });
  const size = () => 70;
  const pages = planA4Invoice(model, size, { regular: 100, final: 40 });
  assert.equal(pages.length, 2);
  assert.deepEqual(groupsOn(pages[0]), [[1], [], []]);
  assert.deepEqual(groupsOn(pages[1]), [[], [], []]);
  assert.equal(pages[1].summary, true);
});