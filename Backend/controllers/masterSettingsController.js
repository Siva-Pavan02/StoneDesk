const prisma = require('../utils/prisma');
const { text, number, bad } = require('../utils/pilotCalculations');
const { storeLogo } = require('../utils/businessBranding');
const { randomUUID } = require('crypto');
const { referenceKey, removeReference, MAX_SAVED_REFERENCES } = require('../utils/savedReferences');
const { productFinish, validateRateUnit, publicSettings } = require('../utils/productRates');

const getOrCreateSettings = async (organizationId) => {
  if (!organizationId) throw new Error('Missing organizationId');
  return prisma.masterSettings.findUniqueOrThrow({ where: { id: organizationId } });
};

async function updateWithVersion(settings, data) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await prisma.masterSettings.findUnique({ where: { id: settings.id }, select: { version: true } });
    if (!current) throw Object.assign(new Error('Settings not found'), { status: 404 });
    const result = await prisma.masterSettings.updateMany({
      where: { id: settings.id, version: current.version },
      data: { ...data, version: { increment: 1 } }
    });
    if (result.count) return prisma.masterSettings.findUnique({ where: { id: settings.id } });
  }
  throw Object.assign(new Error('Settings changed. Please retry.'), { status: 409 });
}

exports.updateProfile = async (req, res, next) => {
  try {
    const businessName = text(req.body.businessName, 'business name');
    const address = typeof req.body.address === 'string' ? req.body.address.trim() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const gstNumber = typeof req.body.gstNumber === 'string' ? req.body.gstNumber.trim().toUpperCase() : '';
    const tradeLicense = typeof req.body.tradeLicense === 'string' ? req.body.tradeLicense.trim() : '';
    if (gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstNumber)) return res.status(400).json({ error: 'Enter a valid 15-character GST number, or leave it blank' });
    if (tradeLicense.length > 80) return res.status(400).json({ error: 'Trade license is too long' });
    if (address.length > 300 || phone.length > 30) return res.status(400).json({ error: 'Address or phone is too long' });
    // Same semantics as address/phone: trimmed, blank or omitted persists '', limit measured after trimming.
    const bankDetails = typeof req.body.bankDetails === 'string' ? req.body.bankDetails.trim() : '';
    if (bankDetails.length > 300) return res.status(400).json({ error: 'Bank details must be at most 300 characters' });

    let settings = await getOrCreateSettings(req.user.organizationId);
    const logoChange = req.body.removeLogo === true ? { logoPath: null } : {};

    const feeChange = req.body.defaultRoyaltyFee === undefined ? {} : { defaultRoyaltyFee: number(req.body.defaultRoyaltyFee, 'charges') };

    settings = await updateWithVersion(settings, { businessName, address, phone, bankDetails, gstNumber, tradeLicense, ...logoChange, ...feeChange });
    res.json(publicSettings(settings));
  } catch (err) { next(err); }
};

exports.uploadLogo = async (req, res, next) => {
  try {
    const logoPath = await storeLogo(req.body, req.get('Content-Type'), req.user.organizationId);
    let settings = await getOrCreateSettings(req.user.organizationId);
    settings = await updateWithVersion(settings, { logoPath });
    res.json(publicSettings(settings));
  } catch (err) { next(err); }
};

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings(req.user.organizationId);
    // Accept the current UUID, shareable organization code and legacy own-yard alias.
    // Never feed an arbitrary code into a UUID column or query another tenant.
    if (!['unit_04', settings.id, settings.organizationId].includes(req.params.quarryId)) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!Array.isArray(settings.stoneRates)) settings.stoneRates = [];
    res.json(publicSettings(settings));
  } catch (error) { next(error); }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const allowed = ['savedTrucks', 'savedDestinations', 'stoneRates', 'defaultRoyaltyFee'];
    const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (data.defaultRoyaltyFee !== undefined) number(data.defaultRoyaltyFee, 'charges');
    for (const field of ['savedTrucks', 'savedDestinations']) if (data[field] !== undefined) {
      if (!Array.isArray(data[field])) return res.status(400).json({ error: 'Invalid list' });
      data[field] = [...new Set(data[field].map(value => text(value, field)))].slice(0, MAX_SAVED_REFERENCES);
    }
    if (data.stoneRates !== undefined) {
      if (!Array.isArray(data.stoneRates)) return res.status(400).json({ error: 'Invalid products' });
      const ids = new Set(), products = new Set();
      data.stoneRates = data.stoneRates.map(r => ({
        id: r?.id === undefined ? randomUUID() : text(r.id, 'product ID', 80),
        stoneType: text(r?.stoneType, 'product'),
        finish: productFinish(r?.finish, r?.rateUnit),
        defaultRate: number(r?.defaultRate, 'rate'),
        rateUnit: validateRateUnit(r?.rateUnit),
      }));
      for (const rate of data.stoneRates) {
        const key = JSON.stringify([rate.stoneType, rate.finish]);
        if (ids.has(rate.id) || products.has(key)) bad('Duplicate product or product ID');
        ids.add(rate.id); products.add(key);
      }
    }
    let settings = await getOrCreateSettings(req.user.organizationId);
    settings = await updateWithVersion(settings, data);
    res.json(publicSettings(settings));
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    next(error);
  }
};


