const { randomUUID } = require('node:crypto');
const prisma = require('../utils/prisma');
const calc = require('../utils/pilotCalculations');
const { snapshot } = require('../utils/businessBranding');
const { buildAnalytics, windows } = require('../utils/dispatchAnalytics');
const { auditLog } = require('../utils/auditLog');
const { STATUS_TARGETS, statusTransitionError } = require('../utils/dispatchStatus');
const { rememberDispatchReferences } = require('../utils/savedReferences');

// Kept small to bound the analytics heap; the larger DB-side aggregation rewrite is deliberately deferred.
const ANALYTICS_RECORD_CAP = 5000;

function details(body) {
  const supervisor = calc.text(body.supervisor, 'manager');
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
      prisma.masterSettings.findUnique({ where: { id: req.user.organizationId }, select: { businessName: true, stoneRates: true, defaultRoyaltyFee: true } })
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
    // Remembers truck/destination as suggestions; never fails the save.
    await rememberDispatchReferences(prisma, req.user.organizationId, dispatch.logistics);
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
      where: { id: dispatch.id, organizationId: req.user.organizationId, status: 'Draft', updatedAt: dispatch.updatedAt },
      data: { ...metadata, inventory, summary: calc.totals(inventory, fee) }
    });
    if (updateResult.count === 0) return res.status(409).json({ error: 'Load changed. Refresh and try again.' });
    await rememberDispatchReferences(prisma, req.user.organizationId, metadata.logistics);

    res.json(await prisma.dispatch.findFirst({ where: { id: dispatch.id, organizationId: req.user.organizationId } }));
  } catch (err) { next(err); }
};

exports.finalizeDispatch = async (req, res, next) => {
  try {
    // Parallelize: fetch dispatch and settings simultaneously
    const [dispatch, settings] = await Promise.all([
      prisma.dispatch.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } }),
      prisma.masterSettings.findUnique({ where: { id: req.user.organizationId }, select: { businessName: true, address: true, phone: true, bankDetails: true, logoPath: true } })
    ]);
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    if (dispatch.status !== 'Draft') return res.json(dispatch);
    const inventory = calc.processInventory(dispatch.inventory);
    const summary = calc.totals(inventory, dispatch.summary.loadingAndRoyaltyFees);
    const businessSnapshot = await snapshot(settings, req.user.organizationId);

    const updateResult = await prisma.dispatch.updateMany({
      where: { id: dispatch.id, organizationId: req.user.organizationId, status: 'Draft', updatedAt: dispatch.updatedAt },
      data: { inventory, summary, businessSnapshot, status: 'Dispatched' }
    });

    if (!updateResult.count) return res.status(409).json({ error: 'Load changed. Refresh and try again.' });
    await rememberDispatchReferences(prisma, req.user.organizationId, dispatch.logistics);
    res.json(await prisma.dispatch.findFirst({ where: { id: dispatch.id, organizationId: req.user.organizationId } }));
  } catch (err) { next(err); }
};

const FINALIZED_STATUSES = ['Dispatched', 'Delivered'];

exports.reviseDispatch = async (req, res, next) => {
  try {
    const id = req.params.id;
    const organizationId = req.user.organizationId;
    const dispatch = await prisma.dispatch.findFirst({ where: { id, organizationId } });
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    if (!FINALIZED_STATUSES.includes(dispatch.status)) return res.status(409).json({ error: 'Only a finalized invoice can be revised.' });

    // Client's last-read timestamp: a stale edit must not overwrite a newer revision.
    if (req.body.updatedAt !== undefined) {
      const clientTime = new Date(req.body.updatedAt).getTime();
      if (clientTime !== new Date(dispatch.updatedAt).getTime()) return res.status(409).json({ error: 'Load changed. Refresh and try again.' });
    }

    const { updatedAt: _clientUpdatedAt, ...body } = req.body;
    const merged = { ...dispatch, ...body };
    if (dispatch.partyName === null && !Object.hasOwn(body, 'partyName')) delete merged.partyName;
    const metadata = details(merged);
    const inventory = calc.processInventory(merged.inventory);
    const fee = body.loadingAndRoyaltyFees ?? dispatch.summary?.loadingAndRoyaltyFees;
    const summary = calc.totals(inventory, fee);

    // Snapshot of the currently committed version, taken before applying new values.
    const revisionSnapshot = {
      inventory: dispatch.inventory,
      summary: dispatch.summary,
      logistics: dispatch.logistics,
      supervisor: dispatch.supervisor,
      partyName: dispatch.partyName,
      date: dispatch.date,
      // businessSnapshot is not copied: branding never changes on revise, and the
      // history view falls back to the record's own businessSnapshot.
      revisedAt: new Date().toISOString(),
      revisedByUserId: req.user.id
    };
    const revisions = [...(Array.isArray(dispatch.revisions) ? dispatch.revisions : []), revisionSnapshot];

    // dispatchSlipNumber and status are intentionally omitted so they stay unchanged.
    const updateResult = await prisma.dispatch.updateMany({
      where: { id: dispatch.id, organizationId, status: { in: FINALIZED_STATUSES }, updatedAt: dispatch.updatedAt },
      data: { ...metadata, inventory, summary, revisions }
    });
    if (updateResult.count === 0) return res.status(409).json({ error: 'Load changed. Refresh and try again.' });
    await rememberDispatchReferences(prisma, organizationId, metadata.logistics);

    await auditLog('dispatch.update', req, { dispatchId: id });
    res.json(await prisma.dispatch.findUnique({ where: { id: dispatch.id } }));
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const to = req.body.status;
    if (typeof to !== 'string' || !STATUS_TARGETS.includes(to)) return res.status(400).json({ error: 'Invalid status transition' });
    const id = req.params.id;
    const organizationId = req.user.organizationId;
    const dispatch = await prisma.dispatch.findFirst({ where: { id, organizationId }, select: { id: true, status: true, updatedAt: true } });
    if (!dispatch) return res.status(404).json({ error: 'Not found' });

    // Same stale-read check as reviseDispatch.
    if (req.body.updatedAt !== undefined) {
      const clientTime = new Date(req.body.updatedAt).getTime();
      if (clientTime !== new Date(dispatch.updatedAt).getTime()) return res.status(409).json({ error: 'Load changed. Refresh and try again.' });
    }

    // Delivered -> Dispatched is Admin only; rules live in utils/dispatchStatus.js.
    const rejected = statusTransitionError(dispatch.status, to, req.user.role);
    if (rejected) return res.status(rejected.status).json({ error: rejected.error });

    const updateResult = await prisma.dispatch.updateMany({
      where: { id, organizationId, status: dispatch.status, updatedAt: dispatch.updatedAt },
      data: { status: to }
    });
    if (updateResult.count === 0) return res.status(409).json({ error: 'Load changed. Refresh and try again.' });

    await auditLog('dispatch.deliver', req, { dispatchId: id, from: dispatch.status, to });
    res.json(await prisma.dispatch.findFirst({ where: { id, organizationId } }));
  } catch (err) { next(err); }
};

