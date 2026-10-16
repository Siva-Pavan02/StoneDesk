// Truck numbers and destinations remembered in MasterSettings.savedTrucks/savedDestinations.
// Pure helpers shared by the real controllers and the mock; DB access only through an injected db.

const MAX_SAVED_REFERENCES = 500;
const LIMITS = { trucks: 40, destinations: 200 };

const compactPlate = value => String(value).toUpperCase().replace(/[\s.-]/g, '');

// Must match Frontend/src/utils/truckPlate.js formatTruckNumber.
// Indian registration: TN 01 AB 1234, or Bharat series 22 BH 1234 AA. Returns formatted plate or null.
function formatTruckNumber(value) {
  const plate = compactPlate(value);
  const standard = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{4})$/.exec(plate);
  if (standard) return [standard[1], standard[2].padStart(2, '0'), standard[3], standard[4]].filter(Boolean).join(' ');
  const bharat = /^(\d{2})BH(\d{4})([A-Z]{1,2})$/.exec(plate);
  return bharat ? `${bharat[1]} BH ${bharat[2]} ${bharat[3]}` : null;
}

const collapse = value => value.trim().replace(/\s+/g, ' ');

// Stored form of a value, or null when it cannot be saved.
function normalizeReference(kind, value) {
  if (typeof value !== 'string') return null;
  const clean = collapse(value);
  if (!clean || clean.length > LIMITS[kind]) return null;
  if (kind === 'trucks') return formatTruckNumber(clean) || clean.toUpperCase();
  return clean;
}

// Dedupe key: trucks by compact plate, destinations case-insensitive with collapsed whitespace.
function referenceKey(kind, value) {
  if (typeof value !== 'string') return '';
  return kind === 'trucks' ? compactPlate(value) : collapse(value).toLowerCase();
}

// New list with the value prepended (newest first, capped from the end), or null when invalid or already saved.
function rememberReference(list, value, kind, max = MAX_SAVED_REFERENCES) {
  const normalized = normalizeReference(kind, value);
  if (!normalized) return null;
  const items = Array.isArray(list) ? list : [];
  const key = referenceKey(kind, normalized);
  if (items.some(item => referenceKey(kind, item) === key)) return null;
  return [normalized, ...items].slice(0, max);
}

function removeReference(list, value, kind) {
  const key = referenceKey(kind, value);
  return (Array.isArray(list) ? list : []).filter(item => referenceKey(kind, item) !== key);
}

// Remembers a dispatch's truck and destination. Never throws: a failure must not fail the dispatch save.
async function rememberDispatchReferences(db, organizationId, logistics) {
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const settings = await db.masterSettings.findUnique({
        where: { id: organizationId },
        select: { version: true, savedTrucks: true, savedDestinations: true }
      });
      if (!settings) return;
      const savedTrucks = rememberReference(settings.savedTrucks, logistics?.truckNumber, 'trucks');
      const savedDestinations = rememberReference(settings.savedDestinations, logistics?.buyerDestination, 'destinations');
      if (!savedTrucks && !savedDestinations) return;
      const data = { version: { increment: 1 } };
      if (savedTrucks) data.savedTrucks = { set: savedTrucks };
      if (savedDestinations) data.savedDestinations = { set: savedDestinations };
      const result = await db.masterSettings.updateMany({ where: { id: organizationId, version: settings.version }, data });
      if (result.count) return;
    }
  } catch (err) {
    console.warn('Could not save truck/destination suggestion', err?.code || err?.message);
  }
}

module.exports = {
  MAX_SAVED_REFERENCES,
  LIMITS,
  compactPlate,
  formatTruckNumber,
  normalizeReference,
  referenceKey,
  rememberReference,
  removeReference,
  rememberDispatchReferences
};