async function mutateSettings(organizationId, change) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const settings = await getOrCreateSettings(organizationId);
    const where = { id: settings.id, version: settings.version };
    const data = change(structuredClone(settings));
    data.version = { increment: 1 };
    const result = await prisma.masterSettings.updateMany({ where, data });
    if (result.count) return prisma.masterSettings.findUnique({ where: { id: settings.id } });
  }
  throw Object.assign(new Error('Settings changed. Please retry.'), { status: 409 });
}
function conflict(message) { throw Object.assign(new Error(message), { status: 409 }); }
function missing() { throw Object.assign(new Error('Not found'), { status: 404 }); }
const mutate = change => async (req, res, next) => {
  try { res.json(publicSettings(await mutateSettings(req.user.organizationId, settings => change(settings, req)))); }
  catch (error) { next(error); }
};
exports.addTruck = mutate((settings, req) => {
  const value = text(req.body.truckNumber, 'truck number', 40).toUpperCase();
  // Same dedupe key as the remembered suggestions (utils/savedReferences.js).
  if (settings.savedTrucks.some(item => referenceKey('trucks', item) === referenceKey('trucks', value))) conflict('Duplicate truck');
  if (settings.savedTrucks.length >= MAX_SAVED_REFERENCES) conflict('Saved truck list is full');
  return { savedTrucks: { push: value } };
});
exports.deleteTruck = mutate((settings, req) => ({ savedTrucks: { set: removeReference(settings.savedTrucks, req.params.truckNumber, 'trucks') } }));
exports.addDestination = mutate((settings, req) => {
  const value = text(req.body.destination, 'destination', 200);
  if (settings.savedDestinations.some(item => referenceKey('destinations', item) === referenceKey('destinations', value))) conflict('Duplicate destination');
  if (settings.savedDestinations.length >= MAX_SAVED_REFERENCES) conflict('Saved destination list is full');
  return { savedDestinations: { push: value } };
});
exports.deleteDestination = mutate((settings, req) => ({ savedDestinations: { set: removeReference(settings.savedDestinations, req.params.destination, 'destinations') } }));
exports.addStoneRate = mutate((settings, req) => {
  const stoneType = text(req.body.stoneType, 'product'), finish = productFinish(req.body.finish, req.body.rateUnit), defaultRate = number(req.body.defaultRate, 'rate'), rateUnit = validateRateUnit(req.body.rateUnit);
  if (settings.stoneRates.some(r => r.stoneType === stoneType && r.finish === finish)) conflict('Duplicate stone-rate combination');
  return { stoneRates: [...settings.stoneRates, { id: randomUUID(), stoneType, finish, defaultRate, rateUnit }] };
});
exports.updateStoneRate = mutate((settings, req) => {
  const rate = settings.stoneRates.find(r => r.id === req.params.rateId);
  if (!rate) missing();
  const stoneType = req.body.stoneType === undefined ? rate.stoneType : text(req.body.stoneType, 'product');
  const finish = productFinish(req.body.finish === undefined ? rate.finish : req.body.finish, req.body.rateUnit ?? rate.rateUnit);
  const defaultRate = number(req.body.defaultRate, 'rate');
  const rateUnit = req.body.rateUnit === undefined ? (rate.rateUnit ?? 'SQ_FT') : validateRateUnit(req.body.rateUnit);
  if (settings.stoneRates.some(r => r.id !== rate.id && r.stoneType === stoneType && r.finish === finish)) conflict('Duplicate stone-rate combination');
  return { stoneRates: settings.stoneRates.map(r => r.id === rate.id ? { ...r, stoneType, finish, defaultRate, rateUnit } : r) };
});
exports.deleteStoneRate = mutate((settings, req) => {
  if (!settings.stoneRates.some(r => r.id === req.params.rateId)) missing();
  return { stoneRates: settings.stoneRates.filter(r => r.id !== req.params.rateId) };
});
exports.updateRoyalty = async (req, res, next) => {
  try {
    const defaultRoyaltyFee = number(req.body.defaultRoyaltyFee, 'charges');
    let settings = await getOrCreateSettings(req.user.organizationId);
    settings = await updateWithVersion(settings, { defaultRoyaltyFee });
    res.json(publicSettings(settings));
  } catch (error) { next(error); }
};
