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
export function readDraft(storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(DRAFT_KEY));
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
  return { clientRequestId: dispatch.clientRequestId || crypto.randomUUID(), serverId: dispatch._id, partyName: dispatch.partyName || '',
    truckNumber: dispatch.logistics.truckNumber, buyerDestination: dispatch.logistics.buyerDestination,
    supervisor: dispatch.supervisor, date: new Date(dispatch.date).toISOString().slice(0, 10), fee: String(dispatch.summary.loadingAndRoyaltyFees),
    rows: dispatch.inventory.flatMap(g => (g.measurementRows?.length ? g.measurementRows : g.pieces.map(p => ({ ...p, quantity: 1, category: 'Regular' }))).map(r => ({ ...r, stoneType: g.stoneType, finish: g.finish, ratePerSqFt: g.ratePerSqFt }))) };
}
