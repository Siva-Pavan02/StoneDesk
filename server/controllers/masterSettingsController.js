const MasterSettings = require('../models/MasterSettings');

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
      { $set: req.body },
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
    if (!stoneType || !finish || typeof defaultRate !== 'number' || defaultRate < 0) {
      return res.status(400).json({ error: 'Invalid stone rate entry' });
    }
    const settings = await getOrCreateSettings(req.params.quarryId);
    const exists = settings.stoneRates.some(r => r.stoneType === stoneType && r.finish === finish);
    if (exists) {
      return res.status(409).json({ error: 'Duplicate stone-rate combination' });
    }
    settings.stoneRates.push({ stoneType, finish, defaultRate });
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
    if (typeof defaultRate !== 'number' || defaultRate < 0) {
      return res.status(400).json({ error: 'Invalid rate' });
    }
    const settings = await MasterSettings.findOneAndUpdate(
      { quarryId: req.params.quarryId, "stoneRates._id": rateId },
      { $set: { "stoneRates.$.defaultRate": defaultRate } },
      { new: true, runValidators: true }
    );
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
    if (typeof defaultRoyaltyFee !== 'number' || defaultRoyaltyFee < 0) {
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
