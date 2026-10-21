import test from 'node:test';
import assert from 'node:assert/strict';
import { a4InvoiceFromDispatch, amountInWords, formatA4Dimension, formatA4Money, formatA4Number, formatA4Rate, projectCopy,
  prepareA4Invoice, sampleA4Invoice, bankDetailPairs, AREA_ROUNDING_NOTE, SAMPLE_BANK_NAMES, SAMPLE_BANK_PAIRS } from '../src/utils/a4InvoiceModel.js';
import { continuationText, escapeA4Text, renderA4Group, renderA4Header, renderA4Invoice, renderA4MeasureSheet, renderA4Page, renderA4Pages,
  renderStandaloneA4Invoice } from '../src/utils/a4InvoiceRender.js';
import { planFromMeasurements, wholeGroupUnits } from '../src/utils/a4InvoicePagination.js';

const prepared = () => prepareA4Invoice(sampleA4Invoice());
const hits = (text, pattern) => (text.match(pattern) || []).length;
const sheetsOf = html => html.split('<article ').slice(1);
// Synthetic measured plan: every group `height` px, reference-like capacities.
const planOf = (model, { height = 176, normalCapacity = 889, finalCapacity = 650, gap = 8 } = {}) =>
  planFromMeasurements(model, wholeGroupUnits(model), { heights: model.groups.map(() => height), normalCapacity, finalCapacity, gap });
const render = (model, copy = 'buyer', prefix = 'document', geometry) => {
  const view = projectCopy(model, copy);
  return renderA4Invoice(view, planOf(view, geometry), copy, prefix);
};
const dispatch = (extra = {}) => ({
  status: 'Dispatched', date: '2026-10-11', dispatchSlipNumber: 'GS-42', partyName: 'Venkata Granites', supervisor: 'Ramesh',
  logistics: { truckNumber: 'AP 37 TA 4312', buyerDestination: 'Kadapa' },
  businessSnapshot: { businessName: 'Original Stone Works', address: 'Kadapa', signatoryName: 'R. Owner', bankDetails: 'Holder: Stone Works\nBank: SBI\nUPI: works@sbi' },
  inventory: [{ ratePerSqFt: 40, measurementRows: [
    { rowNo: 1, lengthFt: 5, widthFt: 6, quantity: 20, category: 'Regular', lineTotal: 24000 },
    { rowNo: 1, lengthFt: 5, widthFt: 6.75, quantity: 4, category: 'TOP', lineTotal: 5400 },
    { rowNo: 2, lengthFt: 4, widthFt: 3, quantity: 2, category: 'Regular', lineTotal: 960 },
  ] }],
  summary: { loadingAndRoyaltyFees: 500 }, ...extra,
});
const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  assert.equal(formatA4Number(model.totals.area), '5,537.88');
  assert.equal(formatA4Money(model.totals.netPayable), '₹222,015.00');
  assert.equal(formatA4Rate('1.005'), '₹1.005');
  assert.equal(formatA4Rate('25000.25'), '₹25,000.25');
  assert.equal(model.amountWords, 'Rupees Two Lakh Twenty-two Thousand Fifteen Only.');
  assert.deepEqual(model.warnings, []);
  assert.throws(() => prepareA4Invoice({ ...sampleA4Invoice(), supervisor: '  ' }), { message: 'Manager is required.' });
});

