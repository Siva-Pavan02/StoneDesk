const prisma = require('../utils/prisma');
const { randomUUID } = require('node:crypto');
const { text, number, bad } = require('../utils/pilotCalculations');
function fields(body) {
  const data = {};
  for (const key of ['supervisor', 'buyerDestination', 'stoneType', 'finish']) data[key] = text(body[key], key);
  data.date = body.date === undefined ? new Date() : new Date(body.date);
  if (!Number.isFinite(data.date.getTime())) bad('Invalid date');
  data.status = body.status || 'Draft';
  if (!['Draft', 'Loading', 'Completed'].includes(data.status)) bad('Invalid status');
  if (!Array.isArray(body.requirements)) bad('Requirements must be a list');
  data.requirements = body.requirements.map(row => {
    if (!row || typeof row !== "object" || (row.loadedPieces !== undefined && !Array.isArray(row.loadedPieces))) bad("Invalid requirement");
    const lengthFt = number(row.lengthFt, 'length'), widthFt = number(row.widthFt, 'width');
    const requiredQuantity = number(row.requiredQuantity, 'quantity');
    if (lengthFt <= 0 || widthFt <= 0 || !Number.isSafeInteger(requiredQuantity)) bad('Invalid dimensions or quantity');
    const loadedPieces = (row.loadedPieces || []).map(piece => {
      if (!piece || typeof piece !== "object") bad("Invalid piece");
      const lengthFt = number(piece.lengthFt, 'length'), widthFt = number(piece.widthFt, 'width');
      if (lengthFt <= 0 || widthFt <= 0) bad('Invalid dimensions');
      return { lengthFt, widthFt, sqFt: number(lengthFt * widthFt, 'area'), lengthDisplay: String(lengthFt), widthDisplay: String(widthFt) };
    });
    const loadedQuantity = row.loadedQuantity === undefined ? loadedPieces.length : number(row.loadedQuantity, 'loaded quantity');
    if (!Number.isSafeInteger(loadedQuantity)) bad('Invalid loaded quantity');
    return { _id: typeof row._id === 'string' ? row._id : randomUUID(), lengthFt, widthFt, lengthDisplay: String(lengthFt), widthDisplay: String(widthFt), requiredQuantity, loadedQuantity, balance: requiredQuantity - loadedQuantity, loadedPieces };
  });
  return data;
}

exports.createLoadingList = async (req, res, next) => {
  try {
    const data = fields(req.body);
    data.loadingListNumber = req.body.loadingListNumber ? text(req.body.loadingListNumber, 'loading number') : 'LL-' + randomUUID();
    data.organizationId = req.user.organizationId;

    const list = await prisma.loadingList.create({ data });
    res.status(201).json(list);
  } catch (error) {
    next(error);
  }
};

exports.getLoadingLists = async (req, res, next) => {
  try {
    const lists = await prisma.loadingList.findMany({ where: { organizationId: req.user.organizationId }, orderBy: { createdAt: 'desc' } });
    res.status(200).json(lists);
  } catch (error) {
    next(error);
  }
};

exports.getLoadingListById = async (req, res, next) => {
  try {
    const list = await prisma.loadingList.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!list) return res.status(404).json({ error: 'Not found' });
    res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};

exports.updateLoadingList = async (req, res, next) => {
  try {
    const existing = await prisma.loadingList.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const list = await prisma.loadingList.update({ where: { id: req.params.id }, data: fields({ ...existing, ...req.body }) });
    res.status(200).json(list);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    next(error);
  }
};

exports.deleteLoadingList = async (req, res, next) => {
  try {
    const result = await prisma.loadingList.deleteMany({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (result.count === 0) return res.status(404).json({ error: 'Not found' });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Draft', 'Loading', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const result = await prisma.loadingList.updateMany({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      data: { status }
    });
    if (result.count === 0) return res.status(404).json({ error: 'Not found' });
    const list = await prisma.loadingList.findUnique({ where: { id: req.params.id } });
    res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};
