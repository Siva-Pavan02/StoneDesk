const { randomUUID } = require("node:crypto");
const { Prisma } = require("@prisma/client");
const prisma = require("../utils/prisma");
const calc = require("../utils/pilotCalculations");
const { invoiceTotalDecimal, validateInvoiceMoney } = require("../utils/invoiceMoney");
const { paidCompletion } = require("../utils/paymentCompletion");
const { round2 } = require("../utils/dispatchCalculations");
const { snapshot } = require("../utils/businessBranding");
const {
  buildAnalytics,
  istDay,
  windows,
  ANALYTICS_PERIODS,
} = require("../utils/dispatchAnalytics");
const { auditLog } = require("../utils/auditLog");
const {
  STATUS_TARGETS,
  statusTransitionError,
} = require("../utils/dispatchStatus");
const { rememberDispatchReferences } = require("../utils/savedReferences");

// Kept small to bound the analytics heap; the larger DB-side aggregation rewrite is deliberately deferred.
const ANALYTICS_RECORD_CAP = 5000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

function paymentStatus(total, received) {
  if (total.isZero() || received.greaterThanOrEqualTo(total)) return 'PAID';
  if (received.greaterThan(0)) return 'PARTIALLY_PAID';
  return 'PAYMENT_DUE';
}

function details(body) {
  const supervisor = calc.text(body.supervisor, "manager");
  const logistics = {
    truckNumber: calc
      .text(body.logistics?.truckNumber, "truck number", 40)
      .toUpperCase(),
    buyerDestination: calc.text(
      body.logistics?.buyerDestination,
      "destination",
      200,
    ),
  };
  if (
    body.date !== undefined &&
    !(body.date instanceof Date) &&
    (typeof body.date !== "string" || !body.date.trim())
  )
    calc.bad("Invalid date");
  const date = body.date === undefined ? new Date() : new Date(body.date);
  if (!Number.isFinite(date.getTime())) calc.bad("Invalid date");
  const isPilot =
    Array.isArray(body.inventory) &&
    body.inventory.some((g) => g?.measurementRows?.length);
  const partyName =
    isPilot || body.partyName !== undefined
      ? calc.text(body.partyName, "party name")
      : undefined;
  return { supervisor, logistics, date, partyName };
}

exports.createDraft = async (req, res, next) => {
  try {
    const clientRequestId = req.body.clientRequestId;
    if (
      clientRequestId !== undefined &&
      (typeof clientRequestId !== "string" ||
        !/^[a-zA-Z0-9-]{8,80}$/.test(clientRequestId))
    )
      calc.bad("Invalid request ID");
    // Parallelize: check for existing dispatch + fetch settings simultaneously
    const [existing, settings] = await Promise.all([
      clientRequestId
        ? prisma.dispatch.findFirst({
            where: { clientRequestId, organizationId: req.user.organizationId },
          })
        : null,
      prisma.masterSettings.findUnique({
        where: { id: req.user.organizationId },
        select: {
          businessName: true,
          stoneRates: true,
          defaultRoyaltyFee: true,
        },
      }),
    ]);
    if (existing) return res.json(existing);
    const metadata = details(req.body);
    const inventory = calc.processInventory(req.body.inventory);
    if (
      inventory.some((g) => g.measurementRows.length) &&
      (!settings?.businessName ||
        !settings.stoneRates ||
        !settings.stoneRates.length)
    )
      calc.bad("Set up business and at least one product first");
    const fee =
      req.body.loadingAndRoyaltyFees ?? settings?.defaultRoyaltyFee ?? 0;
    const dispatch = await prisma.dispatch.create({
      data: {
        organizationId: req.user.organizationId,
        ...metadata,
        inventory,
        ...(clientRequestId ? { clientRequestId } : {}),
        dispatchSlipNumber: `GS-${randomUUID()}`,
        summary: calc.totals(inventory, fee),
        status: "Draft",
      },
    });
    // Remembers truck/destination as suggestions; never fails the save.
    await rememberDispatchReferences(
      prisma,
      req.user.organizationId,
      dispatch.logistics,
    );
    res.json(dispatch);
  } catch (err) {
    if (err.code === "P2002" && req.body.clientRequestId) {
      try {
        const existing = await prisma.dispatch.findFirst({
          where: {
            clientRequestId: req.body.clientRequestId,
            organizationId: req.user.organizationId,
          },
        });
        if (existing) return res.json(existing);
      } catch (lookupError) {
        return next(lookupError);
      }
    }
    next(err);
  }
};

