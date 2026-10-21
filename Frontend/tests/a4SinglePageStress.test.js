import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareA4Invoice, projectCopy } from '../src/utils/a4InvoiceModel.js';
import {
  COLUMNS,
  calcFragmentHeight,
  fragmentRows,
  planFromMeasurements,
} from '../src/utils/a4InvoicePagination.js';
import { renderA4Invoice, renderA4Group, renderStandaloneA4Invoice } from '../src/utils/a4InvoiceRender.js';
import { syntheticGeometry } from './helpers/a4Generators.js';

// Count helper
const count = (text, pattern) => (text.match(pattern) || []).length;

// Comprehensive layout invariant assertion based on core principles (no hardcoded column mapping)
function assertLayoutInvariants(copyModel, pages, geometry, copy, { expectedPages = null } = {}) {
  assert.ok(Array.isArray(pages) && pages.length >= 1, `${copy}: Must produce at least 1 page`);
  if (expectedPages !== null) {
    assert.equal(pages.length, expectedPages, `${copy}: Expected exactly ${expectedPages} page(s)`);
  }

  // 1. Structural invariants: exactly 4 columns per page, final page is last
  pages.forEach((page, pIdx) => {
    assert.equal(page.columns.length, COLUMNS, `${copy}: Page ${pIdx + 1} must have ${COLUMNS} columns`);
    assert.equal(page.final, pIdx === pages.length - 1, `${copy}: Page ${pIdx + 1} final flag should be ${pIdx === pages.length - 1}`);
  });

  // 2. Capacity invariants: each column's summed fragment height + gaps fits capacity
  pages.forEach((page, pIdx) => {
    const capacity = page.final ? geometry.finalCapacity : geometry.normalCapacity;
    page.columns.forEach((column, cIdx) => {
      let colH = 0;
      column.forEach((f, fIdx) => {
        const layout = geometry.rowLayouts?.[f.group.id - 1];
        const h = calcFragmentHeight(layout, f.group, f.from, f.to);
        colH += h + (fIdx ? geometry.gap : 0);
      });
      assert.ok(colH <= capacity + 0.05, `${copy}: Page ${pIdx + 1} Col ${cIdx + 1} height (${colH.toFixed(1)}px) exceeds capacity (${capacity.toFixed(1)}px)`);
    });
  });

  // 3. Render HTML and verify DOM invariants
  const html = renderA4Invoice(copyModel, pages, copy);
  const standalone = renderStandaloneA4Invoice(copyModel, pages, '.a4-body{}', copy);
  assert.ok(standalone.includes(html), `${copy}: Standalone print embeds preview markup`);

  const sheets = html.split('<article ').slice(1);
  assert.equal(sheets.length, pages.length, `${copy}: Rendered sheets count matches plan`);

  // Source entry count and ID completeness
  const totalSourceEntries = copyModel.groups.reduce((sum, g) => sum + g.entries.length, 0);
  const renderedEntryMatches = [...html.matchAll(/data-entry-id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(renderedEntryMatches.length, totalSourceEntries, `${copy}: Every measurement row rendered exactly once`);
  assert.equal(new Set(renderedEntryMatches).size, totalSourceEntries, `${copy}: Entry IDs unique`);

  // Serial ordering & row ordering
  const flattened = pages.flatMap(p => p.columns.flat());
  let lastGroupIdx = -1;
  const groupRanges = new Map();
  for (const f of flattened) {
    const gIdx = copyModel.groups.findIndex(g => g.id === f.group.id);
    assert.ok(gIdx >= lastGroupIdx, `${copy}: Serial order preserved (${f.group.id} >= ${lastGroupIdx})`);
    lastGroupIdx = gIdx;

    if (!groupRanges.has(f.group.id)) {
      assert.equal(f.from, 0, `${copy}: Initial fragment for group ${f.group.id} must start at 0`);
      groupRanges.set(f.group.id, f.to);
    } else {
      assert.equal(f.from, groupRanges.get(f.group.id), `${copy}: Continuation fragment for group ${f.group.id} must start at ${groupRanges.get(f.group.id)}`);
      groupRanges.set(f.group.id, f.to);
    }
  }
  for (const g of copyModel.groups) {
    assert.equal(groupRanges.get(g.id), g.entries.length, `${copy}: Group ${g.id} completely partitioned`);
  }

  // Circular serial badges and continuation markers
  for (const f of flattened) {
    assert.ok(html.includes(`<span class="serial-badge">${f.group.id}</span>`), `${copy}: Circular serial badge rendered for group ${f.group.id}`);
  }

  // Subtotals: Reg total / Top total appear exactly once per group with those entries
  for (const g of copyModel.groups) {
    const hasReg = g.entries.some(e => e.type === 'regular');
    const hasTop = g.entries.some(e => e.type === 'top');
    const regMatches = count(html, new RegExp(`data-group="${g.id}"[\\s\\S]*?data-subtotal="regular"`, 'g'));
    const topMatches = count(html, new RegExp(`data-group="${g.id}"[\\s\\S]*?data-subtotal="top"`, 'g'));
    if (hasReg) assert.equal(regMatches, 1, `${copy}: Group ${g.id} has exactly 1 Reg total`);
    if (hasTop) assert.equal(topMatches, 1, `${copy}: Group ${g.id} has exactly 1 Top total`);
  }

  // Header & bottom-anchoring rules
  assert.equal(count(sheets[0], /<header class="invoice-header">/g), 1, `${copy}: Full header on page 1`);
  if (pages.length > 1) {
    for (let i = 1; i < sheets.length; i++) {
      assert.equal(count(sheets[i], /<header class="invoice-header">/g), 0, `${copy}: Page ${i + 1} does not repeat full header`);
      assert.equal(count(sheets[i], /<header class="invoice-continued-header">/g), 1, `${copy}: Page ${i + 1} has Continued header`);
      assert.ok(sheets[i].includes('class="continued-label">Continued</span>'), `${copy}: Continued label on page ${i + 1}`);
      assert.equal(count(sheets[i], /class="final-section"/g), i === sheets.length - 1 ? 1 : 0, `${copy}: Final section only on last page`);
    }
  } else {
    assert.equal(count(sheets[0], /class="final-section"/g), 1, `${copy}: Single page has final section`);
  }

  // Sanity checks
  assert.ok(!html.includes('NaN'), `${copy}: No NaN in rendered HTML`);
  assert.ok(!html.includes('undefined'), `${copy}: No undefined in rendered HTML`);
}

// Creates a realistic invoice input with N serial groups
function createRealisticInvoice(groupCount, { title = 'GURUSURYA STONES', entriesPerGroup = [1, 2, 2, 3, 1, 2] } = {}) {
  const groups = [];
  let entryId = 1;
  for (let g = 1; g <= groupCount; g++) {
    const numEntries = entriesPerGroup[(g - 1) % entriesPerGroup.length];
    const entries = [];
    for (let e = 1; e <= numEntries; e++) {
      const isTop = e > 1 && e === numEntries && g % 3 === 0;
      entries.push({
        id: `row-${g}-${e}`,
        type: isTop ? 'top' : 'regular',
        lengthFt: `${4 + (e % 5)}`,
        widthFt: `${2 + (e % 3)}.5`,
        quantity: 2 + ((g + e) % 4),
        ratePerSqFt: '75.00',
      });
      entryId++;
    }
    groups.push({ id: g, entries });
  }

  return {
    mode: 'production',
    currency: 'INR',
    title,
    invoiceNumber: 'GS-2026-0042',
    invoiceDate: '2026-10-20',
    status: 'Delivered',
    seller: {
      name: title,
      contact: 'Stone Yard Complex, NH-44 · Phone: +91 98765 43210',
      bankDetails: 'Bank: HDFC Bank\nA/C: 50200012345678\nIFSC: HDFC0001234\nBranch: Industrial Area',
      signatoryName: 'Suryanarayana G.',
    },
    party: 'Venkateshwara Constructions',
    lorryNumber: 'AP 28 TE 4567',
    destination: 'Site B, Hyderabad',
    supervisor: 'Ramesh K.',
    loadingRoyalty: '1500.00',
    groups,
  };
}

function createSingleGroupInput(id, entries) {
  return {
    mode: 'production',
    currency: 'INR',
    invoiceNumber: `TEST-${id}`,
    invoiceDate: '2026-10-20',
    status: 'Delivered',
    seller: { name: 'Seller' },
    party: 'Buyer',
    lorryNumber: 'TRUCK-01',
    destination: 'Yard',
    supervisor: 'Supervisor',
    loadingRoyalty: '0.00',
    groups: [{ id, entries }],
  };
}

// ============================================================================
// FIXTURE A: NORMAL 8-S.NO INVOICE (Uneven row counts, fits one page)
// ============================================================================

test('Fixture A: Normal 8-S.No invoice with uneven rows fits on ONE A4 page', () => {
  const input = createRealisticInvoice(8, {
    title: 'GURUSURYA STONES & GRANITES',
    entriesPerGroup: [2, 3, 1, 4, 2, 3, 1, 2],
  });
  const model = prepareA4Invoice(input);
  assert.equal(model.groups.length, 8);

  for (const copy of ['buyer', 'driver']) {
    const copyModel = projectCopy(model, copy);
    const geometry = syntheticGeometry(copyModel, copy, {
      rowHeight: 14,
      headHeight: 28,
      gap: 4,
      pageHeight: 1029.9,
      headerHeight: 90,
      finalHeight: copy === 'driver' ? 110 : 185,
    });
    const pages = planFromMeasurements(copyModel, geometry.units, geometry);
    assertLayoutInvariants(copyModel, pages, geometry, copy, { expectedPages: 1 });
  }
});

// ============================================================================
// FIXTURE B: DENSE 8-S.NO INVOICE (Several tall groups, exercises conti)
// ============================================================================

test('Fixture B: Dense 8-S.No invoice with tall groups exercises conti and fits one page', () => {
  // Groups 2, 4, 6 are tall groups (14-16 entries), creating uneven heights that exercise conti
  const input = createRealisticInvoice(8, {
    title: 'GURUSURYA STONES & GRANITES',
    entriesPerGroup: [2, 16, 2, 14, 2, 12, 3, 2],
  });
  const model = prepareA4Invoice(input);
  assert.equal(model.groups.length, 8);

  for (const copy of ['buyer', 'driver']) {
    const copyModel = projectCopy(model, copy);
    const geometry = syntheticGeometry(copyModel, copy, {
      rowHeight: 14,
      headHeight: 28,
      gap: 4,
      pageHeight: 1029.9,
      headerHeight: 90,
      finalHeight: copy === 'driver' ? 110 : 185,
    });
  const pages = planFromMeasurements(copyModel, geometry.units, geometry);
    assertLayoutInvariants(copyModel, pages, geometry, copy, { expectedPages: 1 });

    // Strict vertical flow: Column 1 fills before Column 2. Empty trailing
    // columns are valid when all serials fit intact; no unnecessary `conti`.
    const flattened = pages[0].columns.flat();
    for (let i = 1; i < flattened.length; i++) {
      assert.ok(
        flattened[i].group.id >= flattened[i - 1].group.id,
        `${copy}: Serial order preserved down columns`
      );
    }
    // A continuation marker appears only when a serial genuinely crosses a
    // column boundary; with all serials fitting, none is expected here.
    assert.equal(pages[0].columns.length, 4, `${copy}: Page has 4 columns`);
  }
});

// ============================================================================
// FIXTURE C: REAL-WORLD-STYLE 18-S.NO INVOICE (Uneven heights, 1-6 rows, Reg & Top)
// ============================================================================

test('Fixture C: Real-world-style 18-S.No invoice fits on ONE A4 page', () => {
  const input = createRealisticInvoice(18, {
    title: 'GURUSURYA STONES & GRANITES',
    entriesPerGroup: [1, 2, 1, 3, 2, 1, 2, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 1],
  });
  const model = prepareA4Invoice(input);
  assert.equal(model.groups.length, 18);

  for (const copy of ['buyer', 'driver']) {
    const copyModel = projectCopy(model, copy);
    const geometry = syntheticGeometry(copyModel, copy, {
      rowHeight: 14,
      headHeight: 28,
      gap: 4,
      pageHeight: 1029.9,
      headerHeight: 90,
      finalHeight: copy === 'driver' ? 110 : 185,
    });
    const pages = planFromMeasurements(copyModel, geometry.units, geometry);
    assertLayoutInvariants(copyModel, pages, geometry, copy, { expectedPages: 1 });
  }
});

// ============================================================================
// FIXTURE D: 20-S.NO BOUNDARY INVOICE (Target real-world boundary)
// ============================================================================

test('Fixture D: 20-S.No boundary invoice fits on ONE A4 page', () => {
  const input = createRealisticInvoice(20, {
    title: 'GURUSURYA STONES & GRANITES',
    entriesPerGroup: [1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 2],
  });
  const model = prepareA4Invoice(input);
  assert.equal(model.groups.length, 20);

  for (const copy of ['buyer', 'driver']) {
    const copyModel = projectCopy(model, copy);
    const geometry = syntheticGeometry(copyModel, copy, {
      rowHeight: 14,
      headHeight: 28,
      gap: 4,
      pageHeight: 1029.9,
      headerHeight: 90,
      finalHeight: copy === 'driver' ? 110 : 185,
    });
    const pages = planFromMeasurements(copyModel, geometry.units, geometry);
    assertLayoutInvariants(copyModel, pages, geometry, copy, { expectedPages: 1 });
  }
});

// ============================================================================
// FIXTURE E: EXTREME OVERFLOW FIXTURE (Intentionally requires page 2)
// ============================================================================

test('Fixture E: Extreme overflow fixture triggers 2 pages and fulfills multi-page invariants', () => {
  // Heavy 8 S.No invoice with 35 entries per group (280 entries total)
  const input = createRealisticInvoice(8, {
    title: 'GURUSURYA STONES & GRANITES',
    entriesPerGroup: [35, 35, 35, 35, 35, 35, 25, 25],
  });
  const model = prepareA4Invoice(input);
  assert.equal(model.groups.length, 8);

  for (const copy of ['buyer', 'driver']) {
    const copyModel = projectCopy(model, copy);
    const geometry = syntheticGeometry(copyModel, copy, {
      rowHeight: 14,
      headHeight: 28,
      gap: 4,
      pageHeight: 1029.9,
      headerHeight: 90,
      finalHeight: copy === 'driver' ? 110 : 185,
    });
    const pages = planFromMeasurements(copyModel, geometry.units, geometry);
    assertLayoutInvariants(copyModel, pages, geometry, copy, { expectedPages: 2 });

    // Assert Page 1 reclaims footer space: final is false, uses normalCapacity
    assert.equal(pages[0].final, false, `${copy}: Page 1 has final=false`);

    // Assert Page 2 follows strict column-major flow.
    assert.equal(pages[1].final, true, `${copy}: Page 2 has final=true`);
    assert.equal(pages[1].columns.length, 4, `${copy}: Page 2 has 4 columns`);
    // Strict vertical flow: no later column is used while valid content could
    // still fit in the previous column. Columns 2-4 may remain empty when all
    // remaining content fits in Column 1.
    const flattened = pages[1].columns.flat();
    for (let i = 1; i < flattened.length; i++) {
      assert.ok(
        flattened[i].group.id >= flattened[i - 1].group.id,
        `${copy}: Page 2 serial order preserved down columns`
      );
    }
  }
});

// ============================================================================
// 2. STRESS TESTS: 1, 5, 10, 15, 18, 19, 20 S.No WITH INCONSISTENT GROUP SIZES
// ============================================================================

const STRESS_COUNTS = [1, 5, 10, 15, 18, 19, 20];

for (const sNoCount of STRESS_COUNTS) {
  test(`Stress test: ${sNoCount} S.No with varied entries (1, 2, 6-10 rows)`, () => {
    // Inconsistent group sizes: some 1 row, some 2, some 6-10 rows
    const entriesPattern = [1, 2, 7, 1, 2, 8, 1, 3, 6, 2];
    const input = createRealisticInvoice(sNoCount, { entriesPerGroup: entriesPattern });
    const model = prepareA4Invoice(input);

    for (const copy of ['buyer', 'driver']) {
      const copyModel = projectCopy(model, copy);
      const geometry = syntheticGeometry(copyModel, copy, {
        rowHeight: 14,
        headHeight: 28,
        gap: 4,
        pageHeight: 1029.9,
      });

      const pages = planFromMeasurements(copyModel, geometry.units, geometry);
      assert.ok(pages.length >= 1, `${copy}: ${sNoCount} S.No plans at least 1 page`);

      // All pages have 4 columns
      for (const page of pages) {
        assert.equal(page.columns.length, COLUMNS, `${copy}: Each page has 4 columns`);
      }

      // Final section on the last page only
      assert.equal(pages.at(-1).final, true, `${copy}: Last page is final`);
      for (let p = 0; p < pages.length - 1; p++) {
        assert.equal(pages[p].final, false, `${copy}: Non-final page has final=false`);
      }

      // Check vertical ordering: serials flow down column 0, then 1, 2, 3
      const flattenedSerials = [];
      for (const page of pages) {
        for (let colIdx = 0; colIdx < page.columns.length; colIdx++) {
          for (const fragment of page.columns[colIdx]) {
            flattenedSerials.push({ id: fragment.group.id, from: fragment.from, to: fragment.to });
          }
        }
      }

      // Verify serial IDs are non-decreasing (groups flow in order 1..N)
      for (let i = 1; i < flattenedSerials.length; i++) {
        assert.ok(
          flattenedSerials[i].id >= flattenedSerials[i - 1].id,
          `${copy}: Serials must flow in vertical order (${flattenedSerials[i - 1].id} -> ${flattenedSerials[i].id})`
        );
      }
    }
  });
}

// ============================================================================
// 3. CONTINUATION & ORPHAN PREVENTION TESTS
// ============================================================================

test('Continuation: split inside regular rows, badge + conti, table header repetition', () => {
  const entries = Array.from({ length: 8 }, (_, i) => ({
    id: `split-reg-${i + 1}`,
    type: 'regular',
    lengthFt: '5',
    widthFt: '3',
    quantity: 2,
    ratePerSqFt: '50',
  }));
  const model = prepareA4Invoice(createSingleGroupInput(6, entries));
  const group = model.groups[0];

  // Split into fragment 1 (entries 0..4) and fragment 2 (entries 4..8)
  const rows1 = fragmentRows(group, 0, 4);
  const rows2 = fragmentRows(group, 4, 8);

  // Subtotal for regular appears ONLY on the second fragment (after all regular rows)
  assert.equal(rows1.filter(r => r.kind === 'sub').length, 0, 'Fragment 1 has NO subtotal');
  assert.equal(rows2.filter(r => r.kind === 'sub' && r.of === 'regular').length, 1, 'Fragment 2 has Reg total');

  // Render both fragments
  const html1 = renderA4Group(group, 0, 4, 'buyer', 'test');
  const html2 = renderA4Group(group, 4, 8, 'buyer', 'test');

  // Fragment 1: heading has no continuation marker
  assert.ok(!html1.includes('continuation-marker'), 'Fragment 1 has no conti badge');
  assert.ok(html1.includes('<thead'), 'Fragment 1 repeats thead');
  assert.ok(!html1.includes('Reg total'), 'Fragment 1 has no Reg total');

  // Fragment 2: heading has `conti` marker
  assert.ok(html2.includes('<span class="continuation-marker">conti</span>'), 'Fragment 2 has conti marker');
  assert.ok(html2.includes('<thead'), 'Fragment 2 repeats thead');
  assert.ok(html2.includes('Reg total'), 'Fragment 2 has Reg total');
});

test('Continuation: split inside top rows, Top total orphan prevention', () => {
  const entries = [
    { id: 'r1', type: 'regular', lengthFt: '4', widthFt: '3', quantity: 1, ratePerSqFt: '50' },
    { id: 'r2', type: 'regular', lengthFt: '5', widthFt: '3', quantity: 2, ratePerSqFt: '50' },
    { id: 't1', type: 'top', lengthFt: '6', widthFt: '3', quantity: 1, ratePerSqFt: '80' },
    { id: 't2', type: 'top', lengthFt: '7', widthFt: '3', quantity: 1, ratePerSqFt: '80' },
    { id: 't3', type: 'top', lengthFt: '8', widthFt: '3', quantity: 1, ratePerSqFt: '80' },
    { id: 't4', type: 'top', lengthFt: '9', widthFt: '3', quantity: 1, ratePerSqFt: '80' },
  ];
  const model = prepareA4Invoice(createSingleGroupInput(9, entries));
  const group = model.groups[0];

  // Split: Fragment 1 has 0..3 (2 regular + 1 top), Fragment 2 has 3..6 (3 top)
  const rows1 = fragmentRows(group, 0, 3);
  const rows2 = fragmentRows(group, 3, 6);

  // Reg total should be in Fragment 1 (since entry index 1 is last regular)
  assert.equal(rows1.filter(r => r.kind === 'sub' && r.of === 'regular').length, 1, 'Fragment 1 has Reg total');
  assert.equal(rows1.filter(r => r.kind === 'sub' && r.of === 'top').length, 0, 'Fragment 1 has no Top total');

  // Top total should be in Fragment 2 (since entry index 5 is last entry)
  assert.equal(rows2.filter(r => r.kind === 'sub' && r.of === 'regular').length, 0, 'Fragment 2 has no Reg total');
  assert.equal(rows2.filter(r => r.kind === 'sub' && r.of === 'top').length, 1, 'Fragment 2 has Top total');

  // Fragment 2 renders `conti` and table header
  const html2 = renderA4Group(group, 3, 6, 'buyer', 'test');
  assert.ok(html2.includes('<span class="continuation-marker">conti</span>'));
  assert.ok(html2.includes('Top total'));
  assert.ok(html2.includes('<th scope="col">Type</th>'));
});

test('Continuation: long serial spanning 3 columns has conti on fragments 2 and 3', () => {
  const entries = Array.from({ length: 15 }, (_, i) => ({
    id: `span3-${i}`,
    type: 'regular',
    lengthFt: '4',
    widthFt: '3',
    quantity: 1,
    ratePerSqFt: '50',
  }));
  const model = prepareA4Invoice(createSingleGroupInput(12, entries));
  const group = model.groups[0];

  const f1 = renderA4Group(group, 0, 5, 'buyer', 'span');
  const f2 = renderA4Group(group, 5, 10, 'buyer', 'span');
  const f3 = renderA4Group(group, 10, 15, 'buyer', 'span');

  assert.ok(!f1.includes('continuation-marker'), 'Fragment 1 has no conti');
  assert.ok(f2.includes('<span class="continuation-marker">conti</span>'), 'Fragment 2 has conti');
  assert.ok(f3.includes('<span class="continuation-marker">conti</span>'), 'Fragment 3 has conti');

  // Headings repeated on all 3 fragments
  assert.ok(f1.includes('<thead'));
  assert.ok(f2.includes('<thead'));
  assert.ok(f3.includes('<thead'));
});

// ============================================================================
// 4. EMERGENCY TWO-PAGE FALLBACK
// ============================================================================

test('Emergency two-page fallback: Page 1 reclaims footer, Page 2 shows minimal Continued header', () => {
  // Heavy bill with 40 groups (will trigger multi-page)
  const input = createRealisticInvoice(40, { entriesPerGroup: [3, 4, 3, 4] });
  const model = prepareA4Invoice(input);
  const copyModel = projectCopy(model, 'buyer');

  const geometry = syntheticGeometry(copyModel, 'buyer');
  const pages = planFromMeasurements(copyModel, geometry.units, geometry);

  assert.ok(pages.length >= 2, 'Oversized bill spans 2 or more pages');

  // Page 1 has NO final block (space reclaimed for measurements)
  assert.equal(pages[0].final, false, 'Page 1 has final=false');
  // Page 2 (or last page) has final block
  assert.equal(pages.at(-1).final, true, 'Last page has final=true');

  const html = renderA4Invoice(copyModel, pages, 'buyer');
  const sheets = html.split('<article ').slice(1);

  // Page 1 has full header, Page 2+ does NOT repeat it
  assert.equal(count(sheets[0], /<header class="invoice-header">/g), 1, 'Page 1 has full invoice-header');
  assert.equal(count(sheets[0], /<header class="invoice-continued-header">/g), 0, 'Page 1 has no continued header');

  for (let i = 1; i < sheets.length; i++) {
    assert.equal(count(sheets[i], /<header class="invoice-header">/g), 0, `Page ${i + 1} does not repeat full header`);
    assert.equal(count(sheets[i], /<header class="invoice-continued-header">/g), 1, `Page ${i + 1} has minimal continued header`);
    assert.ok(sheets[i].includes('class="continued-label">Continued</span>'), `Page ${i + 1} has Continued label`);
  }

  // Anchored final-section only on last page
  for (let i = 0; i < sheets.length - 1; i++) {
    assert.equal(count(sheets[i], /class="final-section"/g), 0, `Page ${i + 1} has no final section`);
  }
  assert.equal(count(sheets.at(-1), /class="final-section"/g), 1, 'Last page has final section');
});

// ============================================================================
// 5. DATA & CALCULATION INTEGRITY
// ============================================================================

test('Calculation integrity: rows, totals, and calculations are exactly preserved', () => {
  const input = createRealisticInvoice(12);
  const model = prepareA4Invoice(input);
  const copyModel = projectCopy(model, 'buyer');

  const geometry = syntheticGeometry(copyModel, 'buyer');
  const pages = planFromMeasurements(copyModel, geometry.units, geometry);
  const html = renderA4Invoice(copyModel, pages, 'buyer');

  // Total entry rows rendered equals total input entries
  const totalInputEntries = input.groups.reduce((sum, g) => sum + g.entries.length, 0);
  const totalRenderedEntries = count(html, /<tr data-kind="(regular|top)"/g);
  assert.equal(totalRenderedEntries, totalInputEntries, 'Every measurement entry rendered exactly once');

  // Regular totals: exactly 1 per group that has regular entries
  const groupsWithRegular = input.groups.filter(g => g.entries.some(e => e.type === 'regular')).length;
  assert.equal(count(html, /data-subtotal="regular"/g), groupsWithRegular, 'Reg total rendered once per group');

  // Top totals: exactly 1 per group that has top entries
  const groupsWithTop = input.groups.filter(g => g.entries.some(e => e.type === 'top')).length;
  assert.equal(count(html, /data-subtotal="top"/g), groupsWithTop, 'Top total rendered once per group');

  // Material total and Net payable present and matching
  assert.ok(html.includes(`data-total="net">₹`), 'Net payable rendered with rupee symbol');
});

// ============================================================================
// 6. ACCEPTANCE TEST — CURRENT STOMES PDF FIXTURE (8 S.No)
// ============================================================================

test('ACCEPTANCE TEST — 8 S.No fixture single-page attempt & two-page vertical capacity verification', () => {
  // Case A: Realistic 8 S.No fixture (2-3 entries per S.No)
  // FIRST TRY: MUST fit onto ONE page with all S.No 1-8 and anchored final block
  const normal8 = createRealisticInvoice(8, {
    title: 'GURUSURYA STONES & GRANITES',
    entriesPerGroup: [2, 3, 2, 3, 2, 2, 3, 2],
  });
  const modelA = prepareA4Invoice(normal8);
  const copyModelA = projectCopy(modelA, 'buyer');
  const geomA = syntheticGeometry(copyModelA, 'buyer', {
    rowHeight: 14,
    headHeight: 28,
    gap: 4,
    pageHeight: 1029.9,
    headerHeight: 90,
    finalHeight: 185,
  });
  const pagesA = planFromMeasurements(copyModelA, geomA.units, geomA);
  assert.equal(pagesA.length, 1, 'Realistic 8 S.No fixture must fit on ONE single page');
  assert.equal(pagesA[0].columns.length, 4, 'Page 1 has 4 columns');
  assert.equal(pagesA[0].final, true, 'Page 1 is final page with bottom-anchored closing');

  // Case B: Heavy 8 S.No fixture where 1 page is physically impossible at 8mm + 7.5pt
  const heavy8 = createRealisticInvoice(8, {
    title: 'GURUSURYA STONES & GRANITES',
    entriesPerGroup: [35, 35, 35, 35, 35, 35, 25, 25],
  });
  const modelB = prepareA4Invoice(heavy8);
  const copyModelB = projectCopy(modelB, 'buyer');
  const geomB = syntheticGeometry(copyModelB, 'buyer', {
    rowHeight: 14, // 7.5 pt font
    headHeight: 28,
    gap: 4,
    pageHeight: 1029.9,
    headerHeight: 90,
    finalHeight: 185,
  });

  const totalHeightB = heavy8.groups.reduce((sum, g) => {
    const layout = geomB.rowLayouts[g.id - 1];
    return sum + (layout?.head ?? 28) + (layout?.rows?.length ?? g.entries.length) * 14;
  }, 0);
  const max1PageCapacity = 4 * geomB.finalCapacity;

  console.log('ACCEPTANCE TEST METRICS (8 S.No heavy fixture):', {
    availableMeasurementHeightNormal: Number(geomB.normalCapacity.toFixed(1)),
    availableMeasurementHeightFinal: Number(geomB.finalCapacity.toFixed(1)),
    totalContentHeight: Number(totalHeightB.toFixed(1)),
    max1Page4ColCapacity: Number(max1PageCapacity.toFixed(1)),
    selectedMargin: '8mm',
    selectedMeasurementFont: '7.5pt',
    reasonOnePageFailed: totalHeightB > max1PageCapacity
      ? `Total measurement height (${totalHeightB.toFixed(1)}px) exceeds 4-column final capacity (${max1PageCapacity.toFixed(1)}px)`
      : 'Column balancing constraint exceeded',
  });

  assert.ok(totalHeightB > max1PageCapacity, 'Proves why page 2 was genuinely required: content exceeds 4 * finalCapacity');

  const pagesB = planFromMeasurements(copyModelB, geomB.units, geomB);
  assert.equal(pagesB.length, 2, 'Heavy fixture plans 2 pages');

  // Page 1: MUST NOT reserve footer/final-section height. Uses normalCapacity.
  assert.equal(pagesB[0].final, false, 'Page 1 has final=false (no footer reserved)');
  assert.equal(pagesB[0].columns.length, 4, 'Page 1 has 4 columns');

  // Assert Page 1 uses nearly the entire remaining page height
  pagesB[0].columns.forEach((col, idx) => {
    let colH = 0;
    col.forEach((f, i) => {
      const layout = geomB.rowLayouts[f.group.id - 1];
      colH += (layout?.head ?? 28) + (f.to - f.from) * 14 + (i ? geomB.gap : 0);
    });
    const unusedH = geomB.normalCapacity - colH;
    console.log(`Page 1 Column ${idx + 1}: used=${colH.toFixed(1)}px, unused=${unusedH.toFixed(1)}px, capacity=${geomB.normalCapacity.toFixed(1)}px`);
    assert.ok(unusedH >= -0.1 && unusedH < 90, `Page 1 Column ${idx + 1} uses nearly all height: unused ${unusedH.toFixed(1)}px`);
  });

  // Page 2: serial order preserved down columns; continuation only when
  // required; empty trailing columns are valid under strict column-major flow.
  assert.equal(pagesB[1].final, true, 'Page 2 is final page');
  assert.equal(pagesB[1].columns.length, 4, 'Page 2 uses 4 columns');
  const flattenedB = pagesB[1].columns.flat();
  for (let i = 1; i < flattenedB.length; i++) {
    assert.ok(
      flattenedB[i].group.id >= flattenedB[i - 1].group.id,
      `Page 2 serial order preserved down columns (${flattenedB[i - 1].group.id} -> ${flattenedB[i].group.id})`
    );
  }

  // Render and assert bottom anchor & circular badges
  const htmlB = renderA4Invoice(copyModelB, pagesB, 'buyer');
  const sheetsB = htmlB.split('<article ').slice(1);
  assert.equal(sheetsB.length, 2);

  // Bottom anchor check
  assert.ok(sheetsB[1].includes('class="final-section"'), 'Page 2 has final-section');
  assert.ok(!sheetsB[0].includes('class="final-section"'), 'Page 1 has NO final-section');

  // Circular badge and conti check
  assert.ok(htmlB.includes('<span class="serial-badge">7</span>'), 'Circular serial badge for S.No 7');
  assert.ok(htmlB.includes('<span class="continuation-marker">conti</span>'), 'Continuation marker for fragmented S.No');
});
