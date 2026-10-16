import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareA4Invoice, sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { SAMPLE_24_GEOMETRY, recordedSamplePages } from '../src/utils/a4InvoiceSampleGeometry.js';
import { renderStandaloneA4Invoice } from '../src/utils/a4InvoiceRender.js';

// Renders the buyer copy of the sample with the reference planner fed by the
// Chrome-recorded geometry of this fixed sample, so the committed file breaks
// pages exactly as the app does. Returns warnings instead of HTML when the
// sample's stored values disagree with the calculated ones.
export function buildA4InvoiceSample(input, css) {
  const model = prepareA4Invoice(input);
  if (model.warnings.length) return { warnings: [...model.warnings], html: null };
  return { warnings: [], html: renderStandaloneA4Invoice(model, recordedSamplePages(model, SAMPLE_24_GEOMETRY), css, 'buyer') };
}

// Writes the sample only after the full render succeeds, via a temporary file
// renamed into place, so a warning or render error leaves the output untouched.
export async function generateA4InvoiceSample({ root, output = path.join(root, 'public/sample_invoice_24_rows.html'), input = sampleA4Invoice() }) {
  const css = await readFile(path.join(root, 'src/styles/a4Invoice.css'), 'utf8');
  const { warnings, html } = buildA4InvoiceSample(input, css);
  if (warnings.length) return { written: false, warnings, output };
  await mkdir(path.dirname(output), { recursive: true });
  const temp = `${output}.${process.pid}.tmp`;
  try {
    await writeFile(temp, html, 'utf8');
    await rename(temp, output);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
  return { written: true, warnings: [], output };
}
