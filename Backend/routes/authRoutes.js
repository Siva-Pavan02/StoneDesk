const express = require('express');
const { randomBytes } = require('node:crypto');
const zxcvbn = require('zxcvbn');
const { createHash } = require('node:crypto');
const prisma = require('../utils/prisma');
const auth = require('../utils/auth');
const { organizationCode } = require('../utils/organizationCode');
const { sendPasswordResetEmail } = require('../utils/email');
const { auditLog } = require('../utils/auditLog');
const router = express.Router();
const googleAuth = require('../utils/googleAuth');
const googleTickets = require('../utils/googleTickets');
const deleteAuthUser = require('../utils/deleteAuthUser');
const invitations = require('../utils/invitations');
const { limitAccount } = require('../utils/rateLimiter');
const { requiresCurrentPassword, buildResetUrl } = require('../utils/authFlags');

router.get('/google/config', (req, res, next) => {
  try { res.json({ url: googleAuth.configuration().url }); } catch (err) { next(err); }
});
router.post('/google/exchange', auth.authLimit, async (req, res, next) => {
  try {
    const identity = await googleAuth.exchange(req.body.code, req.body.verifier);
    await limitAccount(identity.email);
    const user = await prisma.user.findUnique({ where: { supabaseUserId: identity.supabaseUserId } });
    if (!user) {
      const existing = await prisma.user.findUnique({ where: { email: identity.email } });
      // A replacement Supabase identity needs account recovery, not a password
      // prompt: Google-only accounts do not have a user-chosen local password.
      if (existing?.supabaseUserId) return res.status(409).json({ error: 'Your Google account link needs recovery. Contact your administrator to restore the existing StoneDesk account.' });
      // The verified identity stays on the server; the browser gets an opaque, short-lived ticket.
      const ticket = await googleTickets.issue(identity);
      return res.json({ needsSignup: !existing, needsLink: Boolean(existing), ticket, email: identity.email });
    }
    if (!user.active) return res.status(403).json({ error: 'Your account access has been paused. Contact your administrator.' });
    await auth.startSession(req, res, user);
    await auditLog('user.google_login', req, { userId: user.id });
    res.json({ user: auth.publicUser(user) });
  } catch (err) { next(err); }
});
router.post('/google/link', auth.authLimit, async (req, res, next) => {
  try {
    const identity = await googleTickets.read(req.body.googleTicket);
    await limitAccount(identity.email);
    const user = await prisma.user.findUnique({ where: { email: identity.email } });
    const password = req.body.password;
    if (typeof password !== 'string' || password.length > 128 || !await auth.verifyPassword(password, user)) return res.status(401).json({ error: 'Your StoneDesk password is incorrect.' });
    if (!user.active) return res.status(403).json({ error: 'Your account access has been paused. Contact your administrator.' });
    if (user.supabaseUserId && user.supabaseUserId !== identity.supabaseUserId) return res.status(409).json({ error: 'This account already has a different Google identity linked.' });
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { supabaseUserId: identity.supabaseUserId } }),
      prisma.session.deleteMany({ where: { userId: user.id } })
    ]);
    await googleTickets.consume(req.body.googleTicket);
    await auth.startSession(req, res, user);
    await auditLog('user.google_link', req, { userId: user.id });
    res.json({ user: auth.publicUser(user) });
  } catch (err) { next(err); }
});


