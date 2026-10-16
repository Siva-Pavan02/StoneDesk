import { INVOICE_FONT_FACES } from './a4InvoiceFonts.js';

// Font bytes for the vector PDF export. The faces are the same files the
// @font-face rules in styles/a4Invoice.css load (public/fonts, SIL Open Font
// License 1.1, see public/fonts/OFL.txt), so on-screen and PDF glyph advances
// match. They are fetched at export time from the HTTP cache and never bundled
// into a JS chunk. The result is cached; a failed load clears the cache so the
// next export can retry.

const CHUNK = 0x8000;

/** Base64 of a TTF payload, for jsPDF's virtual file system. */
export function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  return btoa(binary);
}

let pending = null;

/** The three embedded faces as `{ weight, style, file, base64 }`, loaded once. */
export function loadInvoicePdfFonts({ fetchImpl, base = '/fonts/' } = {}) {
  if (pending) return pending;
  const load = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!load) return Promise.reject(new Error('The PDF export needs fetch to load the invoice fonts.'));
  pending = Promise.all(INVOICE_FONT_FACES.map(async face => {
    const response = await load(`${base}${face.file}`);
    if (!response?.ok) throw new Error(`The invoice font ${face.file} could not be loaded (${response?.status ?? 'no response'}).`);
    return { weight: face.weight, style: face.style, file: face.file, base64: arrayBufferToBase64(await response.arrayBuffer()) };
  })).catch(error => {
    pending = null;
    throw error;
  });
  return pending;
}