exports.deleteDispatch = async (req, res, next) => {
  try {
    const id = req.params.id;
    const organizationId = req.user.organizationId;
    const dispatch = await prisma.dispatch.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, _count: { select: { payments: true } } }
    });
    if (!dispatch) return res.status(404).json({ error: 'Not found' });
    // Anyone who can edit drafts may delete one; finalized invoices stay Admin-only.
    const isAdmin = req.user.role === 'Admin';
    if (dispatch.status !== 'Draft' && !isAdmin) return res.status(403).json({ error: 'Your role does not allow this action' });
    // Only an Admin may remove a load that has payments; its payments are removed with it.
    // Payment -> Dispatch is onDelete: Restrict, so payments are deleted first in the same transaction.
    // Payments are only recorded on finalized bills, which non-admins already cannot delete, so the
    // check below is not normally reachable. It stays as defense in depth.
    if (dispatch._count.payments > 0 && !isAdmin) return res.status(403).json({ error: 'Only an Admin can delete a load with recorded payments.' });

    // Non-admins re-check status so a draft finalized meanwhile is not deleted.
    const { deleteResult, paymentsRemoved } = await prisma.$transaction(async tx => {
      const payments = isAdmin ? await tx.invoicePayment.deleteMany({ where: { dispatchId: id, organizationId } }) : { count: 0 };
      const result = await tx.dispatch.deleteMany({ where: { id, organizationId, ...(isAdmin ? {} : { status: 'Draft' }) } });
      // Roll back the payment removal if the load itself was not deleted.
      if (result.count === 0) throw Object.assign(new Error('dispatch-not-deleted'), { notDeleted: true });
      return { deleteResult: result, paymentsRemoved: payments.count };
    }).catch(err => { if (err.notDeleted) return { deleteResult: { count: 0 }, paymentsRemoved: 0 }; throw err; });
    if (deleteResult.count === 0) return isAdmin
      ? res.status(404).json({ error: 'Not found' })
      : res.status(409).json({ error: 'Load changed. Refresh and try again.' });

    await auditLog('dispatch.delete', req, { dispatchId: id, status: dispatch.status, paymentsRemoved });
    res.json({ ok: true, id, paymentsRemoved });
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

exports.analytics = async (req, res, next) => {
  try {
    const now = new Date();
    const range = windows(now);
    const records = await prisma.dispatch.findMany({
      where: { organizationId: req.user.organizationId, date: { gte: range.start, lt: range.end } },
      select: { date: true, status: true, summary: true, logistics: true },
      orderBy: { date: 'desc' },
      take: ANALYTICS_RECORD_CAP + 1
    });
    if (records.length > ANALYTICS_RECORD_CAP) calc.bad('Too many records to analyse');
    res.json(buildAnalytics(records, now));
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
    if (req.query.q !== undefined && (typeof req.query.q !== 'string' || req.query.q.length > 120)) calc.bad('Search must be at most 120 characters');
    const search = req.query.q?.trim();
    if (search) filter.OR = [
      { partyName: { contains: search, mode: 'insensitive' } },
      { dispatchSlipNumber: { contains: search, mode: 'insensitive' } },
      { logistics: { path: ['truckNumber'], string_contains: search, mode: 'insensitive' } },
      { logistics: { path: ['buyerDestination'], string_contains: search, mode: 'insensitive' } }
    ];
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const cursor = req.query.cursor;
    const dispatches = await prisma.dispatch.findMany({
      where: filter,
      select: LIST_FIELDS,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });
    const hasMore = dispatches.length > limit;
    if (hasMore) dispatches.pop();
    const nextCursor = hasMore ? dispatches[dispatches.length - 1].id : null;
    res.json({ data: dispatches, nextCursor });
  } catch (err) { next(err); }
};
