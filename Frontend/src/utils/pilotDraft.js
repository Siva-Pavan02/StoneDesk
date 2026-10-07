import { parseFraction } from './fractionParser.js';
export const DRAFT_KEY = 'stonedesk:pilot-draft:v1';
export const money = value => Number(value).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
export function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function newDraft(fee = 0) {
  return { clientRequestId: crypto.randomUUID(), partyName: '', truckNumber: '', date: localDate(), buyerDestination: '', supervisor: '', fee: String(fee), rows: [] };
}

const DRAFT_SALT_KEY = 'stonedesk:draft-salt:v1';
const DRAFT_IV_SIZE = 12;

async function getEncryptionKey(organizationId, storage = localStorage) {
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

async function encryptDraft(draft, organizationId, storage) {
  try {
    const key = await getEncryptionKey(organizationId, storage);
    const iv = crypto.getRandomValues(new Uint8Array(DRAFT_IV_SIZE));
    const encoded = new TextEncoder().encode(JSON.stringify(draft));
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
export function writeDraft(draft, organizationId, storage = localStorage) {
  return enqueue(storage, organizationId, () => encryptDraft(draft, organizationId, storage));
}
export function clearDraft(organizationId, storage = localStorage) {
  return enqueue(storage, organizationId, () => {
    storage.removeItem(`${DRAFT_KEY}:${organizationId}`);
    return true;
  });
}
export async function flushDraft(organizationId, storage = localStorage) {
  await pendingWrites.get(storage)?.get(organizationId);
}

export async function readDraft(storage = localStorage, organizationId) {
  try {
    await pendingWrites.get(storage)?.get(organizationId);
    const stored = storage.getItem(`${DRAFT_KEY}:${organizationId}`);
    if (!stored) return null;
    const key = await getEncryptionKey(organizationId, storage);
    const combined = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    const iv = combined.slice(0, DRAFT_IV_SIZE);
    const encrypted = combined.slice(DRAFT_IV_SIZE);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    const value = JSON.parse(new TextDecoder().decode(decrypted));
    if (!value || !Array.isArray(value.rows) || typeof value.clientRequestId !== 'string') return null;
    if (!value.rows.every(row => row && typeof row.stoneType === 'string' && typeof row.finish === 'string' && Number.isFinite(row.lengthFt) && row.lengthFt > 0 && Number.isFinite(row.widthFt) && row.widthFt > 0 && Number.isSafeInteger(row.quantity) && row.quantity > 0 && Number.isFinite(row.ratePerSqFt) && row.ratePerSqFt >= 0)) return null;
    return value;
  } catch { return null; }
}
export function previewRows(rows) {
  return rows.map(row => {
    const sqFt = round(row.lengthFt * row.widthFt * row.quantity);
    return { ...row, sqFt, lineTotal: round(sqFt * row.ratePerSqFt) };
  });
}
export function makeRow(entry, product) {
  const lengthFt = parseFraction(entry.length)?.numeric;
  const widthFt = parseFraction(entry.width)?.numeric;
  const quantity = Number(entry.quantity);
  const ratePerSqFt = Number(entry.rate);
  if (!product) throw new Error('Select a product');
  if (!(lengthFt > 0) || !Number.isFinite(lengthFt) || !(widthFt > 0) || !Number.isFinite(widthFt)) throw new Error('Enter positive lengths and widths');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) throw new Error('Enter a whole quantity from 1 to 100000');
  if (entry.rate === '' || !Number.isFinite(ratePerSqFt) || ratePerSqFt < 0) throw new Error('Enter a valid rate');
  return { stoneType: product.stoneType, finish: product.finish, lengthFt, widthFt, quantity, ratePerSqFt, category: entry.category };
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
    const key = JSON.stringify([row.stoneType, row.finish, row.ratePerSqFt]);
    if (!groups.has(key)) groups.set(key, { stoneType: row.stoneType, finish: row.finish, ratePerSqFt: row.ratePerSqFt, measurementRows: [] });
    groups.get(key).measurementRows.push({ lengthFt: row.lengthFt, widthFt: row.widthFt, quantity: row.quantity, category: row.category });
  }
  return { clientRequestId: draft.clientRequestId, partyName: draft.partyName.trim(), supervisor: draft.supervisor.trim(), date: draft.date,
    logistics: { truckNumber: draft.truckNumber.trim(), buyerDestination: draft.buyerDestination.trim() }, loadingAndRoyaltyFees: fee, inventory: [...groups.values()] };
}
export function fromDispatch(dispatch) {
  return { clientRequestId: dispatch.clientRequestId || crypto.randomUUID(), serverId: dispatch.id, partyName: dispatch.partyName || '',
    truckNumber: dispatch.logistics.truckNumber, buyerDestination: dispatch.logistics.buyerDestination,
    supervisor: dispatch.supervisor, date: new Date(dispatch.date).toISOString().slice(0, 10), fee: String(dispatch.summary.loadingAndRoyaltyFees),
    rows: dispatch.inventory.flatMap(g => (g.measurementRows?.length ? g.measurementRows : g.pieces.map(p => ({ ...p, quantity: 1, category: 'Regular' }))).map(r => ({ ...r, stoneType: g.stoneType, finish: g.finish, ratePerSqFt: g.ratePerSqFt }))) };
}
