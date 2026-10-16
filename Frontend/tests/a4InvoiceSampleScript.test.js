import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { generateA4InvoiceSample } from '../scripts/a4InvoiceSample.mjs';
import { prepareA4Invoice, sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { SAMPLE_24_GEOMETRY, recordedSamplePages } from '../src/utils/a4InvoiceSampleGeometry.js';
import { renderStandaloneA4Invoice } from '../src/utils/a4InvoiceRender.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('sample generator writes exactly the buyer copy of the recorded sample plan', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'a4-sample-'));
  try {
    const output = path.join(dir, 'sample.html');
    const result = await generateA4InvoiceSample({ root, output });
    assert.deepEqual([result.written, result.warnings], [true, []]);
    const css = await readFile(path.join(root, 'src/styles/a4Invoice.css'), 'utf8');
    const model = prepareA4Invoice(sampleA4Invoice());
    assert.equal(await readFile(output, 'utf8'), renderStandaloneA4Invoice(model, recordedSamplePages(model, SAMPLE_24_GEOMETRY), css, 'buyer'));
    assert.deepEqual(await readdir(dir), ['sample.html'], 'no temporary file is left behind');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('sample generator reports warnings and leaves the existing file unchanged', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'a4-sample-'));
  try {
    const output = path.join(dir, 'sample.html');
    await writeFile(output, 'previous', 'utf8');
    const input = { ...sampleA4Invoice(), storedTotals: { totalPieces: 1 } };
    const result = await generateA4InvoiceSample({ root, output, input });
    assert.equal(result.written, false);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /^Total pieces: stored 1 differs/);
    assert.equal(await readFile(output, 'utf8'), 'previous');
    assert.deepEqual(await readdir(dir), ['sample.html']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
