const express = require('express');
const { randomBytes } = require('node:crypto');
const User = require('../models/User');
const Session = require('../models/Session');
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
    if (!name || name.length > 120) return res.status(400).json({ error: 'Enter your name (up to 120 characters)' });
    await User.init();
    const passwordSalt = randomBytes(16).toString('hex');
    const fields = { email, name, passwordSalt, passwordHash: await auth.passwordHash(password, passwordSalt) };
    const hasOwner = await User.exists({ ownerSlot: 'unit_04' });
    let user;
    try { user = await User.create({ ...fields, ...(!hasOwner ? { ownerSlot: 'unit_04', role: 'Admin', active: true } : {}) }); }
    catch (err) {
      if (err.code === 11000 && err.keyPattern?.ownerSlot) user = await User.create(fields);
      else throw err;
    }
    await auth.startSession(req, res, user);
    res.status(201).json({ user: auth.publicUser(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Unable to create this account. Try signing in.' });
    next(err);
  }
});
router.post('/login', auth.authLimit, async (req, res, next) => {
  try {
    const { email, password } = credentials(req.body);
    const user = await User.findOne({ email }).select('+passwordHash +passwordSalt');
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
    const user = await User.findById(req.user._id).select('+passwordHash +passwordSalt');
    if (!await auth.verifyPassword(req.body.currentPassword, user)) return res.status(400).json({ error: 'Current password is incorrect' });
    user.passwordSalt = randomBytes(16).toString('hex');
    user.passwordHash = await auth.passwordHash(password, user.passwordSalt); await user.save();
    await Session.deleteMany({ user: user._id });
    await auth.startSession(req, res, user); res.json({ ok: true });
  } catch (err) { next(err); }
});
router.get('/users', auth.requireSession, auth.requireActive, auth.allowRoles('Admin'), async (req, res, next) => {
  try { res.json((await User.find().sort({ createdAt: 1 })).map(auth.publicUser)); } catch (err) { next(err); }
});
router.patch('/users/:id', auth.requireSession, auth.requireActive, auth.allowRoles('Admin'), async (req, res, next) => {
  try {
    if (!['Admin', 'Yard Manager', 'Dispatcher'].includes(req.body.role) || typeof req.body.active !== 'boolean') return res.status(400).json({ error: 'Choose a valid role and access status' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.ownerSlot || String(user._id) === String(req.user._id)) return res.status(400).json({ error: 'You cannot change the owner or your own access' });
    user.role = req.body.role; user.active = req.body.active; await user.save();
    if (!user.active) await Session.deleteMany({ user: user._id });
    res.json(auth.publicUser(user));
  } catch (err) { next(err); }
});
module.exports = router;
