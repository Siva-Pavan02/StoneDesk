const prisma = require('./prisma');

// Final bills embed their historical logo. Only the organization's current logo
// is accessible through this private file endpoint, including HEAD/range requests.
module.exports = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    if (!/^\/[a-f0-9-]+\.png$/.test(req.path)) return res.status(404).json({ error: 'Logo not found' });
    const settings = await prisma.masterSettings.findUnique({
      where: { id: req.user.organizationId }, select: { logoPath: true },
    });
    if (!settings?.logoPath || settings.logoPath !== `/uploads${req.path}`) return res.status(404).json({ error: 'Logo not found' });
    next();
  } catch (error) { next(error); }
};
