const { randomUUID } = require('node:crypto');
const prisma = require('../utils/prisma');
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
    // Parallelize: check for existing dispatch + fetch settings simultaneously
    const [existing, settings] = await Promise.all([
      clientRequestId ? prisma.dispatch.findFirst({ where: { clientRequestId, organizationId: req.user.organizationId } }) : null,
      prisma.masterSettings.findUnique({ where: { organizationId: req.user.organizationId } })
    ]);
    if (existing) return res.json(existing);
    const metadata = details(req.body);
    const inventory = calc.processInventory(req.body.inventory);
    if (inventory.some(g => g.measurementRows.length) && (!settings?.businessName || !settings.stoneRates || !settings.stoneRates.length)) calc.bad('Set up business and at least one product first');
    const fee = req.body.loadingAndRoyaltyFees ?? settings?.defaultRoyaltyFee ?? 0;
    const dispatch = await prisma.dispatch.create({
      data: {
        organizationId: req.user.organizationId,
        ...metadata,
        inventory,
        ...(clientRequestId ? { clientRequestId } : {}),
        dispatchSlipNumber: `GS-${randomUUID()}`,
        summary: calc.totals(inventory, fee),
        status: 'Draft'
      }
    });
    res.json(dispatch);
  } catch (err) {
    if (err.code === 'P2002' && req.body.clientRequestId) {
      try {
        const existing = await prisma.dispatch.findFirst({ where: { clientRequestId: req.body.clientRequestId, organizationId: req.user.organizationId } });
        if (existing) return res.json(existing);
      } catch (lookupError) { return next(lookupError); }
    }
    next(err);
  }
};

exports.updateDraft = async (req, res, next) => {
  try {
    const dispatch = await prisma.dispatch.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    if (dispatch.status !== 'Draft') return res.status(400).json({ error: 'Only Draft can be modified' });
    const merged = { ...dispatch, ...req.body };
    if (dispatch.partyName === null && !Object.hasOwn(req.body, 'partyName')) delete merged.partyName;
    const metadata = details(merged);
    const inventory = calc.processInventory(merged.inventory);
    const fee = req.body.loadingAndRoyaltyFees ?? dispatch.summary.loadingAndRoyaltyFees;

    const updateResult = await prisma.dispatch.updateMany({
      where: { id: dispatch.id, status: 'Draft', updatedAt: dispatch.updatedAt },
      data: { ...metadata, inventory, summary: calc.totals(inventory, fee) }
    });
    if (updateResult.count === 0) return res.status(409).json({ error: 'Load changed. Refresh and try again.' });

    res.json(await prisma.dispatch.findUnique({ where: { id: dispatch.id } }));
  } catch (err) { next(err); }
};

exports.finalizeDispatch = async (req, res, next) => {
  try {
    // Parallelize: fetch dispatch and settings simultaneously
    const [dispatch, settings] = await Promise.all([
      prisma.dispatch.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } }),
      prisma.masterSettings.findUnique({ where: { organizationId: req.user.organizationId } })
    ]);
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    if (dispatch.status !== 'Draft') return res.json(dispatch);
    const inventory = calc.processInventory(dispatch.inventory);
    const summary = calc.totals(inventory, dispatch.summary.loadingAndRoyaltyFees);
    const businessSnapshot = await snapshot(settings);

    const updateResult = await prisma.dispatch.updateMany({
      where: { id: dispatch.id, status: 'Draft', updatedAt: dispatch.updatedAt },
      data: { inventory, summary, businessSnapshot, status: 'Dispatched' }
    });

    if (!updateResult.count) return res.status(409).json({ error: 'Load changed. Refresh and try again.' });
    res.json(await prisma.dispatch.findUnique({ where: { id: dispatch.id } }));
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (req.body.status !== 'Delivered') return res.status(400).json({ error: 'Invalid status transition' });
    const updateResult = await prisma.dispatch.updateMany({
      where: { id: req.params.id, status: 'Dispatched', organizationId: req.user.organizationId },
      data: { status: 'Delivered' }
    });
    if (updateResult.count === 0) return res.status(400).json({ error: 'Invalid status transition' });
    res.json(await prisma.dispatch.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } }));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const dispatch = await prisma.dispatch.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    res.json(dispatch);
  } catch (err) { next(err); }
};

exports.getBySlip = async (req, res, next) => {
  try {
    const dispatch = await prisma.dispatch.findFirst({ where: { dispatchSlipNumber: req.params.dispatchSlipNumber, organizationId: req.user.organizationId } });
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    res.json(dispatch);
  } catch (err) { next(err); }
};

const LIST_FIELDS = {
  id: true, dispatchSlipNumber: true, date: true, supervisor: true,
  partyName: true, logistics: true, status: true, summary: true,
  createdAt: true, updatedAt: true
};
const MAX_LIST_LIMIT = 50;
const DEFAULT_LIST_LIMIT = 20;

exports.list = async (req, res, next) => {
  try {
    const filter = { organizationId: req.user.organizationId };
    if (req.query.status && !['Draft', 'Dispatched', 'Delivered'].includes(req.query.status)) calc.bad('Invalid status');
    if (req.query.status) filter.status = req.query.status;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const cursor = req.query.cursor;
    const dispatches = await prisma.dispatch.findMany({
      where: filter,
      select: LIST_FIELDS,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });
    const hasMore = dispatches.length > limit;
    if (hasMore) dispatches.pop();
    const nextCursor = hasMore ? dispatches[dispatches.length - 1].id : null;
    res.json({ data: dispatches, nextCursor });
  } catch (err) { next(err); }
};
