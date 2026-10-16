// ---------------------------------------------------------------------------
// Height-measured A4 pagination, ported from the reference invoice
// (sample_invoice_space_optimized.html). Pure functions: no DOM access. The
// heights come from the offscreen measure host in a4InvoiceMeasure.js (live
// bills) or from recorded measurements (fixed fictional samples).
//
// A page plan is `{ columns: [Fragment[], Fragment[], Fragment[]], final }`
// with `Fragment = { group, from, to }`, a half-open range of entry indexes.
// ---------------------------------------------------------------------------

export const COPIES = Object.freeze(['buyer', 'driver']);

/** A4 portrait with 12 mm margins: a 186 × 272.5 mm content box (reference ruler). */
export const A4 = Object.freeze({ widthMm: 210, heightMm: 297, marginMm: 12, contentWidthMm: 186, pageHeightMm: 272.5, safetyPx: 2 });

// --- Reference planner (verbatim port; only `export` added) ---------------

export function fillColumns(heights, start, end, capacity, gap) {
  const columns = [[], [], []];
  const used = [0, 0, 0];
  let index = start;
  if (capacity <= 0) return { columns, used, end: start };
  for (let col = 0; col < 3 && index < end; col += 1) {
    while (index < end) {
      const next = heights[index] + (columns[col].length ? gap : 0);
      if (used[col] + next > capacity + 0.01) break;
      columns[col].push(index);
      used[col] += next;
      index += 1;
    }
  }
  return { columns, used, end: index };
}

export function balancedRange(heights, start, end, capacity, gap) {
  const initial = fillColumns(heights, start, end, capacity, gap);
  if (initial.end !== end) return null;
  if (start === end) return initial;
  let low = Math.max.apply(null, heights.slice(start, end));
  let high = capacity;
  for (let i = 0; i < 36; i += 1) {
    const middle = (low + high) / 2;
    if (fillColumns(heights, start, end, middle, gap).end === end) high = middle;
    else low = middle;
  }
  return fillColumns(heights, start, end, Math.min(capacity, high + 0.01), gap);
}

export function planPages(heights, normalCapacity, finalCapacity, gap) {
  if (!Array.isArray(heights) || heights.some(h => !Number.isFinite(h) || h <= 0)) {
    throw new Error('Invalid group measurements');
  }
  if (!Number.isFinite(normalCapacity) || normalCapacity <= 0 ||
      !Number.isFinite(finalCapacity) || finalCapacity < 0 ||
      !Number.isFinite(gap) || gap < 0) {
    throw new Error('Invalid page measurements');
  }
  if (heights.some(h => h > normalCapacity + 0.01)) {
    // Never silently clip a group or discard its entries.
    throw new Error('A measurement group is taller than a usable column');
  }
  const pages = [];
  let start = 0;
  while (start < heights.length) {
    const final = balancedRange(heights, start, heights.length, finalCapacity, gap);
    if (final) {
      pages.push({ columns: final.columns, used: final.used, final: true });
      return pages;
    }
    const full = fillColumns(heights, start, heights.length, normalCapacity, gap);
    if (full.end === start) throw new Error('Page packing made no progress');
    if (full.end === heights.length) {
      // Two pages are necessary. Balance the remaining detail and final-page
      // reserved summary rather than unnecessarily stranding one group alone.
      let best = null;
      for (let split = start + 1; split < heights.length; split += 1) {
        const first = balancedRange(heights, start, split, normalCapacity, gap);
        const last = balancedRange(heights, split, heights.length, finalCapacity, gap);
        if (!first || !last) continue;
        const firstUnused = normalCapacity - Math.max.apply(null, first.used);
        const lastUnused = finalCapacity - Math.max.apply(null, last.used);
        const score = firstUnused * firstUnused + lastUnused * lastUnused;
        if (!best || score < best.score) best = { first, last, score };
      }
      if (best) {
        pages.push({ columns: best.first.columns, used: best.first.used, final: false });
        pages.push({ columns: best.last.columns, used: best.last.used, final: true });
      } else {
        // If no remaining whole group fits alongside the final summary,
        // keep that summary intact on its own page instead of cropping it.
        const first = balancedRange(heights, start, full.end, normalCapacity, gap);
        pages.push({ columns: first.columns, used: first.used, final: false });
        pages.push({ columns: [[], [], []], used: [0, 0, 0], final: true });
      }
      return pages;
    }
    const packed = balancedRange(heights, start, full.end, normalCapacity, gap);
    pages.push({ columns: packed.columns, used: packed.used, final: false });
    start = full.end;
  }
  pages.push({ columns: [[], [], []], used: [0, 0, 0], final: true });
  return pages;
}

