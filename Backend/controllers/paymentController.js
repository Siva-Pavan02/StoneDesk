const { Prisma } = require('@prisma/client');
const prisma = require('../utils/prisma');
const { derivePaymentSummary } = require('../utils/paymentSummary');
const { round2 } = require('../utils/dispatchCalculations');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const formatPayment = (p) => ({
  id: p.id,
  amount: Number(new Prisma.Decimal(p.amount).toFixed(2)),
  note: p.note,
  createdAt: p.createdAt,
  createdBy: p.createdByUser?.name || null
});

exports.getPayments = async (req, res, next) => {
  try {
    if (!UUID_REGEX.test(req.params.id)) return res.status(404).json({ error: 'Not found' });

    const dispatch = await prisma.dispatch.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      select: { id: true, status: true, summary: true }
    });
    if (!dispatch) return res.status(404).json({ error: 'Not found' });

    const payments = await prisma.invoicePayment.findMany({
      where: { dispatchId: dispatch.id, organizationId: req.user.organizationId },
      select: {
        id: true,
        amount: true,
        note: true,
        createdAt: true,
        createdByUser: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const summary = derivePaymentSummary(dispatch.summary?.netBillableAmount, payments);
    res.json({
      ...summary,
      payments: payments.map(formatPayment)
    });
  } catch (err) { next(err); }
};

exports.createPayment = async (req, res, next) => {
  try {
    if (!UUID_REGEX.test(req.params.id)) return res.status(404).json({ error: 'Not found' });

    const rawAmount = req.body.amount;
    if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount) || rawAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }
    if (rawAmount > 10000000) {
      return res.status(400).json({ error: 'Payment amount exceeds limit' });
    }

    const payDecimal = new Prisma.Decimal(round2(rawAmount).toFixed(2));
    if (payDecimal.lessThanOrEqualTo(0)) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    let note = null;
    if (req.body.note !== undefined && req.body.note !== null) {
      if (typeof req.body.note !== 'string') return res.status(400).json({ error: 'Invalid note' });
      const trimmed = req.body.note.trim();
      if (trimmed.length > 255) return res.status(400).json({ error: 'Note must be at most 255 characters' });
      note = trimmed || null;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Row-level lock on the dispatch record to prevent concurrent overpayment race conditions
      const [dispatch] = await tx.$queryRaw`
        SELECT id, status, summary
        FROM "Dispatch"
        WHERE id = ${req.params.id}::uuid
          AND "organizationId" = ${req.user.organizationId}::uuid
        FOR UPDATE
      `;
      if (!dispatch) {
        const err = new Error('Not found');
        err.status = 404;
        throw err;
      }
      if (dispatch.status === 'Draft') {
        const err = new Error('Payments can only be recorded on finalized dispatches');
        err.status = 400;
        throw err;
      }

      const existingPayments = await tx.invoicePayment.findMany({
        where: { dispatchId: dispatch.id, organizationId: req.user.organizationId },
        select: {
          id: true,
          amount: true,
          note: true,
          createdAt: true,
          createdByUser: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      const rawSummary = typeof dispatch.summary === 'string' ? JSON.parse(dispatch.summary) : dispatch.summary;
      const currentSummary = derivePaymentSummary(rawSummary?.netBillableAmount, existingPayments);

      if (payDecimal.greaterThan(currentSummary.balance)) {
        const err = new Error(`Payment exceeds remaining balance of ₹${currentSummary.balance.toFixed(2)}`);
        err.status = 400;
        throw err;
      }

      const newPayment = await tx.invoicePayment.create({
        data: {
          organizationId: req.user.organizationId,
          dispatchId: dispatch.id,
          amount: payDecimal,
          note,
          createdByUserId: req.user.id
        },
        include: {
          createdByUser: { select: { name: true } }
        }
      });

      const allPayments = [newPayment, ...existingPayments];
      const updatedSummary = derivePaymentSummary(rawSummary?.netBillableAmount, allPayments);

      return {
        ...updatedSummary,
        payments: allPayments.map(formatPayment)
      };
    });

    res.status(201).json(result);
  } catch (err) { next(err); }
};
