import Decimal from 'decimal.js';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const ZERO = new D(0);
const MONEY_ROUNDING = D.ROUND_HALF_UP;
const patterns = [
  ['3', '4'], ['3.5', '4.5'], ['4', '4'], ['4.25', '4.25'],
  ['3.75', '4.5'], ['4.5', '4'], ['5', '5'], ['2.5', '3.25'],
  ['4.75', '5.25'], ['3.5', '3.5'], ['4', '4.25'], ['5.75', '5'],
];

export const AREA_ROUNDING_NOTE = 'Areas are shown to 2 decimals. Subtotals and totals use unrounded measurements, so displayed areas may differ slightly when added.';

// Sample-mode bank grid (3 columns x 2 rows, row-major). Placeholders only.
export const SAMPLE_BANK_PAIRS = [['Holder', '[Account holder name]'], ['Bank', '[Bank name]'], ['A/c no.', '[Account number]'],
  ['IFSC', '[IFSC code]'], ['Branch', '[Branch — optional]'], ['UPI', '[UPI ID — optional]']];

// Splits the free-text bank details on newlines, " · ", "|" or ";". A segment is
// further split on commas only when every comma part is itself a "Label: value".
export function bankDetailSegments(text) {
  return String(text ?? '').trim().split(/\r?\n|\s+·\s+|\s*\|\s*|\s*;\s*/).map(part => part.trim()).filter(Boolean)
    .flatMap(segment => {
      const parts = segment.split(',').map(part => part.trim());
      return parts.length > 1 && parts.every(part => part && part.includes(':')) ? parts : [segment];
    });
}

// [label, value] pairs when every segment is written as "Label: value"; otherwise null.
export function bankDetailPairs(text) {
  const segments = bankDetailSegments(text);
  const pairs = segments.map(segment => {
    const at = segment.indexOf(':');
    return at < 0 ? null : [segment.slice(0, at).trim(), segment.slice(at + 1).trim()];
  });
  return pairs.length && pairs.every(pair => pair && pair[0] && pair[1]) ? pairs : null;
}

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function decimal(value, name, { positive = false, monetary = false } = {}) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') throw new Error(`${name} is required.`);
  let number;
  try { number = new D(value); } catch { throw new Error(`${name} must be a valid decimal.`); }
  if (!number.isFinite() || (positive ? !number.gt(0) : number.lt(0))) throw new Error(`${name} must be ${positive ? 'positive' : 'non-negative'}.`);
  if (monetary && number.decimalPlaces() > 2) throw new Error(`${name} must have at most two decimal places.`);
  return number;
}

const sum = (items, key) => items.reduce((total, item) => total.plus(item[key]), ZERO);
const westernGrouping = digits => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function formatA4Number(value) {
  const [whole, fraction] = new D(value).toFixed(2, MONEY_ROUNDING).split('.');
  return `${westernGrouping(whole)}.${fraction}`;
}

export const formatA4Money = value => `₹${formatA4Number(value)}`;

export function formatA4Rate(value) {
  const rate = new D(value);
  const [whole, fraction] = rate.toFixed(Math.max(2, rate.decimalPlaces())).split('.');
  return `₹${westernGrouping(whole)}.${fraction}`;
}

export function formatA4Dimension(value) {
  const n = new D(value);
  const whole = n.floor(), fraction = n.minus(whole).toString();
  const quarter = { '0.25': '¼', '0.5': '½', '0.75': '¾' }[fraction];
  return quarter ? `${whole.isZero() ? '' : whole.toString()}${quarter}` : n.toString();
}

const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const scales = ['', 'Thousand', 'Lakh', 'Crore', 'Arab', 'Kharab', 'Neel', 'Padma'];

function underThousand(n) {
  const result = [];
  if (n >= 100) { result.push(`${units[Math.floor(n / 100)]} Hundred`); n %= 100; }
  if (n >= 20) { result.push(n % 10 ? `${tens[Math.floor(n / 10)]}-${units[n % 10].toLowerCase()}` : tens[n / 10]); }
  else if (n) result.push(units[n]);
  return result.join(' ');
}

export function amountInWords(value) {
  const [integer, paise] = new D(value).toFixed(2, MONEY_ROUNDING).split('.');
  let remaining = BigInt(integer);
  const chunks = [Number(remaining % 1000n)];
  remaining /= 1000n;
  while (remaining) { chunks.push(Number(remaining % 100n)); remaining /= 100n; }
  if (chunks.length > scales.length) throw new Error('Amount exceeds supported amount-in-words range.');
  const words = chunks.map((n, index) => n ? `${underThousand(n)}${scales[index] ? ` ${scales[index]}` : ''}` : '')
    .reverse().filter(Boolean).join(' ') || 'Zero';
  const fraction = Number(paise);
  return `Rupees ${words}${fraction ? ` and ${underThousand(fraction)} Paise` : ''} Only.`;
}

function isoDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error('Invoice date is invalid.');
  return { datetime: date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }),
    label: date.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) };
}