test('page 1 carries full header with Party, Lorry no., Destination and Manager; page 2 has minimal continued header', () => {
  const model = prepared(), pages = planOf(model);
  assert.equal(pages.length, 2);
  const html = renderA4Invoice(model, pages, 'buyer', 'buyer');
  const sheets = sheetsOf(html);
  assert.equal(sheets.length, 2);
  const header = renderA4Header(model);
  assert.equal(hits(sheets[0], /class="invoice-header"/g), 1);
  assert.ok(sheets[0].includes(header), 'full header on page 1');
  assert.equal(hits(sheets[1], /class="invoice-continued-header"/g), 1);
  assert.equal(hits(sheets[1], /class="invoice-header"/g), 0, 'page 2 does not repeat full header');
  assert.deepEqual([...header.matchAll(/<dt>([^<]+)<\/dt><dd[^>]*>([^<]+)<\/dd>/g)].map(([, l, v]) => [l, v]),
    [['Party', 'DEMO BUYER'], ['Lorry no.', 'DEMO-01'], ['Destination', 'DEMO CITY'], ['Manager', 'SAMPLE']]);
  assert.doesNotMatch(html, /Supervisor/i);
  assert.match(header, /<p class="invoice-reference">No\. SAMPLE-024 · Fictional data — not for payment<\/p>/);
  assert.match(header, /<h2 class="invoice-kind">Sample invoice<\/h2>/);
  assert.match(header, /<time datetime="2026-10-11">11 Oct 2026<\/time><span class="status">SAMPLE<\/span>/);
  assert.match(header, /<div aria-label="Business logo placeholder" class="logo-placeholder" role="img">LOGO<\/div>/);
  assert.match(header, /<p class="business-contact">Demo location, India<br>Illustrative business<\/p>/);
  assert.match(html, /aria-label="Sample invoice page 2 of 2"/);
  assert.match(html, /^<main aria-label="Sample invoice" class="a4-invoice sample-pages" data-page-count="2" data-group-count="24">/);

  const production = a4InvoiceFromDispatch(dispatch());
  const productionHeader = renderA4Header(production);
  assert.match(productionHeader, /<span class="status">IN TRANSIT<\/span>/);
  assert.match(productionHeader, /<p class="invoice-reference">No\. GS-42<\/p>/);
  assert.match(productionHeader, /<h2 class="invoice-kind">Buyer invoice<\/h2>/);
  assert.match(productionHeader, /<dt>Manager<\/dt><dd>Ramesh<\/dd>/);
  assert.match(productionHeader, /<dt>Lorry no\.<\/dt><dd class="mono">AP 37 TA 4312<\/dd>/);
  assert.match(renderA4Header(a4InvoiceFromDispatch(dispatch({ status: 'Delivered' }))), /<span class="status">DELIVERED<\/span>/);
  assert.match(renderA4Header(projectCopy(production, 'driver')), /<h2 class="invoice-kind">Driver slip<\/h2>/);
  const withLogo = renderA4Header({ ...production, seller: { ...production.seller, logo: 'data:image/png;base64,AAAA' } });
  assert.match(withLogo, /<div aria-label="Business logo" class="logo-placeholder has-logo" role="img"><img src="data:image\/png;base64,AAAA" alt=""><\/div>/);
});

