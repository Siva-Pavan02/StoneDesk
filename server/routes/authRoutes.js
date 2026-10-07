const express = require('express');
const { randomBytes } = require('node:crypto');
const prisma = require('../utils/prisma');
const auth = require('../utils/auth');
const router = express.Router();

function credentials(body = {}) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 12 || password.length > 128) {
    const error = new Error('Enter a valid email and a password of 12 to 128 characters'); error.status = 400; throw error;
  }
  return { email, password };
}
router.post('/signup', auth.authLimit, async (req, res, next) => {
  try {
    const { email, password } = credentials(req.body);
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const organizationId = typeof req.body.organizationId === 'string' ? req.body.organizationId.trim() : '';
    const createOrganization = req.body.createOrganization === true || req.body.createOrganization === 'true';

    if (!name || name.length > 120) return res.status(400).json({ error: 'Enter your name (up to 120 characters)' });
    if (!organizationId || organizationId.length > 50) return res.status(400).json({ error: 'Enter a valid Organization Code (up to 50 characters)' });
    
    // Check if the user already exists to fail fast
    if (await prisma.user.findUnique({ where: { email } })) {
       return res.status(409).json({ error: 'Unable to create this account. Try signing in.' });
    }

    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = await auth.passwordHash(password, passwordSalt);
    const fields = { email, name, passwordSalt, passwordHash, active: true, organizationId };
    
    let user;
    if (createOrganization) {
      // Create new organization and make user Admin
      const existingOrg = await prisma.masterSettings.findUnique({ where: { organizationId } });
      if (existingOrg) return res.status(409).json({ error: 'This Organization Code is already taken. Choose another or join it.' });
      
      const org = await prisma.masterSettings.create({
        data: { organizationId, businessName: organizationId }
      });
      user = await prisma.user.create({ data: { ...fields, role: 'Admin' } });
    } else {
      // Join existing organization
      const existingOrg = await prisma.masterSettings.findUnique({ where: { organizationId } });
      if (!existingOrg) return res.status(404).json({ error: 'Organization Code not found. Please check and try again.' });
      
      user = await prisma.user.create({ data: { ...fields, role: 'Dispatcher' } });
    }

    await auth.startSession(req, res, user);
    res.status(201).json({ user: auth.publicUser(user) });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Unable to create this account. Try signing in.' });
    next(err);
  }
});
router.post('/login', auth.authLimit, async (req, res, next) => {
  try {
    const { email, password } = credentials(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!await auth.verifyPassword(password, user)) return res.status(401).json({ error: 'Email or password is incorrect' });
    await auth.startSession(req, res, user);
    res.json({ user: auth.publicUser(user) });
  } catch (err) { next(err); }
});
router.post('/logout', async (req, res, next) => {
  try { await auth.endSession(req, res); res.json({ ok: true }); } catch (err) { next(err); }
});
router.get('/me', auth.requireSession, (req, res) => res.json({ user: auth.publicUser(req.user) }));
router.post('/password', auth.authLimit, auth.requireSession, async (req, res, next) => {
  try {
    const { password } = credentials({ email: req.user.email, password: req.body.password });
    if (typeof req.body.currentPassword !== 'string' || req.body.currentPassword.length > 128) return res.status(400).json({ error: 'Enter your current password' });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!await auth.verifyPassword(req.body.currentPassword, user)) return res.status(400).json({ error: 'Current password is incorrect' });
    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = await auth.passwordHash(password, passwordSalt);
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordSalt, passwordHash } }),
      prisma.session.deleteMany({ where: { userId: user.id } })
    ]);
    await auth.startSession(req, res, updatedUser); res.json({ ok: true });
  } catch (err) { next(err); }
});
router.get('/users', auth.requireSession, auth.requireActive, auth.allowRoles('Admin'), async (req, res, next) => {
  try { res.json((await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })).map(auth.publicUser)); } catch (err) { next(err); }
});
router.patch('/users/:id', auth.requireSession, auth.requireActive, auth.allowRoles('Admin'), async (req, res, next) => {
  try {
    req.body.role = req.body.role === 'Yard Manager' ? 'YardManager' : req.body.role;
    if (!['Admin', 'YardManager', 'Dispatcher'].includes(req.body.role) || typeof req.body.active !== 'boolean') return res.status(400).json({ error: 'Choose a valid role and access status' });
    let user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.role === 'Admin' || user.id === req.user.id) return res.status(400).json({ error: 'You cannot change the owner or your own access' });
    user = await prisma.user.update({ where: { id: user.id }, data: { role: req.body.role, active: req.body.active } });
    if (!user.active) await prisma.session.deleteMany({ where: { userId: user.id } });
    res.json(auth.publicUser(user));
  } catch (err) { next(err); }
});
module.exports = router;