// --- StoneDesk glue around the reference planner ---------------------------

/** Column capacities exactly as the reference computes them (all values in px). */
export function capacitiesFrom({ pageHeight, headerHeight, noticeHeight, finalHeight, safety = A4.safetyPx }) {
  return {
    normalCapacity: pageHeight - headerHeight - noticeHeight - safety,
    finalCapacity: pageHeight - headerHeight - finalHeight - safety,
  };
}

/** One unit per measurement group, holding all of its entries. */
export function wholeGroupUnits(model) {
  return model.groups.map(group => ({ group, from: 0, to: group.entries.length }));
}

/**
 * Table rows of the fragment `group.entries[from, to)`, in order: the entries,
 * a Regular subtotal right after the group's last Regular entry and a Top
 * subtotal after the group's last entry (only when the group has Top entries),
 * each only when that entry lies inside the range.
 */
export function fragmentRows(group, from, to) {
  const entries = group?.entries ?? [];
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from || to > entries.length) {
    throw new Error(`Invalid fragment of group ${group?.id}.`);
  }
  let lastRegular = -1;
  entries.forEach((entry, index) => { if (entry.type === 'regular') lastRegular = index; });
  const hasTop = entries.some(entry => entry.type === 'top');
  const rows = [];
  for (let index = from; index < to; index++) {
    rows.push({ kind: 'entry', index, entry: entries[index] });
    if (index === lastRegular) rows.push({ kind: 'sub', of: 'regular' });
    if (hasTop && index === entries.length - 1) rows.push({ kind: 'sub', of: 'top' });
  }
  return rows;
}

const OVERSIZED = 'A measurement group is taller than a usable column';

/**
 * Splits only the units taller than `capacity` at entry boundaries (the
 * reference throws instead; StoneDesk rows have no per-group line limit).
 * `rowLayouts[i] = { head, rows: [{ height, kind: 'entry', index } | { height, kind: 'sub', of }] }`
 * describes unit i as measured: `head` is the block top to its first body row.
 * Each fragment is as long as fits; subtotals stay with the entry they follow.
 */
export function splitOversizedUnits(units, heights, rowLayouts, capacity) {
  return units.flatMap((unit, i) => {
    if (!(heights[i] > capacity + 0.01)) return [unit];
    const layout = rowLayouts?.[i];
    if (!layout) throw new Error(OVERSIZED);
    const rowHeight = row => {
      const found = layout.rows.find(item => item.kind === row.kind && (row.kind === 'entry' ? item.index === row.index : item.of === row.of));
      if (!found) throw new Error(OVERSIZED);
      return found.height;
    };
    const fits = (from, to) => layout.head + fragmentRows(unit.group, from, to).reduce((sum, row) => sum + rowHeight(row), 0) <= capacity + 0.01;
    const parts = [];
    let from = unit.from;
    while (from < unit.to) {
      let to = from;
      while (to < unit.to && fits(from, to + 1)) to += 1;
      if (to === from) throw new Error(OVERSIZED);
      parts.push({ group: unit.group, from, to });
      from = to;
    }
    return parts;
  });
}

/** Turns a planPages() result (unit indexes) into renderable pages. */
export function pagesFromPlan(units, plan) {
  return plan.map(page => ({ columns: page.columns.map(column => column.map(index => units[index])), final: page.final }));
}

const ORDER_ERROR = 'Group ordering or completeness check failed';

/**
 * Exactly one final page, and it is last. Reading pages, then columns left to
 * right, then fragments top to bottom yields every group in ascending id order
 * and every entry of each group exactly once and contiguously.
 */
export function validateA4Pages(model, pages) {
  if (!Array.isArray(pages) || !pages.length || pages.some(page => !Array.isArray(page?.columns) || page.columns.length !== 3 || page.columns.some(column => !Array.isArray(column)))) throw new Error(ORDER_ERROR);
  if (pages.filter(page => page.final === true).length !== 1 || pages.at(-1).final !== true) throw new Error(ORDER_ERROR);
  const groups = model.groups;
  let groupIndex = 0, next = 0;
  for (const fragment of pages.flatMap(page => page.columns.flat())) {
    const group = groups[groupIndex];
    if (!group || fragment?.group?.id !== group.id || fragment.from !== next || !Number.isInteger(fragment.to)
      || fragment.to <= fragment.from || fragment.to > group.entries.length) throw new Error(ORDER_ERROR);
    next = fragment.to;
    if (next === group.entries.length) { groupIndex += 1; next = 0; }
  }
  if (groupIndex !== groups.length || next !== 0) throw new Error(ORDER_ERROR);
  return pages;
}