test('measurement tables have seven columns, Reg total / Top total rows and no money', () => {
  const model = prepared();
  for (const copy of ['buyer', 'driver']) {
    const html = render(model, copy, copy);
    const tables = html.match(/<table class="row-table">[^]*?<\/table>/g);
    assert.equal(tables.length, 24);
    for (const table of tables) {
      assert.deepEqual([...table.match(/<thead>[^]*?<\/thead>/)[0].matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(([, text]) => text),
        ['Type', 'L (ft)', '', 'W (ft)', '', 'Qty', 'Sq ft']);
      assert.equal(hits(table, /<col class=/g), 7);
      assert.doesNotMatch(table, /₹|Rs\.|Rate|Amount|data-money/);
      for (const row of table.match(/<tr data-kind=[^]*?<\/tr>/g)) assert.equal(hits(row, /<t[hd][\s>]/g), 7);
    }
    assert.equal(hits(html, /data-subtotal="regular"/g), 24);
    assert.equal(hits(html, /data-subtotal="top"/g), 24);
    assert.equal(hits(html, /data-entry-id=/g), 168);
    assert.equal(hits(html, /<th class="type top" scope="row">Top<\/th>/g), 72);
    assert.equal(hits(html, /<th aria-label="Regular material" class="type" scope="row"><\/th>/g), 96);
  }
  const group = model.groups[0];
  const html = renderA4Group(group);
  const body = html.match(/<tbody>([^]*?)<\/tbody>/)[1];
  const rows = body.match(/<tr[^]*?<\/tr>/g);
  assert.equal(rows.length, 9);
  assert.equal(rows[4], `<tr class="sub" data-subtotal="regular"><th colspan="5" scope="row">Reg total</th><td class="qty">${group.regular.pieces}</td><td class="num">${formatA4Number(group.regular.area)}</td></tr>`);
  assert.equal(rows[8], `<tr class="sub" data-subtotal="top"><th colspan="5" scope="row">Top total</th><td class="qty">${group.top.pieces}</td><td class="num">${formatA4Number(group.top.area)}</td></tr>`);
  assert.equal(rows[4], '<tr class="sub" data-subtotal="regular"><th colspan="5" scope="row">Reg total</th><td class="qty">8</td><td class="num">123.38</td></tr>');
  assert.equal(rows[1], '<tr data-kind="regular" data-entry-id="1-2"><th aria-label="Regular material" class="type" scope="row"></th><td class="dim">3½</td><td aria-hidden="true" class="operator-cell times-cell">×</td><td class="dim">4½</td><td aria-hidden="true" class="operator-cell equals-cell">=</td><td class="qty">3</td><td class="num">47.25</td></tr>');
  assert.match(html, /^<section aria-labelledby="invoice-document-row-1-0-heading" class="row-block" id="invoice-document-row-1-0" data-group="1" data-from="0" data-to="7"><h3 id="invoice-document-row-1-0-heading"><span class="serial-badge">1<\/span><span class="group-rule" aria-hidden="true"><\/span><\/h3>/);

  // Top-only and Regular-only groups get only their own subtotal.
  const raw = sampleA4Invoice();
  raw.groups = [
    { id: 2, entries: [{ id: 'top', type: 'top', lengthFt: '3.125', widthFt: '4.001', quantity: 3, authoritativeAmount: '37.51' }] },
    { id: 8, entries: [{ id: 'reg', type: 'regular', lengthFt: '3.5', widthFt: '4.25', quantity: 1, authoritativeAmount: '14.88' }] },
  ];
  const [topOnly, regularOnly] = prepareA4Invoice(raw).groups.map(g => renderA4Group(g));
  assert.match(topOnly, /data-subtotal="top"/); assert.doesNotMatch(topOnly, /data-subtotal="regular"/);
  assert.match(regularOnly, /data-subtotal="regular"/); assert.doesNotMatch(regularOnly, /data-subtotal="top"/);
  assert.match(topOnly, /<td class="dim">3\.125<\/td>/);
  assert.throws(() => renderA4Group(group, 0, group.entries.length, 'seller'), /buyer or driver/);
  assert.throws(() => renderA4Group({ ...group, entries: [] }));
});

test('fragments of a split group carry a continued marker and each subtotal once', () => {
  const group = prepared().groups[0];
  const parts = [[0, 3], [3, 5], [5, 7]].map(([from, to]) => renderA4Group(group, from, to));
  assert.doesNotMatch(parts[0], /continuation-marker|data-subtotal/);
  assert.match(parts[1], /<h3 id="[^"]+"><span class="serial-badge">1<\/span><span class="continuation-marker">conti<\/span><span class="group-rule" aria-hidden="true"><\/span><\/h3>/);
  assert.match(parts[1], /Measurements for group 1, continued;/);
  assert.equal(hits(parts.join(''), /data-subtotal="regular"/g), 1);
  assert.match(parts[1], /data-subtotal="regular"/);
  assert.equal(hits(parts.join(''), /data-subtotal="top"/g), 1);
  assert.match(parts[2], /data-subtotal="top"/);
  assert.equal(hits(parts.join(''), /data-entry-id=/g), 7);
});

test('groups read in ascending order down columns 1, 2, 3; continuation on non-final pages; final section on the last page only', () => {
  const model = prepared();
  for (const copy of ['buyer', 'driver']) {
    const html = render(model, copy, copy);
    assert.deepEqual([...html.matchAll(/data-group="(\d+)"/g)].map(([, id]) => Number(id)), Array.from({ length: 24 }, (_, i) => i + 1));
    const sheets = sheetsOf(html);
    sheets.forEach((sheet, index) => {
      const last = index === sheets.length - 1;
      assert.equal(hits(sheet, /class="continuation"/g), last ? 0 : 1, `${copy} page ${index + 1} continuation`);
      assert.equal(hits(sheet, /class="final-section"/g), last ? 1 : 0, `${copy} page ${index + 1} final`);
      if (!last) assert.ok(sheet.includes(`<p class="continuation">${continuationText(copy)}</p>`));
      assert.equal(hits(sheet, /class="column-rule"/g), 3);
    });
  }
  assert.equal(continuationText('buyer'), 'Continued on the next page. Order totals and payment summary appear on the final page.');
  assert.equal(continuationText('driver'), 'Continued on the next page. Order totals appear on the final page.');
  // A summary-only final page has no measurement columns.
  const page = renderA4Page(model, { columns: [[], [], [], []], final: true }, 2, 2);
  assert.doesNotMatch(page, /detail-columns/);
  assert.match(page, /class="final-section"/);
  assert.throws(() => renderA4Invoice(model, [{ columns: [[], [], [], []], final: false }]), /final page/);
  assert.throws(() => renderA4Invoice(model, [{ columns: [[], [], []], final: true }]), /paginated columns/);
  assert.throws(() => renderA4Invoice(model, []), /paginated columns/);
});

test('buyer final section: order summary, three payment lines from the model, words once, bank and signature', () => {
  for (const model of [prepared(), a4InvoiceFromDispatch(dispatch())]) {
    const html = render(model, 'buyer', 'buyer');
    assert.deepEqual([...html.matchAll(/<div class="settlement-(?:row|net)"><dt>([^<]+)<\/dt><dd[^>]*>([^<]+)<\/dd>/g)].map(([, l, v]) => [l, v]),
      [['Material total', formatA4Money(model.totals.materialTotal)], ['Loading / royalty', formatA4Money(model.loadingRoyalty)], ['Net payable', formatA4Money(model.totals.netPayable)]]);
    assert.match(html, new RegExp(`<dt>Material total</dt><dd data-total="material">${escapeRe(formatA4Money(model.totals.materialTotal))}</dd>`));
    assert.equal(hits(html, new RegExp(escapeRe(formatA4Money(model.totals.materialTotal)), 'g')), 2);
    assert.match(html, new RegExp(`<dd data-total="pieces">${model.totals.pieces}</dd>`));
    assert.match(html, new RegExp(`<dd data-total="area">${escapeRe(formatA4Number(model.totals.area))}</dd>`));
    assert.equal(hits(html, new RegExp(escapeRe(model.amountWords), 'g')), 1);
    assert.match(html, /<div class="words-line"><p class="label">Amount in words<\/p><p class="amount-in-words">/);
    const order = ['class="invoice-summary"', 'class="amount-in-words"', 'class="bank-details"', 'class="sign"'].map(marker => html.indexOf(marker));
    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), `${model.mode}: summary → words → bank → signature`);
    assert.equal(hits(html, /class="sign"/g), 1);
  }
  const sample = render(prepared());
  assert.match(sample, /<div class="sign"><strong>Sample only<\/strong><span>Not valid for payment<\/span><\/div>/);
  const production = render(a4InvoiceFromDispatch(dispatch()));
  assert.match(production, /<div class="sign"><strong>R\. Owner<\/strong><span>Authorized signatory<\/span><\/div>/);
  const unsigned = render(a4InvoiceFromDispatch(dispatch({ businessSnapshot: { businessName: 'B' } })));
  assert.match(unsigned, /<div class="sign"><span>Authorized signatory<\/span><\/div>/);
});

