const prisma = require('../utils/prisma');
const { text, number, bad } = require('../utils/pilotCalculations');
const { storeLogo } = require('../utils/businessBranding');
const { randomUUID } = require('crypto');

const getOrCreateSettings = async (organizationId) => {
  if (!organizationId) throw new Error('Missing organizationId');
  return prisma.masterSettings.upsert({ where: { organizationId }, update: {}, create: { organizationId, stoneRates: [], savedTrucks: [], savedDestinations: [] } });
};

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

    let settings = await getOrCreateSettings(req.user.organizationId);
    const logoChange = req.body.removeLogo === true ? { logoPath: null } : {};

    const feeChange = req.body.defaultRoyaltyFee === undefined ? {} : { defaultRoyaltyFee: number(req.body.defaultRoyaltyFee, 'charges') };

    settings = await prisma.masterSettings.update({
      where: { id: settings.id },
      data: { businessName, address, phone, gstNumber, tradeLicense, ...logoChange, ...feeChange }
    });
    res.json(settings);
  } catch (err) { next(err); }
};

exports.uploadLogo = async (req, res, next) => {
  try {
    const logoPath = await storeLogo(req.body, req.get('Content-Type'));
    let settings = await getOrCreateSettings(req.user.organizationId);
    settings = await prisma.masterSettings.update({
      where: { id: settings.id },
      data: { logoPath }
    });
    res.json(settings);
  } catch (err) { next(err); }
};

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings(req.user.organizationId);
    if (!settings.stoneRates) settings.stoneRates = [];
    res.json(settings);
  } catch (error) { next(error); }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const allowed = ['savedTrucks', 'savedDestinations', 'stoneRates', 'defaultRoyaltyFee'];
    const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (data.defaultRoyaltyFee !== undefined) number(data.defaultRoyaltyFee, 'charges');
    for (const field of ['savedTrucks', 'savedDestinations']) if (data[field] !== undefined) {
      if (!Array.isArray(data[field])) return res.status(400).json({ error: 'Invalid list' });
      data[field] = [...new Set(data[field].map(value => text(value, field)))];
    }
    if (data.stoneRates !== undefined) {
      if (!Array.isArray(data.stoneRates)) return res.status(400).json({ error: 'Invalid products' });
      const ids = new Set(), products = new Set();
      data.stoneRates = data.stoneRates.map(r => ({ _id: r?._id === undefined ? randomUUID() : text(r._id, 'product ID', 80), stoneType: text(r?.stoneType, 'product'), finish: text(r?.finish, 'finish'), defaultRate: number(r?.defaultRate, 'rate') }));
      for (const rate of data.stoneRates) {
        const key = JSON.stringify([rate.stoneType, rate.finish]);
        if (ids.has(rate._id) || products.has(key)) bad('Duplicate product or product ID');
        ids.add(rate._id); products.add(key);
      }
    }
    const settings = await prisma.masterSettings.update({
      where: { organizationId: req.user.organizationId },
      data
    });
    res.json(settings);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    next(error);
  }
};


// Compare the arrays read by this request before replacing JSON or native arrays.
// Retry on a concurrent edit instead of silently losing another administrator's change.
async function mutateSettings(organizationId, change) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const settings = await getOrCreateSettings(organizationId);
    const where = { id: settings.id, stoneRates: { equals: settings.stoneRates }, savedTrucks: { equals: settings.savedTrucks }, savedDestinations: { equals: settings.savedDestinations } };
    const data = change(structuredClone(settings));
    const result = await prisma.masterSettings.updateMany({ where, data });
    if (result.count) return prisma.masterSettings.findUnique({ where: { id: settings.id } });
  }
  throw Object.assign(new Error('Settings changed. Please retry.'), { status: 409 });
}
function conflict(message) { throw Object.assign(new Error(message), { status: 409 }); }
function missing() { throw Object.assign(new Error('Not found'), { status: 404 }); }
const mutate = change => async (req, res, next) => {
  try { res.json(await mutateSettings(req.user.organizationId, settings => change(settings, req))); }
  catch (error) { next(error); }
};
exports.addTruck = mutate((settings, req) => {
  const value = text(req.body.truckNumber, 'truck number', 40).toUpperCase();
  if (settings.savedTrucks.includes(value)) conflict('Duplicate truck');
  return { savedTrucks: { push: value } };
});
exports.deleteTruck = mutate((settings, req) => ({ savedTrucks: { set: settings.savedTrucks.filter(value => value !== req.params.truckNumber.trim().toUpperCase()) } }));
exports.addDestination = mutate((settings, req) => {
  const value = text(req.body.destination, 'destination', 200);
  if (settings.savedDestinations.includes(value)) conflict('Duplicate destination');
  return { savedDestinations: { push: value } };
});
exports.deleteDestination = mutate((settings, req) => ({ savedDestinations: { set: settings.savedDestinations.filter(value => value !== req.params.destination.trim()) } }));
exports.addStoneRate = mutate((settings, req) => {
  const stoneType = text(req.body.stoneType, 'product'), finish = text(req.body.finish, 'finish'), defaultRate = number(req.body.defaultRate, 'rate');
  if (settings.stoneRates.some(r => r.stoneType === stoneType && r.finish === finish)) conflict('Duplicate stone-rate combination');
  return { stoneRates: [...settings.stoneRates, { _id: randomUUID(), stoneType, finish, defaultRate }] };
});
exports.updateStoneRate = mutate((settings, req) => {
  const rate = settings.stoneRates.find(r => r._id === req.params.rateId);
  if (!rate) missing();
  const stoneType = req.body.stoneType === undefined ? rate.stoneType : text(req.body.stoneType, 'product');
  const finish = req.body.finish === undefined ? rate.finish : text(req.body.finish, 'finish');
  const defaultRate = number(req.body.defaultRate, 'rate');
  if (settings.stoneRates.some(r => r._id !== rate._id && r.stoneType === stoneType && r.finish === finish)) conflict('Duplicate stone-rate combination');
  return { stoneRates: settings.stoneRates.map(r => r._id === rate._id ? { ...r, stoneType, finish, defaultRate } : r) };
});
exports.deleteStoneRate = mutate((settings, req) => {
  if (!settings.stoneRates.some(r => r._id === req.params.rateId)) missing();
  return { stoneRates: settings.stoneRates.filter(r => r._id !== req.params.rateId) };
});
exports.updateRoyalty = async (req, res, next) => {
  try {
    const defaultRoyaltyFee = number(req.body.defaultRoyaltyFee, 'charges');
    res.json(await prisma.masterSettings.upsert({ where: { organizationId: req.user.organizationId }, create: { organizationId: req.user.organizationId, defaultRoyaltyFee, stoneRates: [], savedTrucks: [], savedDestinations: [] }, update: { defaultRoyaltyFee } }));
  } catch (error) { next(error); }
};