exports.updateDraft = async (req, res, next) => {
  try {
    const dispatch = await prisma.dispatch.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!dispatch) return res.status(404).json({ error: "Not found" });
    if (dispatch.status !== "Draft")
      return res.status(400).json({ error: "Only Draft can be modified" });
    const merged = { ...dispatch, ...req.body };
    if (dispatch.partyName === null && !Object.hasOwn(req.body, "partyName"))
      delete merged.partyName;
    const metadata = details(merged);
    const inventory = calc.processInventory(merged.inventory);
    const fee =
      req.body.loadingAndRoyaltyFees ?? dispatch.summary.loadingAndRoyaltyFees;

    const updateResult = await prisma.dispatch.updateMany({
      where: {
        id: dispatch.id,
        organizationId: req.user.organizationId,
        status: "Draft",
        updatedAt: dispatch.updatedAt,
      },
      data: { ...metadata, inventory, summary: calc.totals(inventory, fee) },
    });
    if (updateResult.count === 0)
      return res
        .status(409)
        .json({ error: "Load changed. Refresh and try again." });
    await rememberDispatchReferences(
      prisma,
      req.user.organizationId,
      metadata.logistics,
    );

    res.json(
      await prisma.dispatch.findFirst({
        where: { id: dispatch.id, organizationId: req.user.organizationId },
      }),
    );
  } catch (err) {
    next(err);
  }
};

exports.finalizeDispatch = async (req, res, next) => {
  try {
    if (!UUID_REGEX.test(req.params.id))
      return res.status(404).json({ error: "Not found" });
    // Parallelize: fetch dispatch and settings simultaneously
    const [dispatch, settings] = await Promise.all([
      prisma.dispatch.findFirst({
        where: { id: req.params.id, organizationId: req.user.organizationId },
      }),
      prisma.masterSettings.findUnique({
        where: { id: req.user.organizationId },
        select: {
          businessName: true,
          address: true,
          phone: true,
          bankDetails: true,
          logoPath: true,
        },
      }),
    ]);
    if (!dispatch) return res.status(404).json({ error: "Not found" });
    if (dispatch.status !== "Draft") return res.json(dispatch);
    const businessSnapshot = await snapshot(settings, req.user.organizationId);
    const result = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw`
        SELECT id FROM "Dispatch"
        WHERE id = ${dispatch.id}::uuid
          AND "organizationId" = ${req.user.organizationId}::uuid
        FOR UPDATE
      `;
      if (!locked) throw requestError(404, "Not found");
      const current = await tx.dispatch.findFirst({
        where: { id: dispatch.id, organizationId: req.user.organizationId },
      });
      if (current.status !== "Draft") return { record: current, changed: false };
      if (current.updatedAt.getTime() !== dispatch.updatedAt.getTime())
        throw requestError(409, "Load changed. Refresh and try again.");

      const inventory = calc.processInventory(current.inventory);
      const summary = calc.totals(inventory, current.summary.loadingAndRoyaltyFees);
      const [{ at }] = await tx.$queryRaw`SELECT clock_timestamp() AS at`;
      const effectiveAt = at.toISOString();
      const stampedSummary = { ...summary, issuedAt: effectiveAt, effectiveAt };
      const updated = await tx.dispatch.updateMany({
        where: {
          id: current.id,
          organizationId: req.user.organizationId,
          status: "Draft",
          updatedAt: current.updatedAt,
        },
        data: { inventory, summary: stampedSummary, businessSnapshot, status: "Dispatched" },
      });
      if (!updated.count) throw requestError(409, "Load changed. Refresh and try again.");
      return {
        changed: true,
        record: await tx.dispatch.findFirst({
          where: { id: current.id, organizationId: req.user.organizationId },
        }),
      };
    });
    if (result.changed)
      await rememberDispatchReferences(
        prisma,
        req.user.organizationId,
        result.record.logistics,
      );
    res.json(result.record);
  } catch (err) {
    next(err);
  }
};

const FINALIZED_STATUSES = ["Dispatched", "Delivered"];