test('bank details: sample placeholders with full names, production pairs or plain text, omitted when empty, escaped', () => {
  const sample = render(prepareA4Invoice({ ...sampleA4Invoice(), seller: { ...sampleA4Invoice().seller, bankDetails: 'Bank: REAL' } }));
  assert.match(sample, /<div class="bank-head"><h2 class="bank-heading" id="[^"]+-bank-heading">Bank details<\/h2><p class="bank-note">Preview placeholders only<\/p><\/div>/);
  assert.deepEqual([...sample.matchAll(/<div><dt aria-label="([^"]+)" title="([^"]+)">([^<]+)<\/dt><dd>([^<]+)<\/dd><\/div>/g)].map(([, a, t, l, v]) => [a, t, l, v]),
    SAMPLE_BANK_PAIRS.map(([label, value], i) => [SAMPLE_BANK_NAMES[i], SAMPLE_BANK_NAMES[i], `${label}:`, value]));
  assert.doesNotMatch(sample, /REAL/);
  const pairs = render(a4InvoiceFromDispatch(dispatch()));
  assert.match(pairs, /<dl class="bank-fields"><div><dt>Holder:<\/dt><dd>Stone Works<\/dd><\/div><div><dt>Bank:<\/dt><dd>SBI<\/dd><\/div><div><dt>UPI:<\/dt><dd>works@sbi<\/dd><\/div><\/dl>/);
  assert.doesNotMatch(pairs, /bank-note/);
  const plain = render(a4InvoiceFromDispatch(dispatch({ businessSnapshot: { businessName: 'B', bankDetails: 'SBI <A/C> 123\nUPI: works@sbi' } })));
  assert.match(plain, /<p class="bank-text">SBI &lt;A\/C&gt; 123 · UPI: works@sbi<\/p><\/section>/);
  assert.doesNotMatch(plain, /bank-fields/);
  const escaped = render(a4InvoiceFromDispatch(dispatch({ businessSnapshot: { businessName: 'B', bankDetails: `Holder: A <b>&</b> "C" 'D'` } })));
  assert.match(escaped, /<dt>Holder:<\/dt><dd>A &lt;b&gt;&amp;&lt;\/b&gt; &quot;C&quot; &#39;D&#39;<\/dd>/);
  for (const value of ['', '   ', null]) {
    const html = render(a4InvoiceFromDispatch(dispatch({ businessSnapshot: { businessName: 'B', bankDetails: value } })));
    assert.doesNotMatch(html, /Bank details|bank-details|bank-text/);
    assert.match(html, /<div class="footer-details"><div class="sign">/);
  }
});

test('driver slip has no money, words or bank anywhere and keeps pieces and area', () => {
  for (const model of [prepared(), a4InvoiceFromDispatch(dispatch())]) {
    const driver = projectCopy(model, 'driver');
    assert.equal(driver.title, 'Driver slip');
    const html = renderA4Invoice(driver, planOf(driver), 'driver', 'driver');
    for (const banned of [/₹/, /Rupees/, /Payment summary/, /Material total/, /Loading/, /Net payable/, /Bank details/, /bank-/, /works@sbi/, /SBI/, /\[Account holder name\]/, /Amount in words/])
      assert.doesNotMatch(html, banned);
    for (const value of [model.totals.materialTotal, model.totals.netPayable, model.loadingRoyalty]) assert.ok(!html.includes(formatA4Number(value)), value);
    assert.match(html, /<section aria-label="Order summary" class="invoice-summary driver-summary">/);
    assert.match(html, /<section aria-label="Authorization" class="closing"><div class="footer-details"><div class="sign">/);
    assert.match(html, new RegExp(`<dd data-total="pieces">${model.totals.pieces}</dd>`));
    assert.match(html, new RegExp(`<dd data-total="area">${escapeRe(formatA4Number(model.totals.area))}</dd>`));
    assert.match(html, /aria-label="Driver slip page 1 of/);
  }
});

test('superseded markup and notes are gone', () => {
  for (const html of [render(prepared()), render(prepared(), 'driver'), render(a4InvoiceFromDispatch(dispatch()))]) {
    assert.doesNotMatch(html, /group-total|data-total-row|page-foot|sample-note|rounding-note|Material amount|bank-grid|row-table-wrap|bank-block|Sample rate/);
    assert.ok(!html.includes(AREA_ROUNDING_NOTE.slice(0, 30)));
  }
});

test('buyer, driver and measure sheet mounted together keep ids unique and every aria reference resolves', () => {
  for (const model of [prepared(), a4InvoiceFromDispatch(dispatch())]) {
    const driver = projectCopy(model, 'driver');
    const html = render(model, 'buyer', 'buyer') + render(model, 'driver', 'driver') + render(model, 'buyer', 'history')
      + renderA4MeasureSheet(model, 'buyer', wholeGroupUnits(model), 'measure-buyer')
      + renderA4MeasureSheet(driver, 'driver', wholeGroupUnits(driver), 'measure-driver')
      + renderA4Pages(model, planOf(model), 'buyer', 'pdf-export');
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);
    assert.ok(ids.length > 0);
    assert.equal(new Set(ids).size, ids.length, `${model.mode}: duplicate ids`);
    const refs = [...html.matchAll(/\saria-(?:labelledby|describedby)="([^"]+)"/g)].flatMap(([, value]) => value.split(/\s+/));
    for (const ref of refs) assert.ok(ids.includes(ref), `${model.mode}: dangling aria reference ${ref}`);
  }
});

test('measure sheet: header, every unit in column 1, final section, continuation and the page ruler', () => {
  const model = prepared();
  const html = renderA4MeasureSheet(model, 'buyer', wholeGroupUnits(model));
  assert.equal(hits(html, /class="invoice-header"/g), 1);
  const columns = html.match(/<div class="detail-column">[^]*?(?=<div class="detail-column">|<\/section><header class="invoice-continued-header">)/g);
  assert.equal(columns.length, 4);
  assert.equal(hits(columns[0], /class="row-block"/g), 24);
  assert.equal(columns[1], '<div class="detail-column"><span class="column-rule" aria-hidden="true"></span></div>');
  assert.match(html, /<\/div><p class="continuation">Continued on the next page\. Order totals and payment summary appear on the final page\.<\/p><\/div><\/article><div class="page-height-ruler"><\/div>$/);
  assert.equal(hits(html, /class="final-section"/g), 1);
});

test('standalone HTML keeps the en-IN language tag and inlines the stylesheet', () => {
  const model = prepared();
  const html = renderStandaloneA4Invoice(model, planOf(model), '.a4-invoice{}', 'buyer');
  assert.match(html, /^<!doctype html><html lang="en-IN" dir="ltr">/);
  assert.match(html, /<title>Sample invoice — SAMPLE-024<\/title><style>\.a4-invoice\{\}<\/style><\/head><body class="a4-body"><main /);
  assert.equal(hits(html, /class="invoice-header"/g), 1);
  assert.equal(hits(html, /class="invoice-continued-header"/g), 1);
  assert.throws(() => renderStandaloneA4Invoice(model, planOf(model), '</style>'), /safe inline/);
});

test('production preserves saved lines, round-once summaries, categories and offline identity', () => {
  const record = {
    status: 'Dispatched', date: '2026-10-11', dispatchSlipNumber: 'LONG-INVOICE-REFERENCE-2026',
    partyName: 'Real client', supervisor: 'Yard Manager', logistics: { truckNumber: 'AP 12 ZX 0400', buyerDestination: 'Town' },
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
  const html = render(model);
  assert.match(html, /LONG-INVOICE-REFERENCE-2026/);
  assert.match(html, /<dt>Manager<\/dt><dd>Yard Manager<\/dd>/);
  assert.match(html, /<p class="business-contact">Yard Road<br><span class="phone">0123<\/span><\/p>/);
  assert.match(html, /<dd data-amount="material">₹2\.01<\/dd>/);
  assert.match(html, /<dd data-total="net">₹2\.11<\/dd>/);
  assert.doesNotMatch(html, /Rate \/ sq ft|data-rate|Bank details|Fictional|₹40\.00/);

  record.inventory[0].measurementRows[0].lineTotal = 2.01;
  const changed = a4InvoiceFromDispatch(record);
  assert.equal(changed.groups[0].entries[0].amount, '2.01', 'Never replace the saved amount with a guessed rate.');
  assert.ok(changed.warnings.some(warning => warning.includes('stored amount')));
  assert.ok(changed.warnings.some(warning => warning.includes('Net payable')));
});

test('historical piece-only records keep their entries; amount in words covers large values', () => {
  assert.equal(formatA4Dimension('3.5'), '3½');
  assert.equal(formatA4Dimension('0.25'), '¼');
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
  raw.supervisor = '<b>boss</b>';
  const html = render(prepareA4Invoice(raw));
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.match(html, /<dt>Manager<\/dt><dd>&lt;b&gt;boss&lt;\/b&gt;<\/dd>/);
  assert.doesNotMatch(html, /<script>|<img src=x|<b>boss/);
  assert.equal(escapeA4Text(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
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

test('seller bank details pass through from the snapshot, trimmed, and ignore non-strings', () => {
  const record = bankDetails => dispatch({ businessSnapshot: { businessName: 'Stone Works', bankDetails } });
  assert.equal(a4InvoiceFromDispatch(record('  SBI A/C 123, IFSC SBIN0001  ')).seller.bankDetails, 'SBI A/C 123, IFSC SBIN0001');
  for (const value of [undefined, null, '', '   ', 42, { a: 1 }]) assert.equal(a4InvoiceFromDispatch(record(value)).seller.bankDetails, '');
  assert.equal(prepared().seller.bankDetails, '');
});

test('bank details parse into label/value pairs only when every segment has one', () => {
  const text = 'Holder: Stone Works · Bank: SBI | A/c no.: 123; IFSC: SBIN0001\nUPI: works@sbi';
  assert.deepEqual(bankDetailPairs(text), [['Holder', 'Stone Works'], ['Bank', 'SBI'], ['A/c no.', '123'], ['IFSC', 'SBIN0001'], ['UPI', 'works@sbi']]);
  assert.deepEqual(bankDetailPairs('Bank: SBI, IFSC: SBIN0001'), [['Bank', 'SBI'], ['IFSC', 'SBIN0001']]);
  assert.equal(bankDetailPairs('SBI, Main branch'), null);
  assert.equal(bankDetailPairs('SBI <A/C> 123\nUPI: works@sbi'), null);
  assert.deepEqual(SAMPLE_BANK_PAIRS.map(([label]) => label), ['Holder', 'Bank', 'A/c no.', 'IFSC', 'Branch', 'UPI']);
  assert.deepEqual(SAMPLE_BANK_NAMES, ['Account holder', 'Bank name', 'Account number', 'IFSC code', 'Branch — optional', 'UPI ID — optional']);
});

test('production renders the bank details frozen in the dispatch snapshot, not the current settings value', () => {
  const model = a4InvoiceFromDispatch(dispatch({ businessSnapshot: { businessName: 'Stone Works', bankDetails: 'Bank: OLD BANK\nIFSC: OLDB0001' } }));
  const html = render(model);
  assert.match(html, /<dt>Bank:<\/dt><dd>OLD BANK<\/dd>/);
  assert.match(html, /<dt>IFSC:<\/dt><dd>OLDB0001<\/dd>/);
  assert.doesNotMatch(html, /NEW BANK|NEWB0009/);
});

test('projectCopy buyer returns the same model object', () => {
  const model = prepared();
  assert.equal(projectCopy(model, 'buyer'), model);
});

test('projectCopy driver drops every money field, is titled Driver slip and keeps rows, order, pieces, area and warnings', () => {
  const model = prepared();
  const snapshot = structuredClone(model);
  const driver = projectCopy(model, 'driver');
  assert.deepEqual(model, snapshot);
  assert.equal(driver.title, 'Driver slip');
  assert.equal(projectCopy(a4InvoiceFromDispatch(dispatch()), 'driver').title, 'Driver slip');
  for (const key of ['loadingRoyalty', 'amountWords']) assert.equal(key in driver, false, key);
  assert.equal('bankDetails' in driver.seller, false);
  for (const key of ['materialTotal', 'regularAmount', 'topAmount', 'netPayable']) assert.equal(key in driver.totals, false, key);
  for (const group of driver.groups) {
    for (const entry of group.entries) for (const key of ['ratePerSqFt', 'amount', 'unroundedAmount']) assert.equal(key in entry, false, key);
    for (const part of ['regular', 'top', 'total']) if (group[part]) assert.equal('amount' in group[part], false, part);
  }
  assert.deepEqual(driver.groups.map(group => group.id), model.groups.map(group => group.id));
  driver.groups.forEach((group, g) => {
    const source = model.groups[g];
    group.entries.forEach((entry, e) => {
      const { ratePerSqFt: _r, amount: _a, unroundedAmount: _u, ...rest } = source.entries[e];
      assert.deepEqual(entry, rest);
    });
    for (const part of ['regular', 'top', 'total']) {
      const { amount: _amount, ...rest } = source[part];
      assert.deepEqual(group[part], rest);
    }
  });
  const { materialTotal: _m, regularAmount: _ra, topAmount: _ta, netPayable: _n, ...totals } = model.totals;
  assert.deepEqual(driver.totals, totals);
  assert.equal(driver.warnings, model.warnings);
});

test('projectCopy rejects an unknown copy', () => {
  assert.throws(() => projectCopy(prepared(), 'seller'), /buyer or driver/);
  assert.throws(() => projectCopy(prepared(), undefined), /buyer or driver/);
});


test('buyer and driver headings omit operators without changing measurement rows', () => {
  for (const copy of ['buyer', 'driver']) {
    const html = render(prepared(), copy);
    const headings = [...html.matchAll(/<thead>([^]*?)<\/thead>/g)];
    assert.ok(headings.length > 0);
    for (const [, heading] of headings) {
      const text = heading.replace(/<[^>]*>/g, '');
      assert.doesNotMatch(text, /[X\u00d7=]/);
      assert.match(text, /L \(ft\)/);
      assert.match(text, /W \(ft\)/);
    }
    assert.match(html, /class="operator-cell times-cell">\u00d7<\/td>/);
    assert.match(html, /class="operator-cell equals-cell">=<\/td>/);
  }
});
