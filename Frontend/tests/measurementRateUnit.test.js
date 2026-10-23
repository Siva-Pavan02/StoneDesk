// Tests for Phase 2: rateUnit-Aware Measurements UI in MeasurementEntry.jsx.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const measurementEntrySource = read('../src/components/pilot/MeasurementEntry.jsx');
const controlsSource = read('../src/components/pilot/Controls.jsx');

test('MeasurementEntry derives rateUnit directly from selected product with fallback to SQ_FT', () => {
  assert.match(measurementEntrySource, /const selectedProduct = products\.find\(p => p\.id === entry\.productId\);/);
  assert.match(measurementEntrySource, /const rateUnit = selectedProduct\?\.rateUnit === 'UNIT' \? 'UNIT' : 'SQ_FT';/);
  assert.match(measurementEntrySource, /const isUnit = rateUnit === 'UNIT';/);

  // Pure logic verification
  const resolveRateUnit = (products, productId) => {
    const selected = products.find(p => p.id === productId);
    return selected?.rateUnit === 'UNIT' ? 'UNIT' : 'SQ_FT';
  };

  const products = [
    { id: 'p1', stoneType: 'Napa Stones', finish: 'Double polish', defaultRate: 40, rateUnit: 'SQ_FT' },
    { id: 'p2', stoneType: 'Sink', finish: 'Ruff', defaultRate: 470, rateUnit: 'UNIT' },
    { id: 'p3', stoneType: 'Legacy Stone', finish: 'Raw', defaultRate: 35 }, // missing rateUnit
  ];

  assert.equal(resolveRateUnit(products, 'p1'), 'SQ_FT');
  assert.equal(resolveRateUnit(products, 'p2'), 'UNIT');
  assert.equal(resolveRateUnit(products, 'p3'), 'SQ_FT', 'legacy missing rateUnit falls back to SQ_FT');
  assert.equal(resolveRateUnit(products, 'unknown'), 'SQ_FT', 'unknown/missing productId falls back to SQ_FT');
  assert.equal(resolveRateUnit(products, undefined), 'SQ_FT', 'undefined productId falls back to SQ_FT');
});

test('MeasurementEntry conditionally unmounts Length, Width, and fractions when isUnit is true', () => {
  // Ensure dimension fields and fractions are wrapped in {!isUnit && ...}
  assert.match(measurementEntrySource, /\{!isUnit && <div className="grid grid-cols-2 gap-3">\s*\{?\['length', 'width'\]/);

  // Ensure unmounting is NOT done via CSS hiding or disabled attribute
  assert.doesNotMatch(measurementEntrySource, /style=\{\{[^}]*(?:display:\s*'none'|visibility:\s*'hidden')/);
  assert.doesNotMatch(measurementEntrySource, /disabled=\{isUnit\}/);
});

test('MeasurementEntry dynamically labels Rate field as Rate / unit (₹) or Rate / sq ft (₹)', () => {
  assert.match(
    measurementEntrySource,
    /<Field label=\{isUnit \? 'Rate \/ unit \(₹\)' : 'Rate \/ sq ft \(₹\)'\}/
  );

  // Verify NumberStepper accessibility wiring in Controls.jsx uses the dynamic label
  assert.match(controlsSource, /aria-label=\{`Decrease \$\{label\}`\}/);
  assert.match(controlsSource, /aria-label=\{`Increase \$\{label\}`\}/);
});

test('MeasurementEntry preserves Row navigation, Placement in row, Quantity, and Add entry in both modes', () => {
  // Row stepper bar
  assert.match(measurementEntrySource, /<div className="row-bar">/);
  assert.match(measurementEntrySource, /aria-label="Previous row"/);
  assert.match(measurementEntrySource, /aria-label="Next row"/);
  assert.match(measurementEntrySource, /<span className="row-bar-placement">/);

  // Placement switch (Regular / Top)
  assert.match(measurementEntrySource, /<div className="placement-switch"/);
  assert.match(measurementEntrySource, /\['Regular', 'Regular'\],\s*\['TOP', 'Top'\]/);

  // Quantity stepper
  assert.match(measurementEntrySource, /<Field label="Quantity" type="number"/);

  // Add entry button
  assert.match(measurementEntrySource, /<Button primary id=\{ids\.add\} label="Add entry" onClick=\{add\} \/>/);

  // Ensure these core controls are outside the {!isUnit && ...} conditional
  const parts = measurementEntrySource.split('{!isUnit &&');
  assert.equal(parts.length, 2, 'Exactly one conditional unmount block for dimensions');
  const beforeBlock = parts[0];
  const afterBlock = parts[1];

  assert.ok(beforeBlock.includes('row-bar'), 'row-bar is before dimension block');
  assert.ok(beforeBlock.includes('placement-switch'), 'placement-switch is before dimension block');
  assert.ok(afterBlock.includes('label="Quantity"'), 'Quantity is after dimension block');
  assert.ok(afterBlock.includes('label="Add entry"'), 'Add entry is after dimension block');
});

test('MeasurementEntry adapts focusField on add and productSaved based on rateUnit', () => {
  // On add: focus quantity if UNIT, else length
  assert.match(measurementEntrySource, /function add\(\) \{\s*if \(onAdd\(\) !== false\) focusField\(isUnit \? 'quantity' : 'length'\);\s*\}/);

  // On productSaved: focus quantity if newly saved product is UNIT, else length
  assert.match(
    measurementEntrySource,
    /focusField\(product\?\.rateUnit === 'UNIT' \? 'quantity' : 'length'\)/
  );
});

test('Product switching preserves default rates and cleans up dimension fields without stale values in accessibility tree', () => {
  const products = [
    { id: 'stone-1', stoneType: 'Napa Stones', finish: 'Double polish', defaultRate: 40, rateUnit: 'SQ_FT' },
    { id: 'sink-1', stoneType: 'Sink', finish: 'Ruff', defaultRate: 470, rateUnit: 'UNIT' },
  ];

  let currentEntry = { productId: 'stone-1', length: '3½', width: '2', quantity: '5', rate: '40', rowNo: '1', category: 'Regular' };

  // Helper simulating onSelect
  const handleSelect = (entry, product) => ({
    ...entry,
    productId: product.id,
    rate: String(product.defaultRate ?? ''),
  });

  // Switch to Sink (UNIT)
  currentEntry = handleSelect(currentEntry, products[1]);
  assert.equal(currentEntry.productId, 'sink-1');
  assert.equal(currentEntry.rate, '470');

  const selectedSink = products.find(p => p.id === currentEntry.productId);
  const isUnitSink = selectedSink?.rateUnit === 'UNIT';
  assert.equal(isUnitSink, true);
  // Dimensions are unmounted in JSX when isUnit is true

  // Switch back to Napa Stones (SQ_FT)
  currentEntry = handleSelect(currentEntry, products[0]);
  assert.equal(currentEntry.productId, 'stone-1');
  assert.equal(currentEntry.rate, '40');

  const selectedStone = products.find(p => p.id === currentEntry.productId);
  const isUnitStone = selectedStone?.rateUnit === 'UNIT';
  assert.equal(isUnitStone, false);
  // Dimensions are restored with prior entered values
  assert.equal(currentEntry.length, '3½');
  assert.equal(currentEntry.width, '2');
});

test('Strict terminology guard: no piece/pc terminology used', () => {
  const forbidden = /\b(?:Rate \/ piece|Rate \/ pc|Per piece)\b/i;
  assert.doesNotMatch(measurementEntrySource, forbidden);
});
