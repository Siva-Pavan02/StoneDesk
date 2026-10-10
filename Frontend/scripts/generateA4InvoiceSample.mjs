import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prepareA4Invoice, sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { fixedSampleA4Pages, renderStandaloneA4Invoice } from '../src/utils/a4InvoiceRender.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const css = await readFile(path.join(root, 'src/styles/a4Invoice.css'), 'utf8');
const model = prepareA4Invoice(sampleA4Invoice());
if (model.warnings.length) throw new Error(model.warnings.join('\n'));
const output = path.join(root, 'public/sample_invoice_24_rows.html');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, renderStandaloneA4Invoice(model, fixedSampleA4Pages(model), css), 'utf8');
console.log(`Built ${path.relative(root, output)} from the approved invoice renderer, fixture and CSS.`);