/** Plans one copy from measured unit heights and validates the result. */
export function planFromMeasurements(model, units, { heights, normalCapacity, finalCapacity, gap }) {
  if (!Array.isArray(units) || !Array.isArray(heights) || heights.length !== units.length) throw new Error('Invalid group measurements');
  const plan = planPages(heights, normalCapacity, finalCapacity, gap);
  const flattened = plan.flatMap(page => page.columns.flat());
  if (flattened.length !== units.length || flattened.some((index, i) => index !== i)) throw new Error(ORDER_ERROR);
  return validateA4Pages(model, pagesFromPlan(units, plan));
}

// ---------------------------------------------------------------------------
// Superseded millimetre planner. Still imported by a4InvoicePdf.js,
// printInvoice.js, BillView.jsx and the sample script until they move to the
// measured planner above; removed afterwards. Its pages carry both `summary`
// (read by the old PDF) and `final` (read by the renderer).
// ---------------------------------------------------------------------------

export function fixedSampleA4Pages(model) {
  if (model.mode !== 'sample' || model.groups.length !== 24 || model.groups.some((group, index) => group.id !== index + 1 || group.entries.length !== 7)) throw new Error('The approved sample requires its exact 24 numbered groups of seven entries.');
  const arrange = layout => ({ columns: layout.map(column => column.map(id => ({ group: model.groups[id - 1], from: 0, to: 7 }))), summary: false, final: false });
  const pages = [arrange([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    arrange([[10, 11, 12], [13, 14, 15], [16, 17, 18]]),
    arrange([[19, 20], [21, 22], [23, 24]])];
  pages.at(-1).summary = true;
  pages.at(-1).final = true;
  return pages;
}

/** Equal margin on all four sides of the A4 sheet. */
export const MARGIN = 8;
export const SHEET = Object.freeze({ width: 210, height: 297 });
/** Printable area inside the margins: 194 × 281 mm. */
export const PRINTABLE = Object.freeze({ width: SHEET.width - 2 * MARGIN, height: SHEET.height - 2 * MARGIN });

/**
 * Fixed per-fragment heights. Values match the current measurement table:
 * 7.2 pt row text at 4.3 mm per row (the existing PDF row constants).
 */
export const rowGeometry = Object.freeze({
  ROW_FONT_PT: 7.2,
  HEADING_H: 5.5,
  THEAD_H: 4.6,
  ROW_H: 4.3,
  TOTAL_ROW_H: 4.3,
  BLOCK_GAP: 4,
});

/** Height reclaimed from the removed per-page footer, continuation note and rounding note. */
export const reserves = Object.freeze({ footer: 0, continuation: 0, roundingNote: 0 });

/**
 * Identity block (page 1 only). IDENTITY_H is the existing PDF header band:
 * logo, business name, invoice facts, the divider and the gap above the
 * columns (12 → 53 mm in the current PDF = 41 mm). Sample_Mode adds the
 * one-line sample note under the header.
 */
export const headerGeometry = Object.freeze({ IDENTITY_H: 41, SAMPLE_NOTE_H: 4 });

/**
 * Closing-block component heights (mm). Each is the worst case the renderer
 * allows (two-line amount in words, two lines of bank pairs), so the reserve
 * never depends on the DOM and the closing block is never split.
 */
export const closingGeometry = Object.freeze({
  GAP: 4,               // space between the last column and the closing block
  PAYMENT_SUMMARY_H: 42, // order summary + Material / Loading / Net payable
  AMOUNT_WORDS_H: 11.1,  // label + up to two lines of words
  BANK_H: 12.8,          // label + up to two lines of three pairs
  SIGNATURE_H: 14,       // signature hairline, name and caption
  DRIVER_TOTALS_H: 24,   // total pieces and total area, no amounts
  PADDING: 3,
});

function assertCopy(copy) {
  if (!COPIES.includes(copy)) throw new Error(`Unknown bill copy "${copy}". Expected "buyer" or "driver".`);
}

/**
 * Deterministic height (mm) of the fragment `group.entries[from, to)` for either
 * copy. Heading + table header + one row per entry, plus one Total row only when
 * the fragment holds the group's last entry, plus the inter-block gap. Both copies
 * share row heights: the driver copy drops columns, never rows. No DOM access.
 */
export function fragmentHeight(group, from, to, copy = 'buyer') {
  assertCopy(copy);
  const count = group?.entries?.length ?? 0;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from || to > count) {
    throw new Error(`Invalid fragment ${from}–${to} of group ${group?.id}.`);
  }
  const { HEADING_H, THEAD_H, ROW_H, TOTAL_ROW_H, BLOCK_GAP } = rowGeometry;
  const total = to === count ? TOTAL_ROW_H : 0;
  return HEADING_H + THEAD_H + (to - from) * ROW_H + total + BLOCK_GAP;
}

/**
 * Height (mm) reserved for the closing block on the final page.
 * Buyer: payment summary + amount in words + bank block + signature.
 * Driver: closing totals without amounts + signature.
 * The bank block and signature sit side by side, so they share one row whose
 * height is the taller of the two. No rounding-note height is reserved.
 */
export function closingHeight(copy = 'buyer') {
  assertCopy(copy);
  const g = closingGeometry;
  const body = copy === 'buyer'
    ? g.PAYMENT_SUMMARY_H + g.AMOUNT_WORDS_H + Math.max(g.BANK_H, g.SIGNATURE_H)
    : g.DRIVER_TOTALS_H + g.SIGNATURE_H;
  return g.GAP + body + g.PADDING + reserves.roundingNote;
}

// Heights are exact millimetres; this only absorbs floating-point noise.
const EPSILON = 1e-6;

/**
 * Column capacities (mm) for one copy, derived from the 194 × 281 printable
 * area with zero footer / continuation reserves:
 *   first      — page 1 column, below the identity block
 *   regular    — pages 2+ column (no identity block: the full 281 mm)
 *   firstFinal — page 1 column when page 1 is also the final page
 *   final      — final-page column on pages 2+, above the closing block
 * Throws when the identity block and the closing block cannot share one page.
 */
export function a4Capacities(copy = 'buyer', model = null) {
  assertCopy(copy);
  const page = PRINTABLE.height - reserves.footer - reserves.continuation;
  const identity = headerGeometry.IDENTITY_H + (model?.mode === 'sample' ? headerGeometry.SAMPLE_NOTE_H : 0);
  const closing = closingHeight(copy);
  const first = page - identity, regular = page;
  const firstFinal = first - closing, final = regular - closing;
  assertHeaderAndClosingFit(firstFinal);
  return { first, regular, firstFinal, final };
}

function assertHeaderAndClosingFit(firstFinal) {
  if (firstFinal < -EPSILON) throw new Error('The header and final summary cannot fit together on a single A4 page. Shorten the supplied identity or amount in words.');
}

function emptyPage() { return { columns: [[], [], []], used: [0, 0, 0], start: null, summary: false }; }
function asPage(page) { return { columns: page.columns, summary: page.summary, final: page.summary }; }
const perPage = capacity => typeof capacity === 'function' ? capacity : () => capacity;

/**
 * Pack fragments into three columns per page. Ordinary groups remain intact;
 * only groups taller than a full empty column are split, at entry boundaries.
 * The measure callback receives the fragment range, including its trailing
 * Total row, so the last fragment cannot orphan a total.
 *
 * `capacity` and `fullCapacity` are a number (same on every page) or a function
 * of the page index, so page 1 can lose the identity block height.
 */
export function packA4Groups(groups, measure, capacity, from = { groupIndex: 0, entryIndex: 0 }, fullCapacity = capacity) {
  const capAt = perPage(capacity), fullAt = perPage(fullCapacity);
  const pages = [];
  let page, pageIndex = -1, columnIndex = 0;
  const open = () => {
    pageIndex++;
    const value = capAt(pageIndex);
    if (!(value > 0) || !Number.isFinite(value)) throw new Error('No printable space remains below the invoice header.');
    page = emptyPage(); pages.push(page); columnIndex = 0;
  };
  open();
  const cap = () => capAt(pageIndex), full = () => fullAt(pageIndex);
  const largest = Math.max(fullAt(0), fullAt(1));
  const used = () => page.used[columnIndex];
  const remaining = () => cap() - used();
  const advance = () => { if (++columnIndex === 3) open(); };
  const add = (group, groupIndex, start, end, height) => {
    if (!page.start) page.start = { groupIndex, entryIndex: start };
    page.columns[columnIndex].push({ group, from: start, to: end });
    page.used[columnIndex] += height;
  };

  for (let groupIndex = from.groupIndex; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex];
    let start = groupIndex === from.groupIndex ? from.entryIndex : 0;
    if (!Number.isInteger(start) || start < 0 || start >= group.entries.length) throw new Error(`Invalid start of group ${group.id}.`);
    const fullHeight = measure(group, start, group.entries.length);
    if (fullHeight > largest + EPSILON && group.entries.length === 1) throw new Error(`Group ${group.id} has a single entry too tall for an A4 column.`);

    if (fullHeight <= cap() + EPSILON) {
      if (fullHeight > remaining() + EPSILON) advance();
      add(group, groupIndex, start, group.entries.length, fullHeight);
      continue;
    }
    // A previously whole group cannot be split just to make room for the final
    // summary. The caller may instead place the summary on its own page.
    if (fullHeight <= full() + EPSILON) return null;

    while (start < group.entries.length) {
      let low = start + 1, high = group.entries.length, best = start, bestHeight = 0;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2), height = measure(group, start, middle);
        if (height <= remaining() + EPSILON) { best = middle; bestHeight = height; low = middle + 1; }
        else high = middle - 1;
      }
      if (best === start) {
        if (used()) { advance(); continue; }
        if (cap() < full()) return null;
        throw new Error(`Group ${group.id}, entry ${group.entries[start].id} cannot fit in an A4 column with its heading, table header and total.`);
      }
      add(group, groupIndex, start, best, bestHeight);
      start = best;
      if (start < group.entries.length) advance();
    }
  }
  return pages;
}

