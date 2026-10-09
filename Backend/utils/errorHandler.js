// Error messages, stacks and Prisma metadata may contain credentials or user data.
// Emit only a fixed event and a bounded, recognized code; never serialize the error.
const logFailure = err => console.error(JSON.stringify({
  event: 'request_failed',
  code: /^P\d{4}$/.test(err.code || '') ? err.code : err.name === 'PrismaClientValidationError' ? 'PRISMA_VALIDATION' : 'UNEXPECTED',
}));
module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.status === 413) return res.status(413).json({ error: req.path.endsWith('/logo') ? 'Logo must be at most 2 MB' : 'Request body is too large' });
  if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (err.status === 503 && err.safeAuthError === true) return res.status(503).json({ error: err.message });
  if (err.code === 'P2002') return res.status(409).json({ error: 'Record already exists' });
  if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
  if (err.code === 'P2034') return res.status(409).json({ error: 'Record changed. Please retry.' });
  if (err.name === 'PrismaClientValidationError' || ['P2000', 'P2003', 'P2006', 'P2007', 'P2011', 'P2012', 'P2013', 'P2014', 'P2019', 'P2023'].includes(err.code)) {
    logFailure(err);
    return res.status(400).json({ error: 'Invalid record data' });
  }
  if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(err.code)) return res.status(503).json({ error: 'Database temporarily unavailable. Please retry.' });
  logFailure(err);
  res.status(500).json({ error: 'Unexpected server error' });
};
