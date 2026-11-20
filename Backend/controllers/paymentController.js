const { Prisma } = require("@prisma/client");
const prisma = require("../utils/prisma");
const { derivePaymentSummary } = require("../utils/paymentSummary");
const { invoiceTotalDecimal, validateInvoiceMoney } = require("../utils/invoiceMoney");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const paymentSelect = {
  id: true,
  dispatchId: true,
  clientRequestId: true,
  amount: true,
  note: true,
  createdAt: true,
  createdByUser: { select: { name: true } },
};

function paymentResponse(summary, payments) {
  return { ...derivePaymentSummary(summary, payments), payments: payments.map(formatPayment) };
}

function sameIntent(payment, dispatchId, amount, note) {
  return payment.dispatchId === dispatchId &&
    new Prisma.Decimal(payment.amount).equals(amount) &&
    (payment.note || null) === note;
}

function conflict() {
  const error = new Error("Payment request ID was already used for a different payment");
  error.status = 409;
  return error;
}

const formatPayment = (p) => ({
  id: p.id,
  amount: Number(new Prisma.Decimal(p.amount).toFixed(2)),
  clientRequestId: p.clientRequestId || null,
  note: p.note,
  createdAt: p.createdAt,
  createdBy: p.createdByUser?.name || null,
});

exports.getPayments = async (req, res, next) => {
  try {
    if (!UUID_REGEX.test(req.params.id))
      return res.status(404).json({ error: "Not found" });

    const dispatch = await prisma.dispatch.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      select: { id: true, status: true, summary: true, inventory: true },
    });
    if (!dispatch) return res.status(404).json({ error: "Not found" });
    validateInvoiceMoney(dispatch.summary, dispatch.inventory);

    const payments = await prisma.invoicePayment.findMany({
      where: {
        dispatchId: dispatch.id,
        organizationId: req.user.organizationId,
      },
      select: paymentSelect,
      orderBy: { createdAt: "desc" },
    });

    res.json(paymentResponse(dispatch.summary, payments));
  } catch (err) {
    next(err);
  }
};

