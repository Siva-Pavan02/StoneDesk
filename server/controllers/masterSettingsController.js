const MasterSettings = require('../models/MasterSettings');
const { text, number } = require('../utils/pilotCalculations');
const { storeLogo } = require('../utils/businessBranding');

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
    const settings = await getOrCreateSettings(req.params.quarryId);
    Object.assign(settings, { businessName, address, phone, gstNumber, tradeLicense });
    if (req.body.removeLogo === true) settings.logoPath = undefined;
    if (req.body.defaultRoyaltyFee !== undefined) settings.defaultRoyaltyFee = number(req.body.defaultRoyaltyFee, 'charges');
    await settings.save();
    res.json(settings);
  } catch (err) { next(err); }
};
exports.uploadLogo = async (req, res, next) => {
  try {
    const logoPath = await storeLogo(req.body, req.get('Content-Type'));
    const settings = await getOrCreateSettings(req.params.quarryId);
    settings.logoPath = logoPath;
    await settings.save();
    res.json(settings);
  } catch (err) { next(err); }
};

const getOrCreateSettings = async (quarryId) => {
  if (!quarryId) throw new Error('Missing quarryId');
  let settings = await MasterSettings.findOne({ quarryId });
  if (!settings) {
    settings = await MasterSettings.create({ quarryId });
  }
  return settings;
};

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings(req.params.quarryId);
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const settings = await MasterSettings.findOneAndUpdate(
      { quarryId: req.params.quarryId },
      { $set: Object.fromEntries(Object.entries(req.body).filter(([key]) => ['savedTrucks', 'savedDestinations', 'stoneRates', 'defaultRoyaltyFee'].includes(key))) },
      { new: true, runValidators: true }
    );
    if (!settings) return res.status(404).json({ error: 'Not found' });
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

exports.addTruck = async (req, res, next) => {
  try {
    const { truckNumber } = req.body;
    if (!truckNumber || typeof truckNumber !== 'string' || truckNumber.trim() === '') {
      return res.status(400).json({ error: 'Invalid truck number' });
    }
    const settings = await getOrCreateSettings(req.params.quarryId);
    if (settings.savedTrucks.includes(truckNumber.toUpperCase())) {
      return res.status(409).json({ error: 'Duplicate truck' });
    }
    settings.savedTrucks.push(truckNumber.toUpperCase());
    await settings.save();
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

exports.deleteTruck = async (req, res, next) => {
  try {
    const { truckNumber } = req.params;
    const settings = await MasterSettings.findOneAndUpdate(
      { quarryId: req.params.quarryId },
      { $pull: { savedTrucks: truckNumber.toUpperCase() } },
      { new: true }
    );
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

exports.addDestination = async (req, res, next) => {
  try {
    const { destination } = req.body;
    if (!destination || typeof destination !== 'string' || destination.trim() === '') {
      return res.status(400).json({ error: 'Invalid destination' });
    }
    const settings = await getOrCreateSettings(req.params.quarryId);
    if (settings.savedDestinations.includes(destination)) {
      return res.status(409).json({ error: 'Duplicate destination' });
    }
    settings.savedDestinations.push(destination);
    await settings.save();
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

exports.deleteDestination = async (req, res, next) => {
  try {
    const { destination } = req.params;
    const settings = await MasterSettings.findOneAndUpdate(
      { quarryId: req.params.quarryId },
      { $pull: { savedDestinations: destination } },
      { new: true }
    );
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

exports.addStoneRate = async (req, res, next) => {
  try {
    const { stoneType, finish, defaultRate } = req.body;
    if (typeof stoneType !== 'string' || !stoneType.trim() || typeof finish !== 'string' || !finish.trim() || typeof defaultRate !== 'number' || !Number.isFinite(defaultRate) || defaultRate < 0) {
      return res.status(400).json({ error: 'Invalid stone rate entry' });
    }
    const settings = await getOrCreateSettings(req.params.quarryId);
    const exists = settings.stoneRates.some(r => r.stoneType === stoneType && r.finish === finish);
    if (exists) {
      return res.status(409).json({ error: 'Duplicate stone-rate combination' });
    }
    settings.stoneRates.push({ stoneType: stoneType.trim(), finish: finish.trim(), defaultRate });
    await settings.save();
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

exports.updateStoneRate = async (req, res, next) => {
  try {
    const { rateId } = req.params;
    const { defaultRate } = req.body;
    if (typeof defaultRate !== 'number' || !Number.isFinite(defaultRate) || defaultRate < 0) {
      return res.status(400).json({ error: 'Invalid rate' });
    }
    const settings = await MasterSettings.findOne({ quarryId: req.params.quarryId });
    const rate = settings?.stoneRates.id(rateId);
    if (!rate) return res.status(404).json({ error: 'Not found' });
    const stoneType = req.body.stoneType === undefined ? rate.stoneType : text(req.body.stoneType, 'product');
    const finish = req.body.finish === undefined ? rate.finish : text(req.body.finish, 'finish');
    if (settings.stoneRates.some(r => String(r._id) !== rateId && r.stoneType === stoneType && r.finish === finish)) return res.status(409).json({ error: 'Duplicate stone-rate combination' });
    Object.assign(rate, { stoneType, finish, defaultRate });
    await settings.save();
    if (!settings) return res.status(404).json({ error: 'Not found' });
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

exports.deleteStoneRate = async (req, res, next) => {
  try {
    const { rateId } = req.params;
    const settings = await MasterSettings.findOneAndUpdate(
      { quarryId: req.params.quarryId },
      { $pull: { stoneRates: { _id: rateId } } },
      { new: true }
    );
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

exports.updateRoyalty = async (req, res, next) => {
  try {
    const { defaultRoyaltyFee } = req.body;
    if (typeof defaultRoyaltyFee !== 'number' || !Number.isFinite(defaultRoyaltyFee) || defaultRoyaltyFee < 0) {
      return res.status(400).json({ error: 'Invalid royalty fee' });
    }
    const settings = await MasterSettings.findOneAndUpdate(
      { quarryId: req.params.quarryId },
      { $set: { defaultRoyaltyFee } },
      { new: true, runValidators: true }
    );
    if (!settings) {
       const newSettings = await getOrCreateSettings(req.params.quarryId);
       newSettings.defaultRoyaltyFee = defaultRoyaltyFee;
       await newSettings.save();
       return res.json(newSettings);
    }
    res.json(settings);
  } catch (error) {
    next(error);
  }
};
