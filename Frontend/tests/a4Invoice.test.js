import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { a4InvoiceFromDispatch, amountInWords, formatA4Dimension, formatA4Money, formatA4Number, formatA4Rate,
  prepareA4Invoice, sampleA4Invoice, bankDetailPairs } from '../src/utils/a4InvoiceModel.js';
import { fixedSampleA4Pages, renderA4Invoice, renderA4Group, renderStandaloneA4Invoice } from '../src/utils/a4InvoiceRender.js';
import { packA4Groups, planA4Invoice } from '../src/utils/a4InvoicePagination.js';
import { a4InvoicePdf } from '../src/utils/a4InvoicePdf.js';

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
  assert.doesNotMatch(html, /class="total"|>Total<\/th>/);
  assert.equal((html.match(/data-subtotal="regular"/g) || []).length, 24);
  assert.equal((html.match(/data-subtotal="top"/g) || []).length, 24);
  assert.doesNotMatch(html, /col-amount|scope="col">Amount</);
  assert.equal((html.match(/<col class=/g) || []).length, 24 * 5);
  assert.equal((html.match(/class="type" scope="row" aria-label="Regular material"><\/th>/g) || []).length, 96);
  assert.equal((html.match(/class="type top" scope="row">Top<\/th>/g) || []).length, 72);
  assert.match(html, /Fictional data — not for payment/);
  assert.match(html, /5,537\.88/);
  assert.match(html, /₹222,015\.00/);
  assert.match(html, /Page 3 of 3/);
  assert.equal((html.match(/<dt>Material amount<\/dt><dd data-amount="material">₹126,580\.00<\/dd>/g) || []).length, 1);
  assert.match(html, /<dt>Top material amount<\/dt><dd data-amount="top">₹94,935\.00<\/dd>/);
  assert.match(html, /<dd data-total="material">₹221,515\.00<\/dd>/);
  assert.match(html, /<dd data-total="area">5,537\.88<\/dd>/);
  assert.match(html, /<dt>Loading \/ royalty<\/dt>/);
  assert.match(html, /<dt>Net payable<\/dt><dd data-total="net">₹222,015\.00<\/dd>/);
  assert.doesNotMatch(html, /Regular sq ft|Top sq ft|area-breakdown|data-total="(regular|top)"|settlement-rate|data-rate/);
  assert.doesNotMatch(html, /Bank \/ UPI details|class="bank-text"/);
  assert.match(html, /Preview placeholders only/);
  for (const [label, value] of [['Holder', 'Account holder name'], ['Bank', 'Bank name'], ['A\\/c no\\.', 'Account number'],
    ['IFSC', 'IFSC code'], ['Branch', 'Branch — optional'], ['UPI', 'UPI ID — optional']])
    assert.match(html, new RegExp(`<dt>${label}:<\\/dt><dd>\\[${value}\\]<\\/dd>`));
  assert.match(html, /Sample only/);
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
  assert.doesNotMatch(html, /Rate \/ sq ft|data-rate|settlement-rate/);
  assert.match(html, /<dd data-amount="material">₹1\.01<\/dd>/);
  assert.match(html, /<dd data-amount="top">₹1\.00<\/dd>/);
  assert.match(html, /Authorized signatory/);
  assert.doesNotMatch(html, /Bank details/);
  assert.doesNotMatch(html, /SAMPLE · FICTIONAL|₹40\.00/);

  record.inventory[0].measurementRows[0].lineTotal = 2.01;
  const changed = a4InvoiceFromDispatch(record);
  assert.equal(changed.groups[0].entries[0].amount, '2.01', 'Never replace the saved amount with a guessed rate.');
  assert.ok(changed.warnings.some(warning => warning.includes('stored amount')));
  assert.ok(changed.warnings.some(warning => warning.includes('Net payable')));
});

