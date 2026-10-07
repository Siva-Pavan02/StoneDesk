const prisma = require('./prisma');

const SENSITIVE_ACTIONS = new Set([
  'user.login',
  'user.logout',
  'user.password_change',
  'user.role_change',
  'user.access_revoked',
  'dispatch.create',
  'dispatch.update',
  'dispatch.finalize',
  'dispatch.deliver',
  'dispatch.delete',
  'settings.profile_update',
  'settings.products_update',
  'settings.trucks_update',
  'settings.destinations_update',
  'settings.royalty_update',
  'loading_list.create',
  'loading_list.update',
  'loading_list.delete',
  'loading_list.status_change',
  'password_reset.request',
  'password_reset.complete',
]);

async function auditLog(action, req, details = {}) {
  if (!SENSITIVE_ACTIONS.has(action)) return;
  
  try {
    await prisma.auditLog.create({
      data: {
        action,
        organizationId: req.user?.organizationId || null,
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        userRole: req.user?.role || null,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details: JSON.stringify(details),
        timestamp: new Date(),
      },
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

function auditMiddleware(action, getDetails = () => ({})) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        auditLog(action, req, getDetails(req, body));
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { auditLog, auditMiddleware, SENSITIVE_ACTIONS };