/**
 * The page plan: `pages[]` of `{ columns: [Fragment[] × 3], summary }`.
 * Capacities: `regular` / `final` for every page, with optional page-1 values
 * `first` / `firstFinal` (default: the same as pages 2+). The whole closing
 * block lands on the final page; when it does not fit below the last columns,
 * the suffix is repacked onto that same page when it fits, otherwise a new final
 * page with no measurement rows is added and the packed pages stay unchanged.
 */
export function planA4Invoice(model, measure, { regular, final, first = regular, firstFinal = final }) {
  const regularAt = index => index === 0 ? first : regular;
  const finalAt = index => index === 0 ? firstFinal : final;
  assertHeaderAndClosingFit(firstFinal);
  if (model.mode === 'sample') {
    const pages = fixedSampleA4Pages(model);
    pages.forEach((page, index) => page.columns.forEach(column => {
      const height = column.reduce((n, fragment) => n + measure(fragment.group, fragment.from, fragment.to), 0);
      if (height > (page.summary ? finalAt(index) : regularAt(index)) + EPSILON) throw new Error(`The approved sample overflows A4 page ${index + 1}. Check fonts, margins and browser print settings.`);
    }));
    return pages;
  }
  const original = packA4Groups(model.groups, measure, regularAt);
  const lastIndex = original.length - 1, last = original[lastIndex];
  if (Math.max(...last.used) <= finalAt(lastIndex) + EPSILON) {
    last.summary = true;
    return original.map(asPage);
  }

  // Reserve the entire closing block below the three columns on the final page.
  // Keep the already-full preceding pages unchanged, then try to repack only the
  // last page's suffix at final capacity. The repack is used only when it keeps
  // the page count (the suffix plus closing fit on that one page). Otherwise a
  // new page is needed either way, so the packed pages stay unchanged and the
  // closing block gets a dedicated final page with no rows: same page count,
  // and every page position keeps at least as many rows (Req 7.3).
  if (finalAt(lastIndex) > 0) {
    const repacked = packA4Groups(model.groups, measure, index => finalAt(lastIndex + index), last.start, index => regularAt(lastIndex + index));
    if (repacked && repacked.length === 1 && repacked[0].start) {
      repacked.at(-1).summary = true;
      return [...original.slice(0, -1).map(asPage), ...repacked.map(asPage)];
    }
  }
  return [...original.map(asPage), { columns: [[], [], []], summary: true, final: true }];
}

/**
 * The single deterministic plan for one copy, shared by the HTML preview,
 * print and the PDF. Synchronous, no DOM access.
 */
export function planA4Copy(model, copy = 'buyer') {
  const capacities = a4Capacities(copy, model);
  return planA4Invoice(model, (group, from, to) => fragmentHeight(group, from, to, copy), capacities);
}