test('payment summary splits regular and top material amounts and shows no rate row', () => {
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
  assert.match(html, /data-amount="material">₹95\.50/);
  assert.match(html, /data-amount="top">₹9\.00/);
  assert.match(html, /data-total="material">₹104\.50/);
  const telugu = renderA4Invoice(model, pages, 'document', (_, te) => te);
  for (const rendered of [html, telugu]) assert.doesNotMatch(rendered, /Rates? \/ sq ft|చ\.అ\.|data-rate/);
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
  const [topOnly, regularOnly] = model.groups.map(group => renderA4Group(group));
  assert.match(topOnly, /data-subtotal="top"/); assert.doesNotMatch(topOnly, /data-subtotal="regular"/);
  assert.match(regularOnly, /data-subtotal="regular"/); assert.doesNotMatch(regularOnly, /data-subtotal="top"/);
  for (const html of [topOnly, regularOnly]) assert.doesNotMatch(html, /class="total"/);
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
  assert.equal((html.match(/data-subtotal="regular"/g) || []).length, 1);
  assert.equal((html.match(/data-subtotal="top"/g) || []).length, 1);
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

test('seller bank details pass through from the snapshot, trimmed, and ignore non-strings', () => {
  const record = (bankDetails) => ({
    status: 'Dispatched', date: '2026-10-11', dispatchSlipNumber: 'BANK-1', partyName: 'Client', supervisor: 'S',
    logistics: { truckNumber: 'AP 01', buyerDestination: 'Town' },
    businessSnapshot: { businessName: 'Stone Works', bankDetails },
    inventory: [{ ratePerSqFt: 10, measurementRows: [{ rowNo: 1, lengthFt: 2, widthFt: 2, quantity: 1, category: 'Regular', lineTotal: 40 }] }],
    summary: { loadingAndRoyaltyFees: 0 },
  });
  assert.equal(a4InvoiceFromDispatch(record('  SBI A/C 123, IFSC SBIN0001  ')).seller.bankDetails, 'SBI A/C 123, IFSC SBIN0001');
  for (const value of [undefined, null, '', '   ', 42, { a: 1 }]) assert.equal(a4InvoiceFromDispatch(record(value)).seller.bankDetails, '');
  const model = prepared();
  assert.equal(model.seller.bankDetails, '');
  assert.ok(model.totals.materialTotal && model.totals.area, 'Combined figures stay in the model.');
});

test('measurement tables show five columns, no money, and Regular / Top subtotals instead of a row total', () => {
  const model = prepared(), group = model.groups[0];
  const html = renderA4Group(group);
  const cells = row => (row.match(/<t[hd][\s>]/g) || []).length;
  for (const row of html.match(/<tr data-kind=[^]*?<\/tr>/g)) assert.equal(cells(row), 5);
  assert.equal(cells(html.match(/<thead>[^]*?<\/thead>/)[0]), 5);
  assert.equal((html.match(/<col class=/g) || []).length, 5);
  const regular = `<tr class="subtotal" data-subtotal="regular"><th colspan="3" scope="row">Regular subtotal</th><td class="qty">${group.regular.pieces}</td><td class="num">${formatA4Number(group.regular.area)}</td></tr>`;
  const top = `<tr class="subtotal" data-subtotal="top"><th colspan="3" scope="row">Top subtotal</th><td class="qty">${group.top.pieces}</td><td class="num">${formatA4Number(group.top.area)}</td></tr>`;
  // Regular lines, Regular subtotal, Top lines, Top subtotal; nothing after it.
  const body = html.match(/<tbody>([^]*?)<\/tbody>/)[1];
  assert.ok(body.indexOf(regular) > body.lastIndexOf('data-kind="regular"'));
  assert.ok(body.indexOf(regular) < body.indexOf('data-kind="top"'));
  assert.ok(body.endsWith(top));
  assert.doesNotMatch(html, /₹|Amount|<tfoot>|class="total"|>Total</);
  // Group 1 of the sample has 4 Regular then 3 Top entries.
  const first = renderA4Group(group, 0, 4), last = renderA4Group(group, 4, group.entries.length);
  assert.match(first, /data-subtotal="regular"/); assert.doesNotMatch(first, /data-subtotal="top"/);
  assert.match(last, /data-subtotal="top"/); assert.doesNotMatch(last, /data-subtotal="regular"/);
  const partial = renderA4Group(group, 0, 3);
  assert.doesNotMatch(partial, /data-subtotal/, 'A subtotal waits for the fragment holding its last entry.');
  assert.throws(() => renderA4Group({ ...group, entries: [] }));
});

test('summary shows a zero material amount and the closing shows escaped bank details only when present', () => {
  const record = (bankDetails, lineTotal = 40) => ({
    status: 'Dispatched', date: '2026-10-11', dispatchSlipNumber: 'BANK-2', partyName: 'Client', supervisor: 'S',
    logistics: { truckNumber: 'AP 01', buyerDestination: 'Town' },
    businessSnapshot: { businessName: 'Stone Works', bankDetails },
    inventory: [{ ratePerSqFt: lineTotal ? 10 : 0, measurementRows: [{ rowNo: 1, lengthFt: 2, widthFt: 2, quantity: 1, category: 'Regular', lineTotal }] }],
    summary: { loadingAndRoyaltyFees: 0 },
  });
  const render = model => renderA4Invoice(model, [{ columns: [[{ group: model.groups[0], from: 0, to: model.groups[0].entries.length }], [], []], summary: true }]);
  const withBank = render(a4InvoiceFromDispatch(record('SBI <A/C> 123\nUPI: works@sbi')));
  assert.match(withBank, /<p class="label bank-label" id="[^"]+">Bank details<\/p><p class="bank-text">SBI &lt;A\/C&gt; 123 · UPI: works@sbi<\/p>/);
  assert.match(withBank, /<dd data-amount="material">₹40\.00<\/dd>/);
  for (const value of ['', '   ', undefined]) {
    const html = render(a4InvoiceFromDispatch(record(value)));
    assert.doesNotMatch(html, /Bank details|bank-block|bank-text/);
    assert.match(html, /class="sign"/);
  }
  const zero = render(a4InvoiceFromDispatch(record('', 0)));
  assert.match(zero, /<dt>Material amount<\/dt><dd data-amount="material">₹0\.00<\/dd>/);
});

test('bank details parse into label/value pairs only when every segment has one', () => {
  const text = 'Holder: Stone Works · Bank: SBI | A/c no.: 123; IFSC: SBIN0001\nUPI: works@sbi';
  assert.deepEqual(bankDetailPairs(text), [['Holder', 'Stone Works'], ['Bank', 'SBI'], ['A/c no.', '123'], ['IFSC', 'SBIN0001'], ['UPI', 'works@sbi']]);
  assert.deepEqual(bankDetailPairs('Bank: SBI, IFSC: SBIN0001'), [['Bank', 'SBI'], ['IFSC', 'SBIN0001']]);
  assert.equal(bankDetailPairs('SBI, Main branch'), null);
  assert.equal(bankDetailPairs('SBI <A/C> 123\nUPI: works@sbi'), null);
  const model = a4InvoiceFromDispatch({ status: 'Dispatched', date: '2026-10-11', dispatchSlipNumber: 'BANK-3', partyName: 'Client', supervisor: 'S',
    logistics: { truckNumber: 'AP 01', buyerDestination: 'Town' }, businessSnapshot: { businessName: 'Stone Works', bankDetails: text },
    inventory: [{ ratePerSqFt: 10, measurementRows: [{ rowNo: 1, lengthFt: 2, widthFt: 2, quantity: 1, category: 'Regular', lineTotal: 40 }] }],
    summary: { loadingAndRoyaltyFees: 0 } });
  const html = renderA4Invoice(model, [{ columns: [[{ group: model.groups[0], from: 0, to: 1 }], [], []], summary: true }]);
  assert.match(html, /<dl class="bank-grid"/);
  assert.match(html, /<dt>Holder:<\/dt><dd>Stone Works<\/dd>/);
  assert.doesNotMatch(html, /bank-note/);
});

// jsPDF writes uncompressed text operators, so drawn strings appear as "(text) Tj".
const pdfText = async output => Buffer.from(await output.blob.arrayBuffer()).toString('latin1');
const count = (text, pattern) => (text.match(pattern) || []).length;

test('buyer invoice PDF follows the A4 invoice: Regular / Top subtotals, no row total, one summary', async () => {
  const record = {
    status: 'Dispatched', date: '2026-10-11', dispatchSlipNumber: 'GS-42', partyName: 'Venkata Granites', supervisor: 'Ramesh',
    logistics: { truckNumber: 'AP 37 TA 4312', buyerDestination: 'Kadapa' },
    businessSnapshot: { businessName: 'Original Stone Works', address: 'Kadapa', bankDetails: 'UPI: stone@upi' },
    inventory: [{ ratePerSqFt: 40, measurementRows: [
      { rowNo: 1, lengthFt: 5, widthFt: 6, quantity: 20, category: 'Regular', lineTotal: 24000 },
      { rowNo: 1, lengthFt: 5, widthFt: 6.75, quantity: 4, category: 'TOP', lineTotal: 5400 },
      { rowNo: 2, lengthFt: 4, widthFt: 3, quantity: 2, category: 'Regular', lineTotal: 960 },
    ] }],
    summary: { loadingAndRoyaltyFees: 500 },
  };
  const output = a4InvoicePdf(a4InvoiceFromDispatch(record), 'Invoice.pdf');
  const text = await pdfText(output);
  assert.equal(output.filename, 'Invoice.pdf');
  assert.equal(output.pages, 1);
  assert.ok(text.startsWith('%PDF-'));
  assert.equal(count(text, /\(Regular subtotal\) Tj/g), 2, 'one Regular subtotal per row');
  assert.equal(count(text, /\(Top subtotal\) Tj/g), 1, 'only row 1 has Top lines');
  assert.equal(count(text, /\(Total\) Tj/g), 0, 'no combined per-row total');
  for (const value of ['\\(600.00\\)', '\\(135.00\\)', '\\(6\u00be\\)', 'BUYER INVOICE', 'IN TRANSIT', 'ORDER SUMMARY', 'PAYMENT SUMMARY',
    'NET PAYABLE', '\\(Rs. 30,860.00\\)', 'Top material amount', '\\(Rs. 24,960.00\\)', '\\(Rs. 5,400.00\\)', '\\(Rs. 30,360.00\\)',
    'BANK DETAILS', 'stone@upi', 'Rupees Thirty Thousand Eight Hundred Sixty Only.', 'Authorized signatory', 'Page 1 of 1'])
    assert.match(text, new RegExp(value));
  assert.doesNotMatch(text, /Rate \/ sq ft|Rates \/ sq ft/);
});

test('buyer invoice PDF paginates long bills with the shared planner and keeps every entry', async () => {
  const lines = Array.from({ length: 90 }, (_, i) => ({ rowNo: 1 + Math.floor(i / 6), lengthFt: 4, widthFt: 3, quantity: 1, category: i % 6 > 3 ? 'TOP' : 'Regular', lineTotal: 480 }));
  const record = { status: 'Delivered', date: '2026-10-11', dispatchSlipNumber: 'LONG', partyName: 'P', supervisor: 'S',
    logistics: { truckNumber: 'T', buyerDestination: 'D' }, businessSnapshot: { businessName: 'B' },
    inventory: [{ ratePerSqFt: 40, measurementRows: lines }], summary: { loadingAndRoyaltyFees: 0 } };
  const output = a4InvoicePdf(a4InvoiceFromDispatch(record));
  const text = await pdfText(output);
  assert.ok(output.pages >= 2);
  assert.equal(count(text, /\/Type \/Page\b/g), output.pages);
  assert.equal(count(text, /\(Regular subtotal\) Tj/g), 15);
  assert.equal(count(text, /\(Top subtotal\) Tj/g), 15);
  assert.equal(count(text, /NET PAYABLE/g), 1, 'summary appears once, on the final page');
  assert.equal(count(text, /Continued on the next page/g), output.pages - 1);
  assert.match(text, new RegExp(`Page ${output.pages} of ${output.pages}`));
});

test('sample buyer invoice PDF uses the approved three-page layout', async () => {
  const output = a4InvoicePdf(prepared());
  const text = await pdfText(output);
  assert.equal(output.pages, 3);
  assert.equal(count(text, /\(Regular subtotal\) Tj/g), 24);
  assert.match(text, /SAMPLE INVOICE/); assert.match(text, /Not valid for payment/);
  assert.match(text, /Preview placeholders only/);
  assert.match(text, /\[Account holder name\]/);
});