const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function credentials(body = {}, checkStrength = true) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 12 || password.length > 128) {
    const error = new Error('Enter a valid email and a password of 12 to 128 characters'); error.status = 400; throw error;
  }
  const strength = zxcvbn(password);
  if (checkStrength && strength.score < 3) {
    const error = new Error('Password is too weak. ' + (strength.feedback?.warning || 'Use a stronger password with mixed case, numbers, and symbols.')); error.status = 400; throw error;
  }
  return { email, password };
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
router.post('/signup', auth.authLimit, async (req, res, next) => {
  try {
    const google = req.body.googleTicket ? await googleTickets.read(req.body.googleTicket) : null;
    if (google) await limitAccount(google.email);
    const { email, password } = google
      ? { email: google.email, password: randomBytes(48).toString('base64url') }
      : credentials(req.body);
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const createOrganization = req.body.createOrganization === true || req.body.createOrganization === 'true';
    const businessName = typeof req.body.businessName === 'string' ? req.body.businessName.trim() : '';

    if (!name || name.length > 120) return res.status(400).json({ error: 'Enter your name (up to 120 characters)' });
    if (createOrganization && (!businessName || businessName.length > 120)) return res.status(400).json({ error: 'Enter your business name (up to 120 characters)' });
    if (!createOrganization && !req.body.invitationToken) return res.status(400).json({ error: 'Enter the invitation code shared by your administrator' });
    
    // Check if the user already exists to fail fast
    if (await prisma.user.findUnique({ where: { email } })) {
       return res.status(409).json({ error: 'Unable to create this account. Try signing in.' });
    }

    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = await auth.passwordHash(password, passwordSalt);
    const fields = { email, name, passwordSalt, passwordHash, active: true, ...(google ? { supabaseUserId: google.supabaseUserId, passwordLogin: false } : {}) };
    
    let user;
    if (createOrganization) {
      // A nested write makes the organization and its first member atomic.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          user = await prisma.user.create({ data: { ...fields, role: 'Admin', organization: { create: {
            organizationId: organizationCode(businessName), businessName, stoneRates: [], savedTrucks: [], savedDestinations: []
          } } } });
          break;
        } catch (error) {
          if (error.code !== 'P2002' || !String(error.meta?.target).includes('organizationId') || attempt === 4) throw error;
        }
      }
    } else {
      user = await invitations.redeem(req.body.invitationToken, fields);
    }

    if (google) await googleTickets.consume(req.body.googleTicket);
    await auth.startSession(req, res, user);
    const organization = await prisma.masterSettings.findUnique({ where: { id: user.organizationId }, select: { organizationId: true } });
    res.status(201).json({ user: auth.publicUser(user), organizationCode: organization.organizationId });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Unable to create this account. Try signing in.' });
    next(err);
  }
});
router.post('/login', auth.authLimit, async (req, res, next) => {
  try {
    const { email, password } = credentials(req.body, false);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!await auth.verifyPassword(password, user)) return res.status(401).json({ error: 'Email or password is incorrect' });
    await auth.startSession(req, res, user);
    await auditLog('user.login', req, { email });
    res.json({ user: auth.publicUser(user) });
  } catch (err) { next(err); }
});
router.post('/logout', async (req, res, next) => {
  try { await auth.endSession(req, res); await auditLog('user.logout', req); res.json({ ok: true }); } catch (err) { next(err); }
});
router.get('/me', auth.requireSession, (req, res) => res.json({ user: auth.publicUser(req.user) }));
// Public session discovery: being signed out is a normal landing-page state.
router.get('/session', async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const user = await auth.readSession(req);
    res.json({ user: user?.active ? auth.publicUser(user) : null });
  } catch (err) { next(err); }
});
router.post('/password', auth.authLimit, auth.requireSession, async (req, res, next) => {
  try {
    const { password } = credentials({ email: req.user.email, password: req.body.password });
    // Read the flag from the freshly loaded row, never from req.user.
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (requiresCurrentPassword(user)) {
      if (typeof req.body.currentPassword !== 'string' || req.body.currentPassword.length > 128) return res.status(400).json({ error: 'Enter your current password' });
      if (!await auth.verifyPassword(req.body.currentPassword, user)) return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = await auth.passwordHash(password, passwordSalt);
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordSalt, passwordHash, passwordLogin: true } }),
      prisma.session.deleteMany({ where: { userId: user.id } })
    ]);
    await auth.startSession(req, res, updatedUser);
    await auditLog('user.password_change', req);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
