// Finalized bills store a logo reference (businessSnapshot.logo = { sha256, width, height, bytes })
// instead of the image bytes. The renderers (A4 preview, jsPDF, print) need a data URL, so the
// bill is hydrated once before it is shown: fetch the content-addressed logo same-origin with the
// session cookie, convert it to a data URL and inject it into an in-memory copy as
// businessSnapshot.logoDataUrl. Legacy bills that still embed logoDataUrl pass through unchanged.
// Any failure leaves logoDataUrl unset, so the existing "LOGO" placeholder is drawn.
import { logoUrl } from '../lib/pilotApi.js';

export const LOGO_HYDRATION_TIMEOUT_MS = 4000;
const SHA256 = /^[a-f0-9]{64}$/;
const PNG_DATA_URL = 'data:image/png;base64,';
// sha256 -> data URL. Content-addressed bytes never change, so a hit never goes stale.
const resolved = new Map();
// sha256 -> in-flight Promise<string|null>. Failures are not cached; the next open retries.
const pending = new Map();

export function logoReference(businessSnapshot) {
  if (!businessSnapshot || businessSnapshot.logoDataUrl) return null;
  const sha = businessSnapshot.logo?.sha256;
  return typeof sha === 'string' && SHA256.test(sha) ? sha : null;
}

export function cachedLogoDataUrl(sha) {
  return resolved.get(sha);
}

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('The logo could not be read'));
    reader.readAsDataURL(blob);
  });
}

async function fetchLogo(sha, fetchImpl) {
  const response = await fetchImpl(logoUrl(`/uploads/logos/${sha}.png`), { credentials: 'include' });
  if (!response?.ok || !String(response.headers?.get?.('content-type') || '').includes('image/png')) return null;
  const blob = await response.blob();
  const dataUrl = await readAsDataUrl(new Blob([blob], { type: 'image/png' }));
  return typeof dataUrl === 'string' && dataUrl.startsWith(PNG_DATA_URL) && dataUrl.length > PNG_DATA_URL.length ? dataUrl : null;
}

// Resolves the data URL, or null on 404, network error, wrong type or unreadable bytes. Never rejects.
export function loadLogoDataUrl(sha, { fetchImpl = globalThis.fetch } = {}) {
  if (resolved.has(sha)) return Promise.resolve(resolved.get(sha));
  if (pending.has(sha)) return pending.get(sha);
  const promise = fetchLogo(sha, fetchImpl)
    .then(dataUrl => { if (dataUrl) resolved.set(sha, dataUrl); return dataUrl; }, () => null)
    .finally(() => { if (pending.get(sha) === promise) pending.delete(sha); });
  pending.set(sha, promise);
  return promise;
}

export function withLogoDataUrl(record, dataUrl) {
  return { ...record, businessSnapshot: { ...record.businessSnapshot, logoDataUrl: dataUrl } };
}

// Returns the record itself when there is nothing to hydrate or the logo is unavailable within
// timeoutMs; otherwise an in-memory copy with businessSnapshot.logoDataUrl. Never rejects. A fetch
// that outlives the timeout keeps running and fills the cache for the next open.
export async function hydrateRecordLogo(record, { timeoutMs = LOGO_HYDRATION_TIMEOUT_MS, fetchImpl } = {}) {
  const sha = logoReference(record?.businessSnapshot);
  if (!sha) return record;
  const cached = resolved.get(sha);
  if (cached) return withLogoDataUrl(record, cached);
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); });
  try {
    const dataUrl = await Promise.race([loadLogoDataUrl(sha, { fetchImpl }), timeout]);
    return dataUrl ? withLogoDataUrl(record, dataUrl) : record;
  } finally { clearTimeout(timer); }
}

// Test helper.
export function clearLogoCache() {
  resolved.clear();
  pending.clear();
}