exports.reviseDispatch = async (req, res, next) => {
  try {
    const id = req.params.id;
    const organizationId = req.user.organizationId;
    if (!UUID_REGEX.test(id)) return res.status(404).json({ error: "Not found" });
    const token = req.body?.updatedAt;
    if (typeof token !== "string" || !Number.isFinite(Date.parse(token)) || new Date(token).toISOString() !== token)
      return res.status(400).json({ error: "A valid updatedAt is required. Refresh and try again." });
    const { updatedAt: _clientUpdatedAt, ...body } = req.body;
    const result = await prisma.$transaction(async (tx) => {
      // Payment creation takes the same lock before checking the balance.
      const [locked] = await tx.$queryRaw`
        SELECT id FROM "Dispatch"
        WHERE id = ${id}::uuid
          AND "organizationId" = ${organizationId}::uuid
        FOR UPDATE
      `;
      if (!locked) throw requestError(404, "Not found");
      const dispatch = await tx.dispatch.findFirst({ where: { id, organizationId } });
      if (!FINALIZED_STATUSES.includes(dispatch.status))
        throw requestError(409, "Only a finalized invoice can be revised.");
      if (dispatch.updatedAt.getTime() !== new Date(token).getTime())
        throw requestError(409, "Load changed. Refresh and try again.");

      const merged = { ...dispatch, ...body };
      if (dispatch.partyName === null && !Object.hasOwn(body, "partyName"))
        delete merged.partyName;
      const metadata = details(merged);
      const inventory = calc.processInventory(merged.inventory);
      const fee = body.loadingAndRoyaltyFees ?? dispatch.summary?.loadingAndRoyaltyFees;
      const summary = calc.totals(inventory, fee);
      const currentTotal = invoiceTotalDecimal(dispatch.summary);
      const newTotal = invoiceTotalDecimal(summary);
      const paymentTotal = await tx.invoicePayment.aggregate({
        where: { dispatchId: id, organizationId },
        _sum: { amount: true },
      });
      const received = paymentTotal._sum.amount || new Prisma.Decimal(0);
      if (newTotal.lessThan(received))
        throw requestError(409, "Invoice total cannot be below recorded payments.");

      const [{ at }] = await tx.$queryRaw`SELECT clock_timestamp() AS at`;
      const revisedAt = at.toISOString();
      const stampedSummary = {
        ...summary,
        ...(dispatch.summary?.issuedAt ? { issuedAt: dispatch.summary.issuedAt } : {}),
        effectiveAt: revisedAt,
      };
      // Preserve the prior issued version. Branding stays on the invoice itself.
      const revisionSnapshot = {
        inventory: dispatch.inventory,
        summary: dispatch.summary,
        logistics: dispatch.logistics,
        supervisor: dispatch.supervisor,
        partyName: dispatch.partyName,
        date: dispatch.date,
        revisedAt,
        revisedByUserId: req.user.id,
        priorTotal: Number(currentTotal.toFixed(2)),
        resultingTotal: Number(newTotal.toFixed(2)),
        paymentStatusBefore: paymentStatus(currentTotal, received),
        paymentStatusAfter: paymentStatus(newTotal, received),
      };
      const revisions = [
        ...(Array.isArray(dispatch.revisions) ? dispatch.revisions : []),
        revisionSnapshot,
      ];
      const updated = await tx.dispatch.updateMany({
        where: {
          id,
          organizationId,
          status: { in: FINALIZED_STATUSES },
          updatedAt: dispatch.updatedAt,
        },
        data: { ...metadata, inventory, summary: stampedSummary, revisions },
      });
      if (!updated.count) throw requestError(409, "Load changed. Refresh and try again.");
      return {
        metadata,
        record: await tx.dispatch.findFirst({ where: { id, organizationId } }),
      };
    });
    await rememberDispatchReferences(
      prisma,
      organizationId,
      result.metadata.logistics,
    );

    await auditLog("dispatch.update", req, { dispatchId: id });
    res.json(result.record);
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const to = req.body.status;
    if (typeof to !== "string" || !STATUS_TARGETS.includes(to))
      return res.status(400).json({ error: "Invalid status transition" });
    const id = req.params.id;
    const organizationId = req.user.organizationId;
    const dispatch = await prisma.dispatch.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, updatedAt: true },
    });
    if (!dispatch) return res.status(404).json({ error: "Not found" });

    // Same stale-read check as reviseDispatch.
    if (req.body.updatedAt !== undefined) {
      const clientTime = new Date(req.body.updatedAt).getTime();
      if (clientTime !== new Date(dispatch.updatedAt).getTime())
        return res
          .status(409)
          .json({ error: "Load changed. Refresh and try again." });
    }

    // Delivered -> Dispatched is Admin only; rules live in utils/dispatchStatus.js.
    const rejected = statusTransitionError(dispatch.status, to, req.user.role);
    if (rejected)
      return res.status(rejected.status).json({ error: rejected.error });

    const updateResult = await prisma.dispatch.updateMany({
      where: {
        id,
        organizationId,
        status: dispatch.status,
        updatedAt: dispatch.updatedAt,
      },
      data: { status: to },
    });
    if (updateResult.count === 0)
      return res
        .status(409)
        .json({ error: "Load changed. Refresh and try again." });

    await auditLog("dispatch.deliver", req, {
      dispatchId: id,
      from: dispatch.status,
      to,
    });
    res.json(
      await prisma.dispatch.findFirst({ where: { id, organizationId } }),
    );
  } catch (err) {
    next(err);
  }
};