function safeLogo(value) {
  return typeof value === 'string' && value.length < 2_000_000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) ? value : null;
}

export function prepareA4Invoice(input) {
  if (!input || !['sample', 'production'].includes(input.mode)) throw new Error('Invoice mode must be sample or production.');
  if (input.currency !== 'INR') throw new Error('Only INR invoices are supported.');
  const invoiceNumber = required(input.invoiceNumber, 'Invoice reference');
  const invoiceDate = isoDate(input.invoiceDate);
  const seller = input.seller || {};
  const identity = {
    mode: input.mode, invoiceNumber, invoiceDate, status: required(input.status, 'Status'),
    title: input.mode === 'sample' ? 'Sample invoice' : 'Buyer invoice',
    seller: { name: required(seller.name, 'Business name'), location: seller.location?.trim() || '',
      phone: seller.phone?.trim() || '', contactLine: seller.contactLine?.trim() || '',
      logo: safeLogo(seller.logo), signatoryName: seller.signatoryName?.trim() || '',
      // Optional settlement line; non-string values (null, numbers, objects) are ignored.
      bankDetails: typeof seller.bankDetails === 'string' ? seller.bankDetails.trim() : '' },
    party: required(input.party, 'Party'), lorryNumber: required(input.lorryNumber, 'Lorry number'),
    destination: required(input.destination, 'Destination'), supervisor: required(input.supervisor, 'Supervisor'),
    currency: input.currency,
  };
  if (input.mode === 'production' && !['Draft', 'Dispatched', 'Delivered'].includes(identity.status)) throw new Error('Unrecognized invoice status.');
  if (!Array.isArray(input.groups) || input.groups.length < 1) throw new Error('At least one measurement group is required.');

  const warnings = [], groupIds = new Set(), entryIds = new Set();
  const groups = input.groups.map(group => {
    const id = Number(group.id);
    if (!Number.isSafeInteger(id) || id < 1 || groupIds.has(id)) throw new Error(`Invalid or duplicate measurement group: ${group.id}.`);
    groupIds.add(id);
    if (!Array.isArray(group.entries) || !group.entries.length) throw new Error(`Group ${id} needs at least one measurement entry.`);
    const entries = group.entries.map((entry, index) => {
      const entryId = entry.id == null ? `${id}-${index + 1}` : String(entry.id);
      if (!entryId || entryIds.has(entryId)) throw new Error(`Duplicate or missing entry identifier: ${entryId}.`);
      entryIds.add(entryId);
      if (!['regular', 'top'].includes(entry.type)) throw new Error(`Invalid type in group ${id}, entry ${entryId}.`);
      const length = decimal(entry.lengthFt, `Length in group ${id}`, { positive: true });
      const width = decimal(entry.widthFt, `Width in group ${id}`, { positive: true });
      const quantity = Number(entry.quantity);
      if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error(`Quantity in group ${id} must be a positive integer.`);
      const area = length.times(width).times(quantity);
      const rate = entry.ratePerSqFt == null ? null : decimal(entry.ratePerSqFt, `Rate in group ${id}`);
      const rawCharge = rate?.times(area);
      const calculated = rawCharge?.toDecimalPlaces(2, MONEY_ROUNDING);
      if (calculated == null && entry.authoritativeAmount == null) throw new Error(`Group ${id}, entry ${entryId} needs a rate or stored amount.`);
      const amount = entry.authoritativeAmount == null ? calculated : decimal(entry.authoritativeAmount, `Stored amount in group ${id}`, { monetary: true });
      if (calculated && !calculated.equals(amount)) warnings.push(`Group ${id}, entry ${entryId}: stored amount ${formatA4Money(amount)} differs from calculated ${formatA4Money(calculated)}. The stored line amount is shown.`);
      // The server saves rounded line amounts but rounds the sum of exact charges once.
      // Only use a rate to reconstruct that sum when it agrees with the saved line;
      // a mismatched rate must never supersede an authoritative saved amount.
      const unroundedAmount = rawCharge && calculated.equals(amount) ? rawCharge : amount;
      return { id: entryId, type: entry.type, lengthFt: length.toString(), widthFt: width.toString(), quantity,
        ratePerSqFt: rate?.toString() ?? null,
        area: area.toString(), amount: amount.toFixed(2, MONEY_ROUNDING), unroundedAmount: unroundedAmount.toString() };
    });
    const regular = entries.filter(entry => entry.type === 'regular');
    const top = entries.filter(entry => entry.type === 'top');
    const totals = list => ({ pieces: list.reduce((n, entry) => n + entry.quantity, 0), area: sum(list, 'area').toString(), amount: sum(list, 'unroundedAmount').toFixed(2, MONEY_ROUNDING) });
    const regularTotals = totals(regular), total = totals(entries);
    return { id, entries: [...regular, ...top], regular: regularTotals,
      top: { ...totals(top), amount: new D(total.amount).minus(regularTotals.amount).toFixed(2, MONEY_ROUNDING) }, total };
  }).sort((a, b) => a.id - b.id);
  const all = groups.flatMap(group => group.entries);
  const regular = all.filter(entry => entry.type === 'regular');
  const top = all.filter(entry => entry.type === 'top');
  const regularArea = sum(regular, 'area'), topArea = sum(top, 'area');
  const materialTotal = sum(all, 'unroundedAmount').toDecimalPlaces(2, MONEY_ROUNDING);
  const regularAmount = sum(regular, 'unroundedAmount').toDecimalPlaces(2, MONEY_ROUNDING);
  // Keep both printed category amounts reconcilable to the authoritative round-once total.
  const topAmount = materialTotal.minus(regularAmount);
  const loadingRoyalty = decimal(input.loadingRoyalty, 'Loading / royalty', { monetary: true });
  const netPayable = materialTotal.plus(loadingRoyalty);
  const stored = input.storedTotals || {};
  for (const [key, calculated, label] of [
    ['totalPieces', all.reduce((n, entry) => n + entry.quantity, 0), 'Total pieces'],
    ['totalArea', regularArea.plus(topArea).toDecimalPlaces(2, MONEY_ROUNDING), 'Total area'],
    ['materialTotal', materialTotal, 'Material total'],
    ['netPayable', netPayable, 'Net payable'],
  ]) if (stored[key] != null && !new D(stored[key]).equals(calculated)) {
    warnings.push(`${label}: stored ${stored[key]} differs from the sum of the saved measurement lines (${calculated}).`);
  }
  return { ...identity, groups, loadingRoyalty: loadingRoyalty.toFixed(2),
    totals: { pieces: all.reduce((n, entry) => n + entry.quantity, 0), regularArea: regularArea.toString(), topArea: topArea.toString(),
      area: regularArea.plus(topArea).toString(), regularAmount: regularAmount.toFixed(2), topAmount: topAmount.toFixed(2),
      materialTotal: materialTotal.toFixed(2), netPayable: netPayable.toFixed(2) },
    amountWords: amountInWords(netPayable), warnings };
}

