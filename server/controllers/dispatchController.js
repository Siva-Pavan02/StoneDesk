const { randomUUID } = require('node:crypto');
const Dispatch = require('../models/Dispatch');
const MasterSettings = require('../models/MasterSettings');
const calc = require('../utils/pilotCalculations');
const { snapshot } = require('../utils/businessBranding');

function details(body) {
  const supervisor = calc.text(body.supervisor, 'supervisor');
  const logistics = {
    truckNumber: calc.text(body.logistics?.truckNumber, 'truck number', 40).toUpperCase(),
    buyerDestination: calc.text(body.logistics?.buyerDestination, 'destination', 200)
  };
  if (body.date !== undefined && !(body.date instanceof Date) && (typeof body.date !== 'string' || !body.date.trim())) calc.bad('Invalid date');
  const date = body.date === undefined ? new Date() : new Date(body.date);
  if (!Number.isFinite(date.getTime())) calc.bad('Invalid date');
  const isPilot = Array.isArray(body.inventory) && body.inventory.some(g => g?.measurementRows?.length);
  const partyName = isPilot || body.partyName !== undefined ? calc.text(body.partyName, 'party name') : undefined;
  return { supervisor, logistics, date, partyName };
}
exports.createDraft = async (req, res, next) => {
  try {
    const clientRequestId = req.body.clientRequestId;
    if (clientRequestId !== undefined && (typeof clientRequestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(clientRequestId))) calc.bad('Invalid request ID');
    if (clientRequestId) {
      const existing = await Dispatch.findOne({ clientRequestId });
      if (existing) return res.json(existing);
    }
    const metadata = details(req.body);
    const inventory = calc.processInventory(req.body.inventory);
    const settings = await MasterSettings.findOne({ quarryId: 'unit_04' });
    if (inventory.some(g => g.measurementRows.length) && (!settings?.businessName || !settings.stoneRates.length)) calc.bad('Set up business and at least one product first');
    const fee = req.body.loadingAndRoyaltyFees ?? settings?.defaultRoyaltyFee ?? 0;
    const dispatch = await Dispatch.create({ ...metadata, inventory,
      ...(clientRequestId ? { clientRequestId } : {}),
      dispatchSlipNumber: `GS-${randomUUID()}`,
      summary: calc.totals(inventory, fee), status: 'Draft' });
    res.json(dispatch);
  } catch (err) {
    if (err.code === 11000 && req.body.clientRequestId) {
      try {
        const existing = await Dispatch.findOne({ clientRequestId: req.body.clientRequestId });
        if (existing) return res.json(existing);
      } catch (lookupError) { return next(lookupError); }
    }
    next(err);
  }
};
exports.updateDraft = async (req, res, next) => {
  try {
    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    if (dispatch.status !== 'Draft') return res.status(400).json({ error: 'Only Draft can be modified' });
    const merged = { ...dispatch.toObject(), ...req.body };
    const metadata = details(merged);
    const inventory = calc.processInventory(merged.inventory);
    const fee = req.body.loadingAndRoyaltyFees ?? dispatch.summary.loadingAndRoyaltyFees;
    const updated = await Dispatch.findOneAndUpdate({ _id: dispatch._id, status: 'Draft' },
      { $set: { ...metadata, inventory, summary: calc.totals(inventory, fee) } }, { new: true, runValidators: true });
    if (!updated) return res.status(409).json({ error: 'Load was already finalized' });
    res.json(updated);
  } catch (err) { next(err); }
};
exports.finalizeDispatch = async (req, res, next) => {
  try {
    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    if (dispatch.status !== 'Draft') return res.json(dispatch);
    const inventory = calc.processInventory(dispatch.inventory);
    const settings = await MasterSettings.findOne({ quarryId: 'unit_04' });
    const summary = calc.totals(inventory, dispatch.summary.loadingAndRoyaltyFees);
    const businessSnapshot = await snapshot(settings);
    const updated = await Dispatch.findOneAndUpdate({ _id: dispatch._id, status: 'Draft' },
      { $set: { inventory, summary, businessSnapshot, status: 'Dispatched' } }, { new: true, runValidators: true });
    res.json(updated || await Dispatch.findById(dispatch._id));
  } catch (err) { next(err); }
};
exports.updateStatus = async (req, res, next) => {
  try {
    if (req.body.status !== 'Delivered') return res.status(400).json({ error: 'Invalid status transition' });
    const dispatch = await Dispatch.findOneAndUpdate({ _id: req.params.id, status: 'Dispatched' }, { $set: { status: 'Delivered' } }, { new: true });
    if (!dispatch) return res.status(400).json({ error: 'Invalid status transition' });
    res.json(dispatch);
  } catch (err) { next(err); }
};
exports.getById = async (req, res, next) => {
  try {
    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    res.json(dispatch);
  } catch (err) { next(err); }
};
exports.getBySlip = async (req, res, next) => {
  try {
    const dispatch = await Dispatch.findOne({ dispatchSlipNumber: req.params.dispatchSlipNumber });
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    res.json(dispatch);
  } catch (err) { next(err); }
};
exports.list = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    res.json(await Dispatch.find(filter).select('-businessSnapshot.logoDataUrl').sort({ createdAt: -1 }));
  } catch (err) { next(err); }
};
