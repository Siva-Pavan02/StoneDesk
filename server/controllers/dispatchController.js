const Dispatch = require('../models/Dispatch');
const MasterSettings = require('../models/MasterSettings');
const calc = require('../utils/dispatchCalculations');

const getRoyaltyFee = async () => {
  const settings = await MasterSettings.findOne({ quarryId: 'unit_04' });
  return settings ? settings.defaultRoyaltyFee : 8500;
};

const generateSlipNumber = async () => {
  const count = await Dispatch.countDocuments();
  return `GS-${Date.now()}-${count}`;
};

const processInventory = (inventoryRaw) => {
  if (!inventoryRaw || !inventoryRaw.length) throw new Error('Empty inventory');
  const processedGroups = [];
  
  for (const group of inventoryRaw) {
    if (!group.stoneType || !group.finish || typeof group.ratePerSqFt !== 'number' || group.ratePerSqFt < 0) {
      throw new Error('Invalid stone rate or missing fields');
    }
    if (!group.pieces || !group.pieces.length) throw new Error('Empty pieces');
    
    const pieces = group.pieces.map(p => calc.calculatePiece(p.lengthFt, p.widthFt));
    const groupSqFt = calc.calculateGroupSqFt(pieces);
    const lineTotal = calc.calculateLineTotal(groupSqFt, group.ratePerSqFt);
    
    processedGroups.push({
      stoneType: group.stoneType,
      finish: group.finish,
      ratePerSqFt: group.ratePerSqFt,
      totalSqFt: groupSqFt, 
      lineTotal,
      pieces
    });
  }
  
  return processedGroups;
};

exports.createDraft = async (req, res, next) => {
  try {
    const { supervisor, logistics, inventory, date } = req.body;
    if (!supervisor || !logistics || !logistics.truckNumber || !logistics.buyerDestination) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const processedInventory = processInventory(inventory);
    const royaltyFee = await getRoyaltyFee();
    const summary = calc.calculateDispatchTotals(processedInventory, royaltyFee);
    
    const slipNumber = await generateSlipNumber();
    
    const dispatch = await Dispatch.create({
      dispatchSlipNumber: slipNumber,
      date: date || new Date(),
      supervisor,
      logistics,
      inventory: processedInventory,
      summary,
      status: 'Draft'
    });
    
    res.json(dispatch);
  } catch (err) {
    next(err);
  }
};

exports.updateDraft = async (req, res, next) => {
  try {
    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    if (dispatch.status !== 'Draft') return res.status(400).json({ error: 'Only Draft can be modified' });
    
    const { supervisor, logistics, inventory, date } = req.body;
    if (supervisor) dispatch.supervisor = supervisor;
    if (logistics) dispatch.logistics = logistics;
    if (date) dispatch.date = date;
    
    if (inventory) {
      const processedInventory = processInventory(inventory);
      const royaltyFee = await getRoyaltyFee();
      const summary = calc.calculateDispatchTotals(processedInventory, royaltyFee);
      dispatch.inventory = processedInventory;
      dispatch.summary = summary;
    }
    
    await dispatch.save();
    res.json(dispatch);
  } catch (err) {
    next(err);
  }
};

exports.finalizeDispatch = async (req, res, next) => {
  try {
    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    if (dispatch.status !== 'Draft') return res.status(400).json({ error: 'Only Draft can be finalized' });
    
    const processedInventory = processInventory(dispatch.inventory);
    const royaltyFee = await getRoyaltyFee();
    const summary = calc.calculateDispatchTotals(processedInventory, royaltyFee);
    
    dispatch.inventory = processedInventory;
    dispatch.summary = summary;
    dispatch.status = 'Dispatched';
    
    await dispatch.save();
    res.json(dispatch);
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    
    const { status } = req.body;
    
    if (dispatch.status === 'Dispatched' && status === 'Delivered') {
      dispatch.status = 'Delivered';
      await dispatch.save();
      return res.json(dispatch);
    }
    
    return res.status(400).json({ error: 'Invalid status transition' });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    res.json(dispatch);
  } catch (err) {
    next(err);
  }
};

exports.getBySlip = async (req, res, next) => {
  try {
    const dispatch = await Dispatch.findOne({ dispatchSlipNumber: req.params.dispatchSlipNumber });
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    res.json(dispatch);
  } catch (err) {
    next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const dispatches = await Dispatch.find(filter).sort({ createdAt: -1 });
    res.json(dispatches);
  } catch (err) {
    next(err);
  }
};
