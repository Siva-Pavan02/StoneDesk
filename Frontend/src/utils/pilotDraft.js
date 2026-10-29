import { parseFraction } from './fractionParser.js';
import { round2, rawArea, rawAmount } from './loadMath.js';
export { summarize } from './loadMath.js';
export const DRAFT_KEY = 'stonedesk:pilot-draft:v1';
export const money = value => round2(Number(value) || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function newDraft(fee = 0) {
  return { clientRequestId: crypto.randomUUID(), partyName: '', truckNumber: '', date: localDate(), buyerDestination: '', supervisor: '', fee: String(fee), rows: [] };
}

const DRAFT_SALT_KEY = 'stonedesk:draft-salt:v1';
const DRAFT_IV_SIZE = 12;

// PBKDF2 takes a noticeable moment on phones. Cache the derived key per storage,
// organization and salt so autosave finishes before a closing tab is torn down.
const keyCache = new WeakMap();
function getEncryptionKey(organizationId, storage = localStorage) {
  let cache = keyCache.get(storage);
  if (!cache) { cache = new Map(); keyCache.set(storage, cache); }
  const id = `${organizationId}:${storage.getItem(`${DRAFT_SALT_KEY}:${organizationId}`) || ''}`;
  if (!cache.has(id)) {
    const promise = deriveEncryptionKey(organizationId, storage);
    cache.set(id, promise);
    promise.catch(() => cache.delete(id));
  }
  return cache.get(id);
}
async function deriveEncryptionKey(organizationId, storage) {
  let salt = storage.getItem(`${DRAFT_SALT_KEY}:${organizationId}`);
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16));
    storage.setItem(`${DRAFT_SALT_KEY}:${organizationId}`, btoa(String.fromCharCode(...salt)));
  } else {
    salt = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  }
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(organizationId + ':' + btoa(String.fromCharCode(...salt))),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Up to MAX_DRAFTS unfinished loads are kept per organization on this device,
// stored as one encrypted list: { drafts: [{ savedAt, draft }] }, newest first.
export const MAX_DRAFTS = 5;
export const DRAFTS_FULL = 'full';

async function encryptList(entries, organizationId, storage) {
  try {
    if (!entries.length) { storage.removeItem(`${DRAFT_KEY}:${organizationId}`); return true; }
    const key = await getEncryptionKey(organizationId, storage);
    const iv = crypto.getRandomValues(new Uint8Array(DRAFT_IV_SIZE));
    const encoded = new TextEncoder().encode(JSON.stringify({ drafts: entries }));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    storage.setItem(`${DRAFT_KEY}:${organizationId}`, btoa(String.fromCharCode(...combined)));
    return true;
  } catch {
    return false;
  }
}