exports.deleteDispatch = async (req, res, next) => {
  try {
    const id = req.params.id;
    const organizationId = req.user.organizationId;
    if (!UUID_REGEX.test(id)) return res.status(404).json({ error: "Not found" });
    const deletedStatus = await prisma.$transaction(async (tx) => {
      // Payment creation and revision take this same dispatch lock.
      const [locked] = await tx.$queryRaw`
        SELECT id FROM "Dispatch"
        WHERE id = ${id}::uuid
          AND "organizationId" = ${organizationId}::uuid
        FOR UPDATE
      `;
      if (!locked) throw requestError(404, "Not found");
      const dispatch = await tx.dispatch.findFirst({
        where: { id, organizationId },
        select: { id: true, status: true },
      });
      const isAdmin = req.user.role === "Admin";
      if (dispatch.status !== "Draft" && !isAdmin)
        throw requestError(403, "Your role does not allow this action");
      if (await tx.invoicePayment.count({ where: { dispatchId: id, organizationId } }))
        throw requestError(409, "Invoices with recorded payments cannot be deleted.");

      const removed = await tx.dispatch.deleteMany({
        where: {
          id,
          organizationId,
          ...(!isAdmin ? { status: "Draft" } : {}),
        },
      });
      if (!removed.count) throw requestError(409, "Load changed. Refresh and try again.");
      return dispatch.status;
    });
    await auditLog("dispatch.delete", req, {
      dispatchId: id,
      status: deletedStatus,
      paymentsRemoved: 0,
    });
    res.json({ ok: true, id, paymentsRemoved: 0 });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const dispatch = await prisma.dispatch.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!dispatch) return res.status(404).json({ error: "Not found" });
    validateInvoiceMoney(dispatch.summary, dispatch.inventory);
    res.json(dispatch);
  } catch (err) {
    next(err);
  }
};

exports.getBySlip = async (req, res, next) => {
  try {
    const dispatch = await prisma.dispatch.findFirst({
      where: {
        dispatchSlipNumber: req.params.dispatchSlipNumber,
        organizationId: req.user.organizationId,
      },
    });
    if (!dispatch) return res.status(404).json({ error: "Not found" });
    validateInvoiceMoney(dispatch.summary, dispatch.inventory);
    res.json(dispatch);
  } catch (err) {
    next(err);
  }
};

exports.statusCounts = async (req, res, next) => {
  try {
    const period = req.query.period ?? 'today';
    if (period !== 'today' && period !== 'all') calc.bad('Invalid load status period');
    const range = windows(new Date(), 1);
    const organizationId = req.user.organizationId;
    const [rows, totalDrafts] = await Promise.all([
      prisma.dispatch.groupBy({
        by: ['status'],
        where: {
          organizationId,
          date: { ...(period === 'today' ? { gte: range.currentStart } : {}), lt: range.end },
        },
        _count: { _all: true },
      }),
      prisma.dispatch.count({ where: { organizationId, status: 'Draft' } }),
    ]);
    const statusCounts = { Draft: 0, Dispatched: 0, Delivered: 0 };
    for (const row of rows) statusCounts[row.status] = row._count._all;
    res.json({ period, today: range.to, statusCounts, totalDrafts });
  } catch (err) { next(err); }
};

