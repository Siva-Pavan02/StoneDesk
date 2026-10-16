import { planFromMeasurements, wholeGroupUnits } from './a4InvoicePagination.js';

// Recorded print geometry of the two fixed fictional samples.
//
// Production bills are always measured live (a4InvoiceMeasure.js), but the
// public 24-group sample and the landing sample are rendered in Node, where no
// DOM exists. They reuse the same reference planner fed with the measurements
// below, taken in Chrome (Playwright, the app page and the standalone print
// document, screen and print emulation agreed to the last fraction of a pixel)
// against the current a4Invoice.css — see
// .agents/tasks/reference-invoice-format/features/FEAT-000.json:
//
//   every 9-row group block   176.796875 px   (h3 17.59375 + table 159.203125)
//   one extra/fewer body row   15.984375 px
//   row-block gap (--group-gap)         6 px
//   page-height ruler (272.5 mm)  1029.90625 px
//   header                          96.40625 px
//   continuation note               19.265625 px
//   final section      buyer 206.78125 / driver 127.046875 px
//   => normalCapacity 912.234375, finalCapacity buyer 724.71875 / driver 804.453125
//
// A group block is the measured 9-row block adjusted by the measured row height,
// so a sample with fewer rows per group keeps the same measured row metrics.
// The browser check re-measures these values (±0.5 px) and the resulting plans.
const BLOCK_9_ROWS = 176.796875;
const BODY_ROW = 15.984375;
const GAP = 6;
const NORMAL_CAPACITY = 912.23;
const FINAL_CAPACITY = { buyer: 724.72, driver: 804.45 };

// Body rows of a group: its entries plus the Reg total / Top total rows.
const blockHeight = bodyRows => Number((BLOCK_9_ROWS + (bodyRows - 9) * BODY_ROW).toFixed(2));

const geometry = (heights, copies = ['buyer', 'driver']) => Object.freeze(Object.fromEntries(copies.map(copy =>
  [copy, Object.freeze({ heights: Object.freeze(heights), gap: GAP, normalCapacity: NORMAL_CAPACITY, finalCapacity: FINAL_CAPACITY[copy] })])));

/** 24 groups of 7 entries: 4 Regular + Reg total + 3 Top + Top total = 9 body rows. */
export const SAMPLE_24_GEOMETRY = geometry(Array.from({ length: 24 }, () => blockHeight(9)));

/** Landing sample: 3 groups of 3 entries (2 Regular + Reg total + 1 Top + Top total = 5 rows). */
export const LANDING_SAMPLE_GEOMETRY = geometry(Array.from({ length: 3 }, () => blockHeight(5)), ['buyer']);

/** The page plan of a fixed sample, from its recorded measurements. */
export function recordedSamplePages(model, geometryByCopy, copy = 'buyer') {
  const measurements = geometryByCopy?.[copy];
  if (!measurements) throw new Error(`No recorded sample geometry for the ${copy} copy.`);
  return planFromMeasurements(model, wholeGroupUnits(model), measurements);
}