export function sampleA4Invoice() {
  return {
    mode: 'sample', currency: 'INR', invoiceNumber: 'SAMPLE-024', invoiceDate: '2026-10-11', status: 'SAMPLE',
    seller: { name: 'Sample Stone Supplies', location: 'Demo location, India', contactLine: 'Illustrative business' },
    party: 'DEMO BUYER', lorryNumber: 'DEMO-01', destination: 'DEMO CITY', supervisor: 'SAMPLE', loadingRoyalty: '500.00',
    groups: Array.from({ length: 24 }, (_, index) => {
      const id = index + 1;
      return { id, entries: Array.from({ length: 7 }, (_, j) => {
        const [lengthFt, widthFt] = patterns[(id + j - 1) % patterns.length];
        return { id: `${id}-${j + 1}`, type: j < 4 ? 'regular' : 'top', lengthFt, widthFt,
          quantity: 1 + ((id + j) % 3), ratePerSqFt: '40.00' };
      }) };
    }),
  };
}

export function a4InvoiceFromDispatch(record) {
  const business = record?.businessSnapshot || {};
  const byNumber = new Map();
  for (const [groupIndex, group] of (record?.inventory || []).entries()) {
    // Historical records may have only individual pieces rather than numbered rows.
    const rows = group.measurementRows?.length ? group.measurementRows : (group.pieces || []).map(piece => ({ ...piece, quantity: 1, category: 'Regular' }));
    for (const [rowIndex, row] of rows.entries()) {
      const id = row.rowNo ?? groupIndex + 1;
      if (!byNumber.has(id)) byNumber.set(id, { id, entries: [] });
      byNumber.get(id).entries.push({ id: `${groupIndex + 1}-${rowIndex + 1}`, type: row.category === 'TOP' ? 'top' : row.category === 'Regular' || row.category == null ? 'regular' : row.category,
        lengthFt: row.lengthFt, widthFt: row.widthFt, quantity: row.quantity ?? 1,
        ratePerSqFt: group.ratePerSqFt, authoritativeAmount: row.lineTotal });
    }
  }
  return prepareA4Invoice({ mode: 'production', currency: 'INR', invoiceNumber: record?.dispatchSlipNumber, invoiceDate: record?.date,
    status: record?.status, seller: { name: business.businessName, location: business.address, phone: business.phone,
      logo: business.logoDataUrl, signatoryName: business.signatoryName, bankDetails: business.bankDetails }, party: record?.partyName,
    lorryNumber: record?.logistics?.truckNumber, destination: record?.logistics?.buyerDestination,
    supervisor: record?.supervisor, groups: [...byNumber.values()], loadingRoyalty: record?.summary?.loadingAndRoyaltyFees,
    storedTotals: { totalPieces: record?.summary?.totalPieces, totalArea: record?.summary?.totalDispatchVolumeSqFt,
      materialTotal: record?.summary?.baseMaterialTotal, netPayable: record?.summary?.netBillableAmount } });
}