exports.analytics = async (req, res, next) => {
  try {
    const now = new Date();
    const period = req.query.period ?? "3";
    if (typeof period !== "string" || !ANALYTICS_PERIODS.has(period))
      calc.bad("Invalid analytics period");
    const allTime = period === "all";
    const range = windows(now, allTime ? null : Number(period));
    const todayRange = windows(now, 1);
    const currentPeriodStart = range.currentStart || range.end;
    const previousPeriodStart = range.start || range.end;
    const recordsQuery = allTime
      ? Promise.resolve([])
      : prisma.dispatch.findMany({
          where: {
            organizationId: req.user.organizationId,
            date: { gte: range.start, lt: range.end },
          },
          select: { date: true, status: true, summary: true, logistics: true },
          orderBy: { date: "desc" },
          take: ANALYTICS_RECORD_CAP + 1,
        });
    const [records, paymentRows, paymentTrendRows, allTimeRows, todayStatusRows, completionRows, invalidMoneyRows] =
      await Promise.all([
        recordsQuery,
        prisma.$queryRaw`
      WITH finalized AS (
        SELECT d.id,
          COALESCE(NULLIF(BTRIM(d."partyName"), ''), 'Unspecified party') AS party,
          CASE
            WHEN d.summary->>'netBillableAmount' ~ '^[0-9]+([.][0-9]+)?$'
            THEN ROUND((d.summary->>'netBillableAmount')::numeric, 2)
            ELSE 0::numeric
          END AS invoice_total
        FROM "Dispatch" d
        WHERE d."organizationId" = ${req.user.organizationId}::uuid
          AND d.status IN ('Dispatched', 'Delivered')
          AND d.date < ${range.end}
      ), payment_sources AS (
        SELECT d.id,
          COALESCE(NULLIF(BTRIM(d."partyName"), ''), 'Unspecified party') AS party
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
      party_balances AS (
        SELECT f.party,
          SUM(f.invoice_total) AS billed,
          SUM(GREATEST(f.invoice_total - COALESCE(pt.received, 0), 0)) AS outstanding,
          COUNT(*) FILTER (WHERE f.invoice_total > 0 AND COALESCE(pt.received, 0) = 0)::int AS unpaid_invoices,
          COUNT(*) FILTER (WHERE pt.received > 0 AND pt.received < f.invoice_total)::int AS partial_invoices
        FROM finalized f
        LEFT JOIN payment_totals pt ON pt."dispatchId" = f.id
        GROUP BY f.party
      ),
      current_receipts AS (
        SELECT f.party, SUM(ip.amount) AS received
        FROM payment_sources f
        JOIN "InvoicePayment" ip ON ip."dispatchId" = f.id
        WHERE ip."organizationId" = ${req.user.organizationId}::uuid
          AND (${allTime} OR ip."createdAt" >= ${currentPeriodStart})
          AND ip."createdAt" < ${range.end}
        GROUP BY f.party
      ),
      previous_receipts AS (
        SELECT f.party, SUM(ip.amount) AS received
        FROM payment_sources f
        JOIN "InvoicePayment" ip ON ip."dispatchId" = f.id
        WHERE ip."organizationId" = ${req.user.organizationId}::uuid
          AND NOT ${allTime}
          AND ip."createdAt" >= ${previousPeriodStart}
          AND ip."createdAt" < ${currentPeriodStart}
        GROUP BY f.party
      ),
      party_names AS (
        SELECT party FROM party_balances
        UNION SELECT party FROM current_receipts
        UNION SELECT party FROM previous_receipts
      )
      SELECT n.party,
        COALESCE(cr.received, 0) AS received,
        COALESCE(pb.billed, 0) AS billed,
        COALESCE(pb.outstanding, 0) AS outstanding,
        COALESCE(pb.unpaid_invoices, 0) AS unpaid_invoices,
        COALESCE(pb.partial_invoices, 0) AS partial_invoices,
        COALESCE(pr.received, 0) AS previous_received
      FROM party_names n
      LEFT JOIN current_receipts cr ON cr.party = n.party
      LEFT JOIN party_balances pb ON pb.party = n.party
      LEFT JOIN previous_receipts pr ON pr.party = n.party
      ORDER BY outstanding DESC, received DESC, n.party
    `,
        prisma.$queryRaw`
      WITH events AS (
        SELECT
          CASE WHEN ${allTime}
            THEN DATE_TRUNC('month', ip."createdAt" + INTERVAL '5 hours 30 minutes')::date
            ELSE (ip."createdAt" + INTERVAL '5 hours 30 minutes')::date
          END AS bucket,
          ip.amount AS received
        FROM "InvoicePayment" ip
        JOIN "Dispatch" d ON d.id = ip."dispatchId"
        WHERE ip."organizationId" = ${req.user.organizationId}::uuid
          AND d."organizationId" = ${req.user.organizationId}::uuid
          AND d.status IN ('Dispatched', 'Delivered')
          AND (${allTime} OR ip."createdAt" >= ${currentPeriodStart})
          AND ip."createdAt" < ${range.end}
      ),
      event_totals AS (
        SELECT bucket, SUM(received) AS received
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
        COALESCE(event_totals.received, 0) AS received
      FROM calendar
      LEFT JOIN event_totals USING (bucket)
      ORDER BY calendar.bucket
    `,
        allTime
          ? prisma.$queryRaw`
      WITH source AS (
        SELECT d.date, d.status,
          BTRIM(d.logistics->>'buyerDestination') AS destination,
          CASE WHEN d.summary->>'netBillableAmount' ~ '^[0-9]+([.][0-9]+)?$' THEN ROUND((d.summary->>'netBillableAmount')::numeric, 2) END AS billed,
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
    `
          : Promise.resolve([]),
        allTime
          ? prisma.dispatch.groupBy({
              by: ["status"],
              where: {
                organizationId: req.user.organizationId,
                date: { gte: todayRange.currentStart, lt: todayRange.end },
              },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        prisma.$queryRaw`
          SELECT d.id, d.date, d.summary, d.revisions,
            COALESCE(NULLIF(BTRIM(d."partyName"), ''), 'Unspecified party') AS party,
            JSONB_AGG(JSONB_BUILD_OBJECT(
              'id', ip.id, 'amount', ip.amount::text, 'createdAt', ip."createdAt"
            ) ORDER BY ip."createdAt", ip.id) AS payments
          FROM "Dispatch" d
          JOIN "InvoicePayment" ip ON ip."dispatchId" = d.id
            AND ip."organizationId" = ${req.user.organizationId}::uuid
          WHERE d."organizationId" = ${req.user.organizationId}::uuid
            AND d.status IN ('Dispatched', 'Delivered')
            AND d.date < ${range.end}
            AND d.summary->>'netBillableAmount' ~ '^[0-9]+([.][0-9]+)?$'
          GROUP BY d.id
          HAVING ROUND((d.summary->>'netBillableAmount')::numeric, 2) > 0
            AND SUM(ip.amount) >= ROUND((d.summary->>'netBillableAmount')::numeric, 2)
        `,
        prisma.$queryRaw`
          SELECT d.id FROM "Dispatch" d
          WHERE d."organizationId" = ${req.user.organizationId}::uuid
            AND d.status IN ('Dispatched', 'Delivered')
            AND d.date < ${range.end}
            AND d.summary->>'calculationVersion' = '2'
            AND CASE
              WHEN jsonb_typeof(d.summary->'baseMaterialTotal') IS DISTINCT FROM 'number'
                OR jsonb_typeof(d.summary->'loadingAndRoyaltyFees') IS DISTINCT FROM 'number'
                OR jsonb_typeof(d.summary->'netBillableAmount') IS DISTINCT FROM 'number'
                THEN true
              WHEN d.summary->>'baseMaterialTotal' !~ '^(0|[1-9][0-9]*)([.][0-9]{1,2})?$'
                OR d.summary->>'loadingAndRoyaltyFees' !~ '^(0|[1-9][0-9]*)([.][0-9]{1,2})?$'
                OR d.summary->>'netBillableAmount' !~ '^(0|[1-9][0-9]*)([.][0-9]{1,2})?$'
                THEN true
              ELSE (d.summary->>'baseMaterialTotal')::numeric > 9999999999.99
                OR (d.summary->>'loadingAndRoyaltyFees')::numeric > 9999999999.99
                OR (d.summary->>'netBillableAmount')::numeric > 9999999999.99
                OR (d.summary->>'baseMaterialTotal')::numeric +
                   (d.summary->>'loadingAndRoyaltyFees')::numeric <>
                   (d.summary->>'netBillableAmount')::numeric
            END
          LIMIT 1
        `,
      ]);
    if (invalidMoneyRows.length) {
      console.error('Invoice analytics rejected invalid version-2 summary', invalidMoneyRows[0].id);
      throw requestError(500, 'Invoice totals need review.');
    }
    if (records.length > ANALYTICS_RECORD_CAP)
      calc.bad("Too many records to analyse");
    const completionByParty = new Map();
    const completionByBucket = new Map();
    let excludedCompletionCount = 0;
    for (const row of completionRows) {
      const result = paidCompletion(row, row.payments);
      if (result.excluded) {
        excludedCompletionCount += 1;
        continue;
      }
      if (!result.event || result.event >= range.end ||
          (!allTime && result.event < currentPeriodStart)) continue;
      const party = completionByParty.get(row.party) || { total: new Prisma.Decimal(0), count: 0 };
      party.total = party.total.plus(invoiceTotalDecimal(row.summary));
      party.count += 1;
      completionByParty.set(row.party, party);
      const day = istDay(result.event);
      const bucket = allTime ? `${day.slice(0, 7)}-01` : day;
      const point = completionByBucket.get(bucket) || { total: new Prisma.Decimal(0), count: 0 };
      point.total = point.total.plus(invoiceTotalDecimal(row.summary));
      point.count += 1;
      completionByBucket.set(bucket, point);
    }
    const parties = paymentRows
      .map((row) => ({
        party: row.party,
        billed: round2(Number(row.billed)),
        received: round2(Number(row.received)),
        completedInvoiceTotal: 0,
        completedInvoices: 0,
        outstanding: round2(Number(row.outstanding)),
        unpaidInvoices: Number(row.unpaid_invoices),
        partialInvoices: Number(row.partial_invoices),
      }))
      .filter(
        (party) =>
          party.received || party.outstanding || completionByParty.has(party.party),
      );
    for (const [name, completion] of completionByParty) {
      let party = parties.find(item => item.party === name);
      if (!party) {
        party = { party: name, billed: 0, received: 0, outstanding: 0,
          unpaidInvoices: 0, partialInvoices: 0, completedInvoiceTotal: 0, completedInvoices: 0 };
        parties.push(party);
      }
      party.completedInvoiceTotal = Number(completion.total.toFixed(2));
      party.completedInvoices = completion.count;
    }
    const paymentTotals = parties.reduce(
      (totals, party) => {
        for (const key of Object.keys(totals)) totals[key] += party[key];
        return totals;
      },
      {
        received: 0,
        completedInvoiceTotal: 0,
        completedInvoices: 0,
        outstanding: 0,
        unpaidInvoices: 0,
        partialInvoices: 0,
      },
    );
    paymentTotals.received = round2(paymentTotals.received);
    paymentTotals.completedInvoiceTotal = round2(
      paymentTotals.completedInvoiceTotal,
    );
    paymentTotals.outstanding = round2(paymentTotals.outstanding);
    const aggregate = allTimeRows[0];
    const todayStatusCounts = { Draft: 0, Dispatched: 0, Delivered: 0 };
    for (const row of todayStatusRows) todayStatusCounts[row.status] = row._count._all;
    const analytics = allTime
      ? {
          period: {
            from: null,
            to: range.to,
            days: null,
            granularity: "month",
            timezone: "Asia/Kolkata",
            dateBasis: "dispatchDate",
          },
          comparison: null,
          statusCounts: {
            Draft: Number(aggregate.drafts),
            Dispatched: Number(aggregate.dispatched),
            Delivered: Number(aggregate.delivered),
          },
          todayStatusCounts,
          current: {
            finalizedLoads: Number(aggregate.finalized_loads),
            billed: round2(Number(aggregate.billed)),
            areaSqFt: round2(Number(aggregate.area_sq_ft)),
            pieces: round2(Number(aggregate.pieces)),
            averageBilled: aggregate.finalized_loads
              ? round2(
                  Number(aggregate.billed) / Number(aggregate.finalized_loads),
                )
              : 0,
          },
          previous: {
            finalizedLoads: 0,
            billed: 0,
            areaSqFt: 0,
            pieces: 0,
            averageBilled: 0,
          },
          trend: aggregate.trend.map((point) => ({
            ...point,
            billed: round2(Number(point.billed)),
            loads: Number(point.loads),
          })),
          topDestinations: aggregate.top_destinations.map((item) => ({
            ...item,
            billed: round2(Number(item.billed)),
            loads: Number(item.loads),
          })),
          unreadable: Number(aggregate.unreadable),
        }
      : buildAnalytics(records, now, period);
    res.json({
      ...analytics,
      todayStatusCounts: analytics.todayStatusCounts || todayStatusCounts,
      paymentAnalytics: {
        period: {
          from: range.from,
          to: range.to,
          days: allTime ? null : Number(period),
          timezone: "Asia/Kolkata",
        },
        current: paymentTotals,
        previous: {
          received: round2(
            paymentRows.reduce(
              (sum, row) => sum + Number(row.previous_received),
              0,
            ),
          ),
        },
        trend: paymentTrendRows.map((point) => ({
          date: point.date,
          received: round2(Number(point.received)),
          completedInvoiceTotal: Number((completionByBucket.get(point.date)?.total || new Prisma.Decimal(0)).toFixed(2)),
          completedInvoices: completionByBucket.get(point.date)?.count || 0,
        })),
        parties,
        excludedCompletionCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

const LIST_FIELDS = {
  id: true,
  dispatchSlipNumber: true,
  date: true,
  supervisor: true,
  partyName: true,
  logistics: true,
  status: true,
  summary: true,
  createdAt: true,
  updatedAt: true,
};
const MAX_LIST_LIMIT = 50;
const DEFAULT_LIST_LIMIT = 20;

// Cursor order is stable even when a payment settles an invoice between pages.
exports.receivables = async (req, res, next) => {
  try {
    const party = req.query.party;
    if (typeof party !== "string" || !party.trim() || party.length > 120)
      calc.bad("Invalid party");
    let cursorDate = null;
    let cursorId = null;
    if (req.query.cursor !== undefined) {
      try {
        if (typeof req.query.cursor !== "string" || req.query.cursor.length > 240) throw new Error();
        const value = JSON.parse(Buffer.from(req.query.cursor, "base64url").toString("utf8"));
        if (!Array.isArray(value) || value.length !== 2 ||
            !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value[0]) ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value[1])) throw new Error();
        cursorDate = new Date(value[0]);
        if (!Number.isFinite(cursorDate.getTime())) throw new Error();
        cursorId = value[1];
      } catch { calc.bad("Invalid receivables cursor"); }
    }
    const rows = await prisma.$queryRaw`
      WITH payment_totals AS (
        SELECT ip."dispatchId", SUM(ip.amount) AS received
        FROM "InvoicePayment" ip
        WHERE ip."organizationId" = ${req.user.organizationId}::uuid
        GROUP BY ip."dispatchId"
      ), invoices AS (
        SELECT d.id, d."dispatchSlipNumber", d.date,
          CASE WHEN d.summary->>'netBillableAmount' ~ '^[0-9]+([.][0-9]+)?$'
            THEN ROUND((d.summary->>'netBillableAmount')::numeric, 2) ELSE 0::numeric END AS invoice_total,
          COALESCE(pt.received, 0::numeric) AS received
        FROM "Dispatch" d
        LEFT JOIN payment_totals pt ON pt."dispatchId" = d.id
        WHERE d."organizationId" = ${req.user.organizationId}::uuid
          AND d.status IN ('Dispatched', 'Delivered')
          AND d.date < ${windows(new Date(), 1).end}
          AND COALESCE(NULLIF(BTRIM(d."partyName"), ''), 'Unspecified party') = ${party.trim()}
      )
      SELECT id, "dispatchSlipNumber", date, invoice_total, received,
        invoice_total - received AS balance
      FROM invoices
      WHERE invoice_total > received
        AND (${cursorDate}::timestamptz IS NULL OR (date, id) > (${cursorDate}::timestamptz, ${cursorId}::uuid))
      ORDER BY date, id
      LIMIT ${DEFAULT_LIST_LIMIT + 1}
    `;
    const hasMore = rows.length > DEFAULT_LIST_LIMIT;
    const page = rows.slice(0, DEFAULT_LIST_LIMIT);
    const last = page.at(-1);
    res.json({
      data: page.map(row => ({
        id: row.id,
        dispatchSlipNumber: row.dispatchSlipNumber,
        date: row.date,
        status: Number(row.received) > 0 ? "PARTIALLY_PAID" : "PAYMENT_DUE",
        invoiceTotal: round2(Number(row.invoice_total)),
        received: round2(Number(row.received)),
        balance: round2(Number(row.balance)),
      })),
      nextCursor: hasMore ? Buffer.from(JSON.stringify([last.date.toISOString(), last.id])).toString("base64url") : null,
    });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const filter = { organizationId: req.user.organizationId };
    if (
      req.query.status &&
      !["Draft", "Dispatched", "Delivered"].includes(req.query.status)
    )
      calc.bad("Invalid status");
    if (req.query.status) filter.status = req.query.status;
    if (
      req.query.q !== undefined &&
      (typeof req.query.q !== "string" || req.query.q.length > 120)
    )
      calc.bad("Search must be at most 120 characters");
    const search = req.query.q?.trim();
    if (search)
      filter.OR = [
        { partyName: { contains: search, mode: "insensitive" } },
        { dispatchSlipNumber: { contains: search, mode: "insensitive" } },
        {
          logistics: {
            path: ["truckNumber"],
            string_contains: search,
            mode: "insensitive",
          },
        },
        {
          logistics: {
            path: ["buyerDestination"],
            string_contains: search,
            mode: "insensitive",
          },
        },
      ];
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIST_LIMIT, 1),
      MAX_LIST_LIMIT,
    );
    const cursor = req.query.cursor;
    const dispatches = await prisma.dispatch.findMany({
      where: filter,
      select: LIST_FIELDS,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    for (const dispatch of dispatches) {
      // List responses carry summaries; invalid version-2 money must not be
      // presented as a usable balance or passed into a buyer invoice.
      validateInvoiceMoney(dispatch.summary);
    }
    const hasMore = dispatches.length > limit;
    if (hasMore) dispatches.pop();
    const nextCursor = hasMore ? dispatches[dispatches.length - 1].id : null;
    res.json({ data: dispatches, nextCursor });
  } catch (err) {
    next(err);
  }
};
