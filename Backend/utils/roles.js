// Pure role rules shared by the real API and the mock (no prisma import).
// req.user.role is the enum value ('YardManager'); the API shows it as 'Yard Manager'.

const PRODUCT_CREATORS = ['Admin', 'YardManager'];

const normalizeRole = role => (role === 'Yard Manager' ? 'YardManager' : role);

// Admin and Manager (YardManager) may add products; edit/delete stay Admin-only.
const canAddProduct = role => PRODUCT_CREATORS.includes(normalizeRole(role));

function requireProductCreator(req, res, next) {
  if (canAddProduct(req.user?.role)) return next();
  return res.status(403).json({ error: 'Your role does not allow this action' });
}

module.exports = { PRODUCT_CREATORS, normalizeRole, canAddProduct, requireProductCreator };
