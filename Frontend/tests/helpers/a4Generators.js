import { capacitiesFrom, fragmentRows, planFromMeasurements, splitOversizedUnits, wholeGroupUnits } from '../../src/utils/a4InvoicePagination.js';

// Seeded generators for the unified A4 bill property tests (Req 13.2: no PBT dependency).
// Every property loop is deterministic: iteration i uses seed `baseSeed + i`, and a failure
// reports that seed plus the generated input so it can be replayed with A4_PBT_SEED=<seed>.

export const DEFAULT_ITERATIONS = 100;
export const DEFAULT_BASE_SEED = 0x5eed_a4;

// mulberry32: small, fast, well-distributed 32-bit PRNG.
export function createRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min, max) => min + Math.floor(next() * (max - min + 1));
  const pick = list => list[int(0, list.length - 1)];
  const bool = (p = 0.5) => next() < p;
  return { seed: seed >>> 0, next, int, pick, bool };
}

const DIMENSION_FRACTIONS = ['', '.25', '.5', '.75', '.1', '.33', '.125'];

// Positive dimension in feet, e.g. "4", "3.75", "11.125".
export function genDimension(rng) {
  return `${rng.int(1, 12)}${rng.pick(DIMENSION_FRACTIONS)}`;
}

// Non-negative rate per sq ft with 0–4 decimal places (rates are not limited to 2 dp).
export function genRate(rng) {
  const whole = rng.int(0, 250);
  const places = rng.int(0, 4);
  if (!places) return String(whole);
  return `${whole}.${String(rng.int(0, 10 ** places - 1)).padStart(places, '0')}`;
}

// Monetary loading / royalty with at most two decimals (prepareA4Invoice rejects more).
export function genLoading(rng) {
  const kind = rng.int(0, 3);
  if (kind === 0) return '0';
  if (kind === 1) return '0.00';
  const places = rng.int(0, 2);
  const whole = rng.int(0, kind === 3 ? 999_999 : 5_000);
  return places ? `${whole}.${String(rng.int(0, 10 ** places - 1)).padStart(places, '0')}` : String(whole);
}

export function genEntry(rng, groupId, index) {
  return { id: `${groupId}-${index + 1}`, type: rng.bool(0.6) ? 'regular' : 'top',
    lengthFt: genDimension(rng), widthFt: genDimension(rng), quantity: rng.int(1, 9), ratePerSqFt: genRate(rng) };
}

// A valid production/sample input for prepareA4Invoice: 1–40 groups, 1–12 entries each,
// mixed regular/top, varied dimensions, rates, quantities and loading. Group ids are
// unique but shuffled and sparse so ordering by id is exercised. No authoritative amounts
// or stored totals are supplied, so the prepared model carries no warnings.
export function genA4Input(rng, { minGroups = 1, maxGroups = 40, minEntries = 1, maxEntries = 12, bankDetails } = {}) {
  const groupCount = rng.int(minGroups, maxGroups);
  const ids = new Set();
  while (ids.size < groupCount) ids.add(rng.bool(0.7) ? ids.size + 1 : rng.int(1, groupCount * 3));
  const groups = [...ids].sort(() => rng.next() - 0.5).map(id => ({
    id, entries: Array.from({ length: rng.int(minEntries, maxEntries) }, (_, index) => genEntry(rng, id, index)),
  }));
  const mode = rng.bool(0.8) ? 'production' : 'sample';
  return {
    mode, currency: 'INR', invoiceNumber: `INV-${rng.int(1, 99999)}`,
    invoiceDate: `2026-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`,
    status: mode === 'sample' ? 'SAMPLE' : rng.pick(['Draft', 'Dispatched', 'Delivered']),
    seller: { name: rng.pick(['Sri Stone Works', 'Granite & Co', 'Test <Quarry>']), location: rng.pick(['', 'Demo location, India']),
      phone: rng.pick(['', '+91 90000 00000']), signatoryName: rng.pick(['', 'Proprietor']),
      bankDetails: bankDetails ?? (rng.bool(0.7) ? genBankText(rng).text : '') },
    party: rng.pick(['DEMO BUYER', 'Party "A" & Sons', 'ಕನ್ನಡ ಖರೀದಿದಾರ']), lorryNumber: `KA-${rng.int(1, 99)}-${rng.int(1000, 9999)}`,
    destination: rng.pick(['DEMO CITY', 'Bengaluru']), supervisor: rng.pick(['SAMPLE', 'Manager']),
    loadingRoyalty: genLoading(rng), groups,
  };
}

// ---- Bank details text -------------------------------------------------------------------

export const BANK_DELIMITERS = ['\n', '\r\n', ' · ', '|', ' | ', ';', '; ', ', '];
const BANK_LABELS = ['Holder', 'Bank', 'A/c no.', 'IFSC', 'Branch', 'UPI', 'Account name', 'Swift'];
const VALUE_WORDS = ['Sri', 'Stone', 'Works', 'State', 'Bank', 'of', 'India', 'SBIN0001234', '1234567890',
  'stone@upi', 'Main', 'Road', '<b>bold</b>', '<br/>', '"quoted"', "it's", '<script>x</script>', 'A&B', '>', '<'];
const PAD = [' ', '  ', '\t', ''];

function bankValue(rng, length) {
  const words = [];
  let size = 0;
  do { const word = rng.pick(VALUE_WORDS); words.push(word); size += word.length + 1; } while (size < length);
  return words.join(' ');
}

const padded = (rng, text) => `${rng.pick(PAD)}${text}${rng.pick(PAD)}`;