// Serialize encryption and removal so a slow old write cannot resurrect a saved
// or discarded draft. Storage objects are separate queues (also useful in tests).
const pendingWrites = new WeakMap();
function enqueue(storage, organizationId, operation) {
  let queues = pendingWrites.get(storage);
  if (!queues) { queues = new Map(); pendingWrites.set(storage, queues); }
  const previous = queues.get(organizationId) || Promise.resolve();
  const task = previous.then(operation).catch(() => false);
  queues.set(organizationId, task);
  task.then(() => { if (queues.get(organizationId) === task) queues.delete(organizationId); });
  return task;
}
export function hasDraftContent(draft) {
  return Boolean(draft.rows?.length || draft.partyName?.trim() || draft.truckNumber?.trim() || draft.buyerDestination?.trim() || draft.entry?.length || draft.entry?.width);
}
function validDraft(value) {
  if (!value || !Array.isArray(value.rows) || typeof value.clientRequestId !== 'string') return null;
  if (!value.rows.every(row => {
    if (!row || typeof row.stoneType !== 'string' || typeof row.finish !== 'string') return false;
    if (!Number.isSafeInteger(row.quantity) || row.quantity <= 0) return false;
    const rate = Number(row.rate ?? row.ratePerSqFt);
    if (!Number.isFinite(rate) || rate < 0) return false;
    if (row.rateUnit === 'UNIT') return true;
    return Number.isFinite(row.lengthFt) && row.lengthFt > 0 && Number.isFinite(row.widthFt) && row.widthFt > 0;
  })) return null;
  // Drafts saved before row numbers existed continue under row 1.
  return { ...value, rows: value.rows.map(row => ({ ...row, rowNo: row.rowNo ?? 1 })) };
}
// Reads the stored list without waiting on the queue (callers inside the queue use it).
async function decryptList(organizationId, storage) {
  const stored = storage.getItem(`${DRAFT_KEY}:${organizationId}`);
  if (!stored) return [];
  const key = await getEncryptionKey(organizationId, storage);
  const combined = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, DRAFT_IV_SIZE) }, key, combined.slice(DRAFT_IV_SIZE));
  const value = JSON.parse(new TextDecoder().decode(decrypted));
  // The earlier format stored a single draft object.
  const entries = Array.isArray(value?.drafts) ? value.drafts : [{ savedAt: 0, draft: value }];
  return entries
    .map(entry => ({ savedAt: Number(entry?.savedAt) || 0, draft: validDraft(entry?.draft) }))
    .filter(entry => entry.draft)
    .sort((a, b) => b.savedAt - a.savedAt);
}
async function storedList(organizationId, storage) {
  try { return await decryptList(organizationId, storage); } catch { return []; }
}
/** Saves or updates one draft. Resolves true, false (storage failed) or DRAFTS_FULL. */
export function writeDraft(draft, organizationId, storage = localStorage) {
  return enqueue(storage, organizationId, async () => {
    const { savedAt: _savedAt, ...clean } = draft;
    const list = await storedList(organizationId, storage);
    const others = list.filter(entry => entry.draft.clientRequestId !== clean.clientRequestId);
    if (others.length === list.length && others.length >= MAX_DRAFTS) return DRAFTS_FULL;
    return encryptList([{ savedAt: Date.now(), draft: clean }, ...others], organizationId, storage);
  });
}
/** Removes one draft by clientRequestId, or every draft of the organization when omitted. */
export function clearDraft(organizationId, storage = localStorage, clientRequestId) {
  return enqueue(storage, organizationId, async () => {
    if (clientRequestId === undefined) {
      storage.removeItem(`${DRAFT_KEY}:${organizationId}`);
      return true;
    }
    const list = await storedList(organizationId, storage);
    const next = list.filter(entry => entry.draft.clientRequestId !== clientRequestId);
    return next.length === list.length ? true : encryptList(next, organizationId, storage);
  });
}
export async function flushDraft(organizationId, storage = localStorage) {
  await pendingWrites.get(storage)?.get(organizationId);
}
/** All unfinished drafts, newest first, each with its savedAt time (ms). */
export async function readDrafts(storage = localStorage, organizationId) {
  // Derive the key now, even with no drafts yet, so the first autosave is quick.
  try { getEncryptionKey(organizationId, storage).catch(() => {}); } catch { /* storage blocked */ }
  await pendingWrites.get(storage)?.get(organizationId);
  return (await storedList(organizationId, storage)).map(entry => ({ ...entry.draft, savedAt: entry.savedAt }));
}
/** One draft by clientRequestId, or the most recently saved one. */
export async function readDraft(storage = localStorage, organizationId, clientRequestId) {
  await pendingWrites.get(storage)?.get(organizationId);
  const list = await storedList(organizationId, storage);
  const entry = clientRequestId === undefined ? list[0] : list.find(item => item.draft.clientRequestId === clientRequestId);
  return entry?.draft || null;
}
export function previewRows(rows) {
  return rows.map(row => ({
    ...row,
    sqFt: row.rateUnit === 'UNIT' ? 0 : round2(rawArea(row)),
    lineTotal: row.rateUnit === 'UNIT' ? round2((row.quantity ?? 1) * Number(row.rate ?? row.ratePerSqFt ?? 0)) : round2(rawAmount(row)),
  }));
}
export function makeRow(entry, product) {
  const isUnit = product?.rateUnit === 'UNIT';
  const lengthFt = isUnit ? undefined : parseFraction(entry.length)?.numeric;
  const widthFt = isUnit ? undefined : parseFraction(entry.width)?.numeric;
  const quantity = Number(entry.quantity);
  const rate = Number(entry.rate);
  const rowNo = Number(entry.rowNo ?? 1);
  if (!product) throw new Error('Select a product');
  if (!Number.isSafeInteger(rowNo) || rowNo < 1 || rowNo > 20) throw new Error('Enter a row number from 1 to 20');
  if (!isUnit && (!(lengthFt > 0) || !Number.isFinite(lengthFt) || !(widthFt > 0) || !Number.isFinite(widthFt))) throw new Error('Enter positive lengths and widths');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) throw new Error('Enter a whole quantity from 1 to 100000');
  if (entry.rate === '' || !Number.isFinite(rate) || rate < 0) throw new Error('Enter a valid rate');
  if (isUnit) {
    return { stoneType: product.stoneType, finish: product.finish, rowNo, quantity, rate, ratePerSqFt: rate, category: entry.category, rateUnit: 'UNIT' };
  }
  return { stoneType: product.stoneType, finish: product.finish, rowNo, lengthFt, widthFt, quantity, ratePerSqFt: rate, category: entry.category };
}
// Per-field versions of the checks in makeRow/payload, so the load screen can show
// each message under its input. Keys match the draft/entry field names.
export const DETAIL_MESSAGES = Object.freeze({
  partyName: 'Enter the party name',
  truckNumber: 'Enter the truck number',
  date: 'Enter a valid date (dd/mm/yyyy)',
  buyerDestination: 'Enter the destination',
  supervisor: 'Enter the manager name',
});
export function detailErrors(draft) {
  const errors = {};
  for (const [key, message] of Object.entries(DETAIL_MESSAGES)) {
    if (typeof draft[key] !== 'string' || !draft[key].trim()) errors[key] = message;
  }
  const fee = Number(draft.fee);
  if (draft.fee === '' || !Number.isFinite(fee) || fee < 0) errors.fee = 'Enter valid loading/royalty charges';
  return errors;
}
export function entryErrors(entry, product) {
  const errors = {};
  const isUnit = product?.rateUnit === 'UNIT';
  const positive = text => { const value = parseFraction(text)?.numeric; return value > 0 && Number.isFinite(value); };
  const quantity = Number(entry.quantity);
  const rate = Number(entry.rate);
  if (!product) errors.productId = 'Select a product';
  if (!isUnit) {
    if (!positive(entry.length)) errors.length = 'Enter a length greater than 0';
    if (!positive(entry.width)) errors.width = 'Enter a width greater than 0';
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) errors.quantity = 'Enter a whole quantity from 1 to 100000';
  if (entry.rate === '' || !Number.isFinite(rate) || rate < 0) errors.rate = 'Enter a valid rate';
  return errors;
}
export function payload(draft) {
  for (const key of ['partyName', 'truckNumber', 'date', 'buyerDestination', 'supervisor']) {
    if (typeof draft[key] !== 'string' || !draft[key].trim()) throw new Error('Fill all load details before saving');
  }
  if (!draft.rows.length) throw new Error('Add at least one measurement row');
  const fee = Number(draft.fee);
  if (draft.fee === '' || !Number.isFinite(fee) || fee < 0) throw new Error('Enter valid loading/royalty charges');
  const groups = new Map();
  for (const row of draft.rows) {
    const rateUnit = row.rateUnit === 'UNIT' ? 'UNIT' : 'SQ_FT';
    const key = JSON.stringify([row.stoneType, row.finish, row.ratePerSqFt, rateUnit]);
    if (!groups.has(key)) groups.set(key, { stoneType: row.stoneType, finish: row.finish, ratePerSqFt: row.ratePerSqFt, ...(rateUnit === 'UNIT' ? { rateUnit: 'UNIT' } : {}), measurementRows: [] });
    const rowPayload = { rowNo: row.rowNo ?? 1, quantity: row.quantity, category: row.category };
    if (rateUnit === 'UNIT') {
      rowPayload.rateUnit = 'UNIT';
    } else {
      rowPayload.lengthFt = row.lengthFt;
      rowPayload.widthFt = row.widthFt;
    }
    groups.get(key).measurementRows.push(rowPayload);
  }
  return { clientRequestId: draft.clientRequestId, partyName: draft.partyName.trim(), supervisor: draft.supervisor.trim(), date: draft.date,
    logistics: { truckNumber: draft.truckNumber.trim(), buyerDestination: draft.buyerDestination.trim() }, loadingAndRoyaltyFees: fee, inventory: [...groups.values()] };
}
const formatKolkataDate = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export function fromDispatch(dispatch) {
  return { clientRequestId: dispatch.clientRequestId || crypto.randomUUID(), serverId: dispatch.id, partyName: dispatch.partyName || '',
    truckNumber: dispatch.logistics.truckNumber, buyerDestination: dispatch.logistics.buyerDestination,
    supervisor: dispatch.supervisor, date: formatKolkataDate(new Date(dispatch.date)), fee: String(dispatch.summary.loadingAndRoyaltyFees),
    rows: dispatch.inventory.flatMap((g, groupIndex) => (g.measurementRows?.length ? g.measurementRows : g.pieces.map(p => ({ ...p, quantity: 1, category: 'Regular' }))).map(r => ({ ...r, rowNo: r.rowNo ?? groupIndex + 1, stoneType: g.stoneType, finish: g.finish, ratePerSqFt: g.ratePerSqFt, rate: g.ratePerSqFt, ...(r.rateUnit === 'UNIT' || g.rateUnit === 'UNIT' ? { rateUnit: 'UNIT' } : {}) }))) };
}
