import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateA4InvoiceSample } from './a4InvoiceSample.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await generateA4InvoiceSample({ root });
if (!result.written) {
  console.error(`Sample invoice not written; ${path.relative(root, result.output)} is unchanged. Warnings:`);
  for (const warning of result.warnings) console.error(`- ${warning}`);
  process.exitCode = 1;
} else {
  console.log(`Built ${path.relative(root, result.output)} from the approved invoice renderer, fixture and CSS.`);
}