// Random bank-details free text.
//   kind 'pairs' → every segment is "Label: value"; `pairs` holds the expected trimmed pairs.
//   kind 'mixed' → at least one segment has no "Label: value" form; `pairs` is null.
// Covers every delimiter (newline, " · ", "|", ";", commas), surrounding whitespace, markup
// characters and lengths around 300 characters. Values never contain a delimiter or comma,
// so the expected segmentation is well defined.
export function genBankText(rng, { kind = rng.bool() ? 'pairs' : 'mixed', delimiter = rng.pick(BANK_DELIMITERS),
  targetLength = rng.int(240, 360) } = {}) {
  const count = rng.int(1, 6);
  const per = Math.max(4, Math.floor(targetLength / count) - 12);
  const segments = Array.from({ length: count }, () => [rng.pick(BANK_LABELS), bankValue(rng, rng.int(Math.ceil(per / 2), per))]);
  let body;
  if (kind === 'pairs') {
    body = segments.map(([label, value]) => padded(rng, `${label}${rng.pick(['', ' '])}:${rng.pick(PAD)}${value}`)).join(delimiter);
  } else {
    const plainValue = padded(rng, bankValue(rng, rng.int(8, 60)));
    const parts = segments.map(([label, value]) => padded(rng, `${label}: ${value}`));
    const at = rng.int(0, parts.length);
    // A comma only splits a segment when every comma part is a pair, so with a comma
    // delimiter the colon-free value sits on its own line to stay a separate segment.
    if (delimiter.trim() === ',') {
      const pairsLine = parts.join(delimiter);
      body = at ? `${pairsLine}\n${plainValue}` : `${plainValue}\n${pairsLine}`;
    } else {
      parts.splice(at, 0, plainValue);
      body = parts.join(delimiter);
    }
  }
  const text = `${rng.pick(PAD)}${body}${rng.pick(['', '\n', ' '])}`;
  return { text, kind, delimiter, pairs: kind === 'pairs' ? segments.map(([label, value]) => [label, value]) : null };
}

// ---- Synthetic measurements --------------------------------------------------------------

// Node stand-in for the browser measure host (a4InvoiceMeasure.js): every table row is
// `rowHeight` px tall and every block adds `headHeight` for its heading and table header,
// with the reference page metrics by default. Oversized groups are split exactly as the
// measure host splits them, so `planFromMeasurements` can be used without a DOM.
function measureUnits(units, { rowHeight, headHeight }) {
  const rowLayouts = units.map(({ group, from, to }) => ({
    head: headHeight,
    rows: fragmentRows(group, from, to).map(row => ({ height: rowHeight,
      ...(row.kind === 'entry' ? { kind: 'entry', index: row.index } : { kind: 'sub', of: row.of }) })),
  }));
  return { rowLayouts, heights: rowLayouts.map(layout => layout.head + layout.rows.length * rowHeight) };
}

export function syntheticGeometry(model, copy = 'buyer', options = {}) {
  const settings = { rowHeight: 16, headHeight: 33, gap: 6, pageHeight: 1029.9, headerHeight: 96.4,
    noticeHeight: 19.27, finalHeight: copy === 'driver' ? 127.05 : 206.78, ...options };
  const capacities = capacitiesFrom(settings);
  let units = wholeGroupUnits(model);
  let measured = measureUnits(units, settings);
  if (measured.heights.some(height => height > capacities.normalCapacity + 0.01)) {
    units = splitOversizedUnits(units, measured.heights, measured.rowLayouts, capacities.normalCapacity);
    measured = measureUnits(units, settings);
  }
  return { units, heights: measured.heights, gap: settings.gap, ...capacities };
}

/** The page plan of `model` (already projected to `copy`) from synthetic measurements. */
export function planSynthetic(model, copy = 'buyer', options = {}) {
  const geometry = syntheticGeometry(model, copy, options);
  return planFromMeasurements(model, geometry.units, geometry);
}

// ---- Property loop -----------------------------------------------------------------------

function describe(input) {
  try { return JSON.stringify(input, null, 2); } catch { return String(input); }
}

// Runs `check(input, rng, iteration)` for `iterations` seeded inputs from `generate(rng)`.
// On failure the error is rethrown with the property name, the failing seed and the input.
// A4_PBT_SEED=<seed> replays one seed; A4_PBT_ITERATIONS overrides the count (min 100).
export async function runProperty(name, generate, check, { iterations = DEFAULT_ITERATIONS, seed = DEFAULT_BASE_SEED } = {}) {
  const replay = process.env.A4_PBT_SEED;
  const count = replay ? 1 : Math.max(DEFAULT_ITERATIONS, Number(process.env.A4_PBT_ITERATIONS) || iterations);
  for (let i = 0; i < count; i++) {
    const caseSeed = replay ? Number(replay) >>> 0 : (seed + i) >>> 0;
    let input;
    try {
      input = generate(createRng(caseSeed));
      await check(input, createRng(caseSeed ^ 0x9e3779b9), i);
    } catch (error) {
      const message = `${name} failed at iteration ${i} (seed ${caseSeed}; replay with A4_PBT_SEED=${caseSeed})\n` +
        `${error?.message ?? error}\nInput:\n${describe(input)}`;
      console.error(message);
      const wrapped = new Error(message, { cause: error });
      if (error && typeof error === 'object') Object.assign(wrapped, { actual: error.actual, expected: error.expected });
      throw wrapped;
    }
  }
  return count;
}
