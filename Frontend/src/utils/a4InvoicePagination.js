import { fixedSampleA4Pages, renderA4Group, renderA4Page } from './a4InvoiceRender.js';

// Print insets and dimensions are in the shared CSS. This tolerance only guards
// against fractional-pixel rounding between CSS mm and the browser's print engine.
const SAFETY_PX = 5;
const EPSILON = 0.5;

function emptyPage() { return { columns: [[], [], []], used: [0, 0, 0], start: null, summary: false }; }
function asPage(page) { return { columns: page.columns, summary: page.summary }; }

/**
 * Pack at measured print widths. Ordinary groups remain intact; only groups
 * taller than a full empty column are split, at entry boundaries. The measure
 * callback always receives the *rendered fragment*, including its real trailing
 * subtotal/total rows, so the last fragment cannot orphan a total.
 */
export function packA4Groups(groups, measure, capacity, from = { groupIndex: 0, entryIndex: 0 }, fullCapacity = capacity) {
  if (!(capacity > 0) || !Number.isFinite(capacity)) throw new Error('No printable space remains below the invoice header.');
  const pages = [emptyPage()];
  let page = pages[0], columnIndex = 0;
  const used = () => page.used[columnIndex];
  const remaining = () => capacity - used();
  const advance = () => {
    if (++columnIndex === 3) { page = emptyPage(); pages.push(page); columnIndex = 0; }
  };
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
    if (fullHeight > fullCapacity + EPSILON && group.entries.length === 1) throw new Error(`Group ${group.id} has a single entry too tall for an A4 column.`);

    if (fullHeight <= capacity + EPSILON) {
      if (fullHeight > remaining() + EPSILON) advance();
      add(group, groupIndex, start, group.entries.length, fullHeight);
      continue;
    }
    // A previously whole group cannot be split just to make room for the final
    // summary. The caller may instead place the summary on its own page.
    if (fullHeight <= fullCapacity + EPSILON) return null;

    while (start < group.entries.length) {
      let low = start + 1, high = group.entries.length, best = start, bestHeight = 0;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2), height = measure(group, start, middle);
        if (height <= remaining() + EPSILON) { best = middle; bestHeight = height; low = middle + 1; }
        else high = middle - 1;
      }
      if (best === start) {
        if (used()) { advance(); continue; }
        if (capacity < fullCapacity) return null;
        throw new Error(`Group ${group.id}, entry ${group.entries[start].id} cannot fit in an A4 column with its heading, table header and subtotal.`);
      }
      add(group, groupIndex, start, best, bestHeight);
      start = best;
      if (start < group.entries.length) advance();
    }
  }
  return pages;
}

export function planA4Invoice(model, measure, { regular, final }) {
  if (model.mode === 'sample') {
    const pages = fixedSampleA4Pages(model);
    pages.forEach((page, index) => page.columns.forEach(column => {
      const height = column.reduce((n, fragment) => n + measure(fragment.group, fragment.from, fragment.to), 0);
      if (height > (page.summary ? final : regular) + EPSILON) throw new Error(`The approved sample overflows A4 page ${index + 1}. Check fonts, margins and browser print settings.`);
    }));
    return pages;
  }
  const original = packA4Groups(model.groups, measure, regular);
  const last = original.at(-1);
  if (Math.max(...last.used) <= final + EPSILON) {
    last.summary = true;
    return original.map(asPage);
  }

  // Reserve the entire closing block below the three columns on the final page.
  // Keep the already-full preceding pages unchanged, then repack only the last
  // page's suffix. A single oversized-for-reserve group stays intact and gets
  // a dedicated summary page rather than an artificial extra split.
  if (final > 0) {
    const repacked = packA4Groups(model.groups, measure, final, last.start, regular);
    if (repacked && repacked.some(page => page.start)) {
      repacked.at(-1).summary = true;
      return [...original.slice(0, -1).map(asPage), ...repacked.map(asPage)];
    }
  }
  return [...original.map(asPage), { columns: [[], [], []], summary: true }];
}

function outerHeight(element, sides = ['marginTop', 'marginBottom']) {
  if (!element) return 0;
  const style = getComputedStyle(element);
  return element.getBoundingClientRect().height + sides.reduce((value, side) => value + (parseFloat(style[side]) || 0), 0);
}

function innerHeight(element) {
  const style = getComputedStyle(element);
  return element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
}

/**
 * Do all measuring in a hidden 210 × 297 mm sheet with 12 mm internal margins,
 * which yields exactly the 186 × 273 mm print content box. Font loading, image
 * decoding, the split header, footer and summary are all measured in the browser.
 */
export async function paginateA4Invoice(model, doc = document, pick = en => en) {
  let printable = model;
  if (model.seller.logo) {
    const image = new Image();
    image.src = model.seller.logo;
    try { await image.decode(); if (!image.naturalWidth || !image.naturalHeight) throw new Error('Image has no pixels.'); }
    catch { printable = { ...model, seller: { ...model.seller, logo: null } }; }
  }
  const node = doc.createElement('div');
  node.className = 'a4-invoice a4-measuring';
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = renderA4Page(printable, { columns: [[], [], []], summary: true }, 1, 1, 'measure', pick);
  doc.body.append(node);
  try {
    await doc.fonts.ready;
    // Let auto-layout and @font-face substitutions settle before sampling.
    await new Promise(resolve => requestAnimationFrame(resolve));
    const sheet = node.querySelector('.sample-sheet');
    const header = node.querySelector('.invoice-header');
    const note = node.querySelector('.sample-note');
    const footer = node.querySelector('.page-foot');
    const details = node.querySelector('.detail-columns');
    const closing = node.querySelector('.closing');
    const continuation = doc.createElement('p');
    continuation.className = 'continuation';
    continuation.textContent = 'Continued on the next page. Order totals and payment summary appear on the final page.';
    details.after(continuation);
    const continuationHeight = outerHeight(continuation);
    continuation.remove();
    const summaryHeight = closing.getBoundingClientRect().bottom - details.getBoundingClientRect().bottom
      + (parseFloat(getComputedStyle(closing).marginBottom) || 0);
    // In this flex sheet margin-top:auto pushes the footer to the bottom. Its
    // computed used margin can be hundreds of pixels; it is NOT footer content.
    const footerHeight = outerHeight(footer, []);
    const base = innerHeight(sheet) - outerHeight(header) - outerHeight(note) - footerHeight - SAFETY_PX;
    const regular = base - continuationHeight, final = base - summaryHeight;
    if (final < -EPSILON) throw new Error('The header and final summary cannot fit together on a single A4 page. Shorten the supplied identity or amount in words.');

    node.querySelector('.invoice-summary').remove();
    closing.remove();
    const column = node.querySelector('.detail-column');
    const cache = new Map();
    const measure = (group, from, to) => {
      const key = `${group.id}:${from}:${to}`;
      if (!cache.has(key)) {
        column.innerHTML = renderA4Group(group, from, to, 'measure');
        cache.set(key, outerHeight(column.querySelector('.row-block')));
      }
      return cache.get(key);
    };
    const pages = planA4Invoice(printable, measure, { regular, final });
    return { model: printable, pages, geometry: { columnCapacity: regular, lastColumnCapacity: final, summaryHeight,
      pageHeight: innerHeight(sheet), headerHeight: outerHeight(header), footerHeight } };
  } finally { node.remove(); }
}