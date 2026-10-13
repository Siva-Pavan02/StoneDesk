const { createHash, randomBytes } = require('node:crypto');
const prisma = require('./prisma');
const hash = token => createHash('sha256').update(token).digest('hex');
const invalid = () => Object.assign(new Error('Invitation is invalid, expired, used, or does not match your email.'), { status: 400 });
const select = { id: true, email: true, role: true, createdAt: true, expiresAt: true, usedAt: true, revokedAt: true };

async function issue(user, body) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = body.role === 'Yard Manager' ? 'YardManager' : body.role;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['Dispatcher', 'YardManager'].includes(role)) {
    throw Object.assign(new Error('Enter a valid email and staff role.'), { status: 400 });
  }
  const token = randomBytes(32).toString('base64url');
  const invitation = await prisma.invitation.create({ data: { email, role, tokenHash: hash(token), organizationId: user.organizationId, issuedById: user.id, expiresAt: new Date(Date.now() + 7 * 86400000) }, select });
  return { ...invitation, token };
}

async function redeem(token, fields) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalid();
  return prisma.$transaction(async tx => {
    const where = { tokenHash: hash(token), email: fields.email, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, issuedBy: { active: true, role: 'Admin' } };
    const invitation = await tx.invitation.findFirst({ where });
    if (!invitation) throw invalid();
    // Conditional write serializes competing redemptions; failure rolls back user creation.
    const claimed = await tx.invitation.updateMany({ where: { ...where, id: invitation.id }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw invalid();
    return tx.user.create({ data: { ...fields, organizationId: invitation.organizationId, role: invitation.role } });
  });
}
module.exports = { issue, redeem, select };
