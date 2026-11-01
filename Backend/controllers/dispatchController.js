const { randomUUID } = require('node:crypto');
const prisma = require('../utils/prisma');
const calc = require('../utils/pilotCalculations');
const { round2 } = require('../utils/dispatchCalculations');
const { snapshot } = require('../utils/businessBranding');
const { buildAnalytics, windows, ANALYTICS_PERIODS } = require('../utils/dispatchAnalytics');
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
    const period = req.query.period ?? '3';
    if (typeof period !== 'string' || !ANALYTICS_PERIODS.has(period)) calc.bad('Invalid analytics period');
    const allTime = period === 'all';
    const range = windows(now, allTime ? null : Number(period));
    const currentPeriodStart = range.currentStart || range.end;
    const previousPeriodStart = range.start || range.end;
    const recordsQuery = allTime ? Promise.resolve([]) : prisma.dispatch.findMany({
      where: { organizationId: req.user.organizationId, date: { gte: range.start, lt: range.end } },
      select: { date: true, status: true, summary: true, logistics: true },
      orderBy: { date: 'desc' },
      take: ANALYTICS_RECORD_CAP + 1
    });
    const [records, paymentRows, paymentTrendRows, allTimeRows] = await Promise.all([recordsQuery, prisma.$queryRaw`
      WITH finalized AS (
        SELECT d.id,
          COALESCE(NULLIF(BTRIM(d."partyName"), ''), 'Unspecified party') AS party,
          CASE
            WHEN d.summary->>'netBillableAmount' ~ '^[0-9]+([.][0-9]+)?$'
            THEN (d.summary->>'netBillableAmount')::numeric
            ELSE 0::numeric
          END AS invoice_total
        FROM "Dispatch" d
        WHERE d."organizationId" = ${req.user.organizationId}::uuid
          AND d.status IN ('Dispatched', 'Delivered')
      ),
      payment_totals AS (
        SELECT ip."dispatchId", SUM(ip.amount) AS received
        FROM "InvoicePayment" ip
        WHERE ip."organizationId" = ${req.user.organizationId}::uuid
        GROUP BY ip."dispatchId"
      ),
      paid_invoices AS (
        SELECT f.id, f.party, f.invoice_total
        FROM finalized f
        JOIN payment_totals pt ON pt."dispatchId" = f.id
        WHERE f.invoice_total > 0 AND pt.received >= f.invoice_total
      ),
      party_balances AS (
        SELECT f.party,
          SUM(GREATEST(f.invoice_total - COALESCE(pt.received, 0), 0)) AS outstanding,
          COUNT(*) FILTER (WHERE f.invoice_total > 0 AND COALESCE(pt.received, 0) = 0)::int AS unpaid_invoices,
          COUNT(*) FILTER (WHERE pt.received > 0 AND pt.received < f.invoice_total)::int AS partial_invoices
        FROM finalized f
        LEFT JOIN payment_totals pt ON pt."dispatchId" = f.id
        GROUP BY f.party
      ),
      current_receipts AS (
        SELECT f.party, SUM(ip.amount) AS received
        FROM finalized f
        JOIN "InvoicePayment" ip ON ip."dispatchId" = f.id
        WHERE ip."organizationId" = ${req.user.organizationId}::uuid
          AND (${allTime} OR ip."createdAt" >= ${currentPeriodStart})
          AND ip."createdAt" < ${range.end}
        GROUP BY f.party
      ),
      previous_receipts AS (
        SELECT f.party, SUM(ip.amount) AS received
        FROM finalized f
        JOIN "InvoicePayment" ip ON ip."dispatchId" = f.id
        WHERE ip."organizationId" = ${req.user.organizationId}::uuid
          AND NOT ${allTime}
          AND ip."createdAt" >= ${previousPeriodStart}
          AND ip."createdAt" < ${currentPeriodStart}
        GROUP BY f.party
      ),
      payment_cumulative AS (
        SELECT f.id, f.party, f.invoice_total, ip."createdAt",
          ip.amount,
          SUM(ip.amount) OVER (PARTITION BY f.id ORDER BY ip."createdAt", ip.id) AS cumulative_received
        FROM paid_invoices f
        JOIN "InvoicePayment" ip ON ip."dispatchId" = f.id
        WHERE ip."organizationId" = ${req.user.organizationId}::uuid
          AND f.invoice_total > 0
      ),
      recent_completions AS (
        SELECT party, SUM(invoice_total) AS completed_invoice_total, COUNT(*)::int AS completed_invoices
        FROM payment_cumulative
        WHERE cumulative_received >= invoice_total
          AND cumulative_received - amount < invoice_total
          AND (${allTime} OR "createdAt" >= ${currentPeriodStart})
          AND "createdAt" < ${range.end}
        GROUP BY party
      ),
      party_names AS (
        SELECT party FROM party_balances
        UNION SELECT party FROM current_receipts
        UNION SELECT party FROM previous_receipts
        UNION SELECT party FROM recent_completions
      )
      SELECT n.party,
        COALESCE(cr.received, 0) AS received,
        COALESCE(rc.completed_invoice_total, 0) AS completed_invoice_total,
        COALESCE(rc.completed_invoices, 0) AS completed_invoices,
        COALESCE(pb.outstanding, 0) AS outstanding,
        COALESCE(pb.unpaid_invoices, 0) AS unpaid_invoices,
        COALESCE(pb.partial_invoices, 0) AS partial_invoices,
        COALESCE(pr.received, 0) AS previous_received
      FROM party_names n
      LEFT JOIN current_receipts cr ON cr.party = n.party
      LEFT JOIN recent_completions rc ON rc.party = n.party
      LEFT JOIN party_balances pb ON pb.party = n.party
      LEFT JOIN previous_receipts pr ON pr.party = n.party
      ORDER BY outstanding DESC, received DESC, n.party
    `, prisma.$queryRaw`
      WITH finalized AS (
        SELECT d.id,
          CASE
            WHEN d.summary->>'netBillableAmount' ~ '^[0-9]+([.][0-9]+)?$'
            THEN (d.summary->>'netBillableAmount')::numeric
            ELSE 0::numeric
          END AS invoice_total
        FROM "Dispatch" d
        WHERE d."organizationId" = ${req.user.organizationId}::uuid
          AND d.status IN ('Dispatched', 'Delivered')
      ),
      payment_timeline AS (
        SELECT f.id, f.invoice_total, ip."createdAt" AS occurred_at, ip.amount,
          SUM(ip.amount) OVER (PARTITION BY f.id ORDER BY ip."createdAt", ip.id) AS cumulative_received
        FROM finalized f
        JOIN "InvoicePayment" ip ON ip."dispatchId" = f.id
        WHERE ip."organizationId" = ${req.user.organizationId}::uuid
      ),
      events AS (
        SELECT
          CASE WHEN ${allTime}
            THEN DATE_TRUNC('month', occurred_at + INTERVAL '5 hours 30 minutes')::date
            ELSE (occurred_at + INTERVAL '5 hours 30 minutes')::date
          END AS bucket,
          amount AS received, 0::numeric AS completed_invoice_total, 0::int AS completed_invoices
        FROM payment_timeline
        WHERE (${allTime} OR occurred_at >= ${currentPeriodStart})
          AND occurred_at < ${range.end}
        UNION ALL
        SELECT
          CASE WHEN ${allTime}
            THEN DATE_TRUNC('month', occurred_at + INTERVAL '5 hours 30 minutes')::date
            ELSE (occurred_at + INTERVAL '5 hours 30 minutes')::date
          END AS bucket,
          0::numeric AS received, invoice_total AS completed_invoice_total, 1::int AS completed_invoices
        FROM payment_timeline
        WHERE invoice_total > 0
          AND cumulative_received >= invoice_total
          AND cumulative_received - amount < invoice_total
          AND (${allTime} OR occurred_at >= ${currentPeriodStart})
          AND occurred_at < ${range.end}
      ),
      event_totals AS (
        SELECT bucket, SUM(received) AS received,
          SUM(completed_invoice_total) AS completed_invoice_total,
          SUM(completed_invoices)::int AS completed_invoices
        FROM events
        GROUP BY bucket
      ),
      first_bucket AS (
        SELECT MIN(bucket) AS value FROM event_totals
      ),
      calendar AS (
        SELECT GENERATE_SERIES(
          CASE WHEN ${allTime} THEN first_bucket.value ELSE TO_DATE(${range.from}, 'YYYY-MM-DD') END,
          CASE WHEN ${allTime}
            THEN DATE_TRUNC('month', TO_DATE(${range.to}, 'YYYY-MM-DD'))::date
            ELSE TO_DATE(${range.to}, 'YYYY-MM-DD')
          END,
          CASE WHEN ${allTime} THEN INTERVAL '1 month' ELSE INTERVAL '1 day' END
        )::date AS bucket
        FROM first_bucket
        WHERE NOT ${allTime} OR first_bucket.value IS NOT NULL
      )
      SELECT TO_CHAR(calendar.bucket, 'YYYY-MM-DD') AS date,
        COALESCE(event_totals.received, 0) AS received,
        COALESCE(event_totals.completed_invoice_total, 0) AS completed_invoice_total,
        COALESCE(event_totals.completed_invoices, 0) AS completed_invoices
      FROM calendar
      LEFT JOIN event_totals USING (bucket)
      ORDER BY calendar.bucket
    `, allTime ? prisma.$queryRaw`
      WITH source AS (
        SELECT d.date, d.status,
          BTRIM(d.logistics->>'buyerDestination') AS destination,
          CASE WHEN d.summary->>'netBillableAmount' ~ '^[0-9]+([.][0-9]+)?$' THEN (d.summary->>'netBillableAmount')::numeric END AS billed,
          CASE WHEN d.summary->>'totalDispatchVolumeSqFt' ~ '^[0-9]+([.][0-9]+)?$' THEN (d.summary->>'totalDispatchVolumeSqFt')::numeric END AS area,
          CASE WHEN d.summary->>'totalPieces' ~ '^[0-9]+([.][0-9]+)?$' THEN (d.summary->>'totalPieces')::numeric END AS pieces
        FROM "Dispatch" d
        WHERE d."organizationId" = ${req.user.organizationId}::uuid
          AND d.date < ${range.end}
      ),
      parsed AS (
        SELECT *, status IN ('Dispatched', 'Delivered') AS finalized,
          billed IS NOT NULL AND area IS NOT NULL AND pieces IS NOT NULL AS readable
        FROM source
      ),
      destinations AS (
        SELECT (ARRAY_AGG(destination ORDER BY date DESC))[1] AS name,
          SUM(billed) AS billed, COUNT(*)::int AS loads
        FROM parsed
        WHERE finalized AND readable AND destination <> ''
        GROUP BY LOWER(destination)
        ORDER BY billed DESC, name
        LIMIT 3
      ),
      months AS (
        SELECT DATE_TRUNC('month', date + INTERVAL '5 hours 30 minutes')::date AS month,
          SUM(billed) AS billed, COUNT(*)::int AS loads
        FROM parsed
        WHERE finalized AND readable
        GROUP BY 1
      ),
      month_range AS (
        SELECT MIN(DATE_TRUNC('month', date + INTERVAL '5 hours 30 minutes')) AS first_month
        FROM parsed
      ),
      calendar_months AS (
        SELECT GENERATE_SERIES(first_month, DATE_TRUNC('month', TO_DATE(${range.to}, 'YYYY-MM-DD')), INTERVAL '1 month')::date AS month
        FROM month_range
        WHERE first_month IS NOT NULL
      )
      SELECT
        COUNT(*) FILTER (WHERE status = 'Draft')::int AS drafts,
        COUNT(*) FILTER (WHERE status = 'Dispatched')::int AS dispatched,
        COUNT(*) FILTER (WHERE status = 'Delivered')::int AS delivered,
        COUNT(*) FILTER (WHERE finalized AND readable)::int AS finalized_loads,
        COALESCE(SUM(billed) FILTER (WHERE finalized AND readable), 0)::float8 AS billed,
        COALESCE(SUM(area) FILTER (WHERE finalized AND readable), 0)::float8 AS area_sq_ft,
        COALESCE(SUM(pieces) FILTER (WHERE finalized AND readable), 0)::float8 AS pieces,
        COUNT(*) FILTER (WHERE finalized AND NOT readable)::int AS unreadable,
        COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
          'date', TO_CHAR(calendar_months.month, 'YYYY-MM-DD'),
          'billed', COALESCE(months.billed, 0), 'loads', COALESCE(months.loads, 0)
        ) ORDER BY calendar_months.month)
        FROM calendar_months LEFT JOIN months USING (month)), '[]'::jsonb) AS trend,
        COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
          'name', name, 'billed', billed, 'loads', loads
        ) ORDER BY billed DESC, name) FROM destinations), '[]'::jsonb) AS top_destinations
      FROM parsed
    ` : Promise.resolve([])]);
    if (records.length > ANALYTICS_RECORD_CAP) calc.bad('Too many records to analyse');
    const parties = paymentRows.map(row => ({
      party: row.party,
      received: round2(Number(row.received)),
      completedInvoiceTotal: round2(Number(row.completed_invoice_total)),
      completedInvoices: Number(row.completed_invoices),
      outstanding: round2(Number(row.outstanding)),
      unpaidInvoices: Number(row.unpaid_invoices),
      partialInvoices: Number(row.partial_invoices)
    })).filter(party => party.received || party.completedInvoices || party.outstanding);
    const paymentTotals = parties.reduce((totals, party) => {
      for (const key of Object.keys(totals)) totals[key] += party[key];
      return totals;
    }, { received: 0, completedInvoiceTotal: 0, completedInvoices: 0, outstanding: 0, unpaidInvoices: 0, partialInvoices: 0 });
    paymentTotals.received = round2(paymentTotals.received);
    paymentTotals.completedInvoiceTotal = round2(paymentTotals.completedInvoiceTotal);
    paymentTotals.outstanding = round2(paymentTotals.outstanding);
    const aggregate = allTimeRows[0];
    const analytics = allTime
      ? {
          period: { from: null, to: range.to, days: null, granularity: 'month', timezone: 'Asia/Kolkata', dateBasis: 'dispatchDate' },
          comparison: null,
          statusCounts: {
            Draft: Number(aggregate.drafts),
            Dispatched: Number(aggregate.dispatched),
            Delivered: Number(aggregate.delivered)
          },
          current: {
            finalizedLoads: Number(aggregate.finalized_loads),
            billed: round2(Number(aggregate.billed)),
            areaSqFt: round2(Number(aggregate.area_sq_ft)),
            pieces: round2(Number(aggregate.pieces)),
            averageBilled: aggregate.finalized_loads ? round2(Number(aggregate.billed) / Number(aggregate.finalized_loads)) : 0
          },
          previous: { finalizedLoads: 0, billed: 0, areaSqFt: 0, pieces: 0, averageBilled: 0 },
          trend: aggregate.trend.map(point => ({ ...point, billed: round2(Number(point.billed)), loads: Number(point.loads) })),
          topDestinations: aggregate.top_destinations.map(item => ({ ...item, billed: round2(Number(item.billed)), loads: Number(item.loads) })),
          unreadable: Number(aggregate.unreadable)
        }
      : buildAnalytics(records, now, period);
    res.json({
      ...analytics,
      paymentAnalytics: {
        period: { from: range.from, to: range.to, days: allTime ? null : Number(period), timezone: 'Asia/Kolkata' },
        current: paymentTotals,
        previous: { received: round2(paymentRows.reduce((sum, row) => sum + Number(row.previous_received), 0)) },
        trend: paymentTrendRows.map(point => ({
          date: point.date,
          received: round2(Number(point.received)),
          completedInvoiceTotal: round2(Number(point.completed_invoice_total)),
          completedInvoices: Number(point.completed_invoices)
        })),
        parties
      }
    });
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