router.delete('/account', auth.authLimit, auth.requireSession, async (req, res, next) => {
  try {
    const confirm = typeof req.body.confirm === 'string' ? req.body.confirm.trim().toLowerCase() : '';
    if (confirm !== req.user.email.toLowerCase()) return res.status(400).json({ error: 'Type your email exactly to confirm deletion' });
    const deleteBusiness = req.user.role === 'Admin';
    await deleteAuthUser(req.user);
    await auditLog(deleteBusiness ? 'organization.delete' : 'user.account_delete', req, { targetUserId: req.user.id });
    if (deleteBusiness) await prisma.masterSettings.delete({ where: { id: req.user.organizationId } });
    else await prisma.user.delete({ where: { id: req.user.id } });
    await auth.endSession(req, res);
    res.json({ ok: true, deletedBusiness: deleteBusiness });
  } catch (err) { next(err); }
});
router.get('/users', auth.requireSession, auth.requireActive, auth.allowRoles('Admin'), async (req, res, next) => {
  try { res.json((await prisma.user.findMany({ where: { organizationId: req.user.organizationId }, orderBy: { createdAt: 'asc' } })).map(auth.publicUser)); } catch (err) { next(err); }
});
router.get('/invitations', auth.requireSession, auth.requireActive, auth.allowRoles('Admin'), async (req, res, next) => {
  try { res.json(await prisma.invitation.findMany({ where: { organizationId: req.user.organizationId, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, select: invitations.select, orderBy: { createdAt: 'desc' }, take: 50 })); } catch (err) { next(err); }
});
router.post('/invitations', auth.requireSession, auth.requireActive, auth.allowRoles('Admin'), auth.authLimit, async (req, res, next) => {
  try { res.status(201).json(await invitations.issue(req.user, req.body)); } catch (err) { next(err); }
});
router.delete('/invitations/:id', auth.requireSession, auth.requireActive, auth.allowRoles('Admin'), async (req, res, next) => {
  try {
    if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const result = await prisma.invitation.updateMany({ where: { id: req.params.id, organizationId: req.user.organizationId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    res.status(result.count ? 200 : 404).json(result.count ? { ok: true } : { error: 'Not found' });
  } catch (err) { next(err); }
});
router.patch('/users/:id', auth.requireSession, auth.requireActive, auth.allowRoles('Admin'), async (req, res, next) => {
  try {
    req.body.role = req.body.role === 'Yard Manager' ? 'YardManager' : req.body.role;
    if (!['Admin', 'YardManager', 'Dispatcher'].includes(req.body.role) || typeof req.body.active !== 'boolean') return res.status(400).json({ error: 'Choose a valid role and access status' });
    let user = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.role === 'Admin' || user.id === req.user.id) return res.status(400).json({ error: 'You cannot change the owner or your own access' });
    const roleChanged = user.role !== req.body.role;
    const wasActive = user.active;
    const oldRole = user.role;
    user = await prisma.user.update({ where: { id: user.id, organizationId: req.user.organizationId }, data: { role: req.body.role, active: req.body.active } });
    if (!user.active || (wasActive && roleChanged)) await prisma.session.deleteMany({ where: { userId: user.id } });
    if (roleChanged) await auditLog('user.role_change', req, { targetUserId: user.id, oldRole, newRole: user.role });
    if (wasActive && !user.active) await auditLog('user.access_revoked', req, { targetUserId: user.id });
    res.json(auth.publicUser(user));
  } catch (err) { next(err); }
});

router.post('/forgot-password', auth.authLimit, async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return res.json({ ok: true });
    }
    
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    
    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS)
      }
    });
    
    const appOrigin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host') || 'localhost:5000'}`;
    const resetUrl = buildResetUrl(appOrigin, token, email);
    
    const settings = await prisma.masterSettings.findUnique({ where: { id: user.organizationId }, select: { businessName: true } });
    
    try {
      await sendPasswordResetEmail(email, resetUrl, settings?.businessName);
    } catch (emailErr) {
      console.error('Failed to send password reset email:', emailErr);
    }
    
    await auditLog('password_reset.request', req, { email });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/reset-password', auth.authLimit, async (req, res, next) => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const { password } = credentials({ email, password: req.body.password });
    
    if (!token || token.length !== 64) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    const tokenHash = hashToken(token);
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { tokenHash, used: false, expiresAt: { gt: new Date() } },
      include: { user: true }
    });
    
    if (!resetToken || !resetToken.user.active || resetToken.user.email !== email) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = await auth.passwordHash(password, passwordSalt);
    
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordSalt, passwordHash, passwordLogin: true }
      }),
      prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true }
      })
    ]);
    
    await auditLog('password_reset.complete', req, { email, userId: resetToken.userId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