exports.getPaymentStatement = async (req, res, next) => {
  try {
    if (!UUID_REGEX.test(req.params.id))
      return res.status(404).json({ error: "Not found" });
    const organizationId = req.user.organizationId;
    const statement = await prisma.$transaction(async (tx) => {
      // This first statement establishes the repeatable-read snapshot. The
      // timestamp is taken as it executes, so no included payment can appear
      // later than the statement's displayed as-of time.
      const [clock] = await tx.$queryRaw`SELECT clock_timestamp() AS "asOf"`;
      const dispatch = await tx.dispatch.findFirst({
        where: { id: req.params.id, organizationId },
        select: {
          id: true, dispatchSlipNumber: true, date: true, partyName: true,
          status: true, summary: true, inventory: true, revisions: true,
        },
      });
      if (!dispatch) return null;
      if (dispatch.status === "Draft") {
        const error = new Error("Payment statements require a finalized invoice");
        error.status = 409;
        throw error;
      }
      validateInvoiceMoney(dispatch.summary, dispatch.inventory);
      const payments = await tx.invoicePayment.findMany({
        where: { dispatchId: dispatch.id, organizationId },
        select: paymentSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const total = invoiceTotalDecimal(dispatch.summary);
      const received = payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
      const balance = Prisma.Decimal.max(total.minus(received), 0);
      const excess = Prisma.Decimal.max(received.minus(total), 0);
      const status = total.isZero() || received.greaterThanOrEqualTo(total)
        ? "PAID" : received.isZero() ? "PAYMENT_DUE" : "PARTIALLY_PAID";
      return {
        asOf: clock.asOf.toISOString(),
        timeZone: "Asia/Kolkata",
        invoice: {
          id: dispatch.id,
          number: dispatch.dispatchSlipNumber,
          date: dispatch.date,
          partyName: dispatch.partyName,
          revisionNumber: (Array.isArray(dispatch.revisions) ? dispatch.revisions.length : 0) + 1,
          calculationVersion: dispatch.summary?.calculationVersion || 1,
          total: total.toFixed(2),
        },
        payments: payments.map((payment) => ({
          id: payment.id,
          amount: new Prisma.Decimal(payment.amount).toFixed(2),
          note: payment.note,
          createdAt: payment.createdAt,
          createdBy: payment.createdByUser?.name || null,
        })),
        received: received.toFixed(2),
        balance: balance.toFixed(2),
        excess: excess.toFixed(2),
        status,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    if (!statement) return res.status(404).json({ error: "Not found" });
    res.json(statement);
  } catch (error) {
    next(error);
  }
};

exports.createPayment = async (req, res, next) => {
  try {
    if (!UUID_REGEX.test(req.params.id))
      return res.status(404).json({ error: "Not found" });
    // Hide cross-organization invoice existence before validating the body.
    const visible = await prisma.dispatch.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      select: { id: true },
    });
    if (!visible) return res.status(404).json({ error: "Not found" });

    const requestId = req.body?.clientRequestId;
    if (typeof requestId !== "string" || !UUID_REGEX.test(requestId)) {
      return res.status(400).json({ error: "Refresh the page and try this payment again" });
    }
    const clientRequestId = requestId.toLowerCase();

    const rawAmount = req.body?.amount;
    if (
      typeof rawAmount !== "number" ||
      !Number.isFinite(rawAmount) ||
      rawAmount <= 0
    ) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }
    if (rawAmount > 10000000) {
      return res.status(400).json({ error: "Payment amount exceeds limit" });
    }

    const payDecimal = new Prisma.Decimal(String(rawAmount));
    if (!payDecimal.times(100).isInteger())
      return res.status(400).json({ error: "Payment amount must have at most two decimal places" });

    let note = null;
    if (req.body.note !== undefined && req.body.note !== null) {
      if (typeof req.body.note !== "string")
        return res.status(400).json({ error: "Invalid note" });
      const trimmed = req.body.note.trim();
      if (trimmed.length > 255)
        return res
          .status(400)
          .json({ error: "Note must be at most 255 characters" });
      note = trimmed || null;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Row-level lock on the dispatch record to prevent concurrent overpayment race conditions
      const [dispatch] = await tx.$queryRaw`
        SELECT id, status, summary, inventory
        FROM "Dispatch"
        WHERE id = ${req.params.id}::uuid
          AND "organizationId" = ${req.user.organizationId}::uuid
        FOR UPDATE
      `;
      if (!dispatch) {
        const err = new Error("Not found");
        err.status = 404;
        throw err;
      }
      validateInvoiceMoney(dispatch.summary, dispatch.inventory);

      // Retry lookup must precede the balance check so a successful payment
      // can be replayed even after the invoice is fully paid.
      const byKey = await tx.invoicePayment.findFirst({
        where: { organizationId: req.user.organizationId, clientRequestId },
        select: { dispatchId: true, amount: true, note: true },
      });
      if (byKey && !sameIntent(byKey, dispatch.id, payDecimal, note))
        throw conflict();
      if (dispatch.status === "Draft") {
        const err = new Error(
          "Payments can only be recorded on finalized dispatches",
        );
        err.status = 400;
        throw err;
      }

      const existingPayments = await tx.invoicePayment.findMany({
        where: {
          dispatchId: dispatch.id,
          organizationId: req.user.organizationId,
        },
        select: paymentSelect,
        orderBy: { createdAt: "desc" },
      });

      const rawSummary =
        typeof dispatch.summary === "string"
          ? JSON.parse(dispatch.summary)
          : dispatch.summary;
      const currentSummary = derivePaymentSummary(rawSummary, existingPayments);

      if (byKey)
        return { status: 200, body: paymentResponse(rawSummary, existingPayments) };

      if (payDecimal.greaterThan(new Prisma.Decimal(String(currentSummary.balance)))) {
        const err = new Error(
          `Payment exceeds remaining balance of ₹${currentSummary.balance.toFixed(2)}`,
        );
        err.status = 400;
        throw err;
      }

      // Use a wall-clock timestamp after the dispatch lock. PostgreSQL's
      // default now() is the transaction start and can predate a revision that
      // committed while this payment waited for the same lock.
      const [{ recordedAt }] = await tx.$queryRaw`SELECT clock_timestamp() AS "recordedAt"`;

      const newPayment = await tx.invoicePayment.create({
        data: {
          organizationId: req.user.organizationId,
          dispatchId: dispatch.id,
          amount: payDecimal,
          clientRequestId,
          note,
          createdAt: recordedAt,
          createdByUserId: req.user.id,
        },
        include: {
          createdByUser: { select: { name: true } },
        },
      });

      const allPayments = [newPayment, ...existingPayments];
      return {
        status: 201,
        body: paymentResponse(rawSummary, allPayments),
      };
    });

    res.status(result.status).json(result.body);
  } catch (err) {
    if (err.code === "P2002" && UUID_REGEX.test(req.body?.clientRequestId || "")) {
      // Two different dispatch rows can race for the same organization key.
      // The failed transaction is over, so its winner is now visible.
      try {
        const clientRequestId = req.body.clientRequestId.toLowerCase();
        const winner = await prisma.invoicePayment.findFirst({
          where: { organizationId: req.user.organizationId, clientRequestId },
          select: { dispatchId: true, amount: true, note: true },
        });
        if (winner) {
          const amount = new Prisma.Decimal(String(req.body.amount));
          const note = typeof req.body.note === "string" ? req.body.note.trim() || null : null;
          if (!sameIntent(winner, req.params.id, amount, note))
            return res.status(409).json({ error: conflict().message });
          const dispatch = await prisma.dispatch.findFirst({
            where: { id: req.params.id, organizationId: req.user.organizationId },
            select: { summary: true },
          });
          if (!dispatch) return res.status(404).json({ error: "Not found" });
          const payments = await prisma.invoicePayment.findMany({
            where: { dispatchId: req.params.id, organizationId: req.user.organizationId },
            select: paymentSelect,
            orderBy: { createdAt: "desc" },
          });
          return res.status(200).json(paymentResponse(dispatch.summary, payments));
        }
      } catch (readError) {
        return next(readError);
      }
    }
    next(err);
  }
};
