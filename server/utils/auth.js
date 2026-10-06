const { randomBytes, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const Session = require('../models/Session');
require('../models/User');
const derive = promisify(scrypt);
const cookieName = 'granitesync_session';
const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
const hash = token => createHash('sha256').update(token).digest('hex');
const tokenFrom = req => (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);

async function passwordHash(password, salt) {
  return (await derive(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })).toString('hex');
}
async function verifyPassword(password, user) {
  const result = await passwordHash(password, user?.passwordSalt || '00000000000000000000000000000000');
  return timingSafeEqual(Buffer.from(result, 'hex'), Buffer.from(user?.passwordHash || '0'.repeat(128), 'hex')) && Boolean(user);
}
async function endSession(req, res) {
  const token = tokenFrom(req);
  if (token) await Session.deleteOne({ tokenHash: hash(token) });
  res.clearCookie(cookieName, cookieOptions());
}
async function startSession(req, res, user) {
  await endSession(req, res);
  const token = randomBytes(32).toString('hex');
  await Session.create({ tokenHash: hash(token), user: user._id, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) });
  res.cookie(cookieName, token, { ...cookieOptions(), maxAge: 12 * 60 * 60 * 1000 });
}
async function requireSession(req, res, next) {
  try {
    const token = tokenFrom(req);
    const session = token && /^[a-f0-9]{64}$/.test(token) && await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } }).populate('user');
    if (!session?.user) return res.status(401).json({ error: 'Please sign in to continue' });
    req.user = session.user;
    next();
  } catch (err) { next(err); }
}
function requireActive(req, res, next) {
  if (!req.user.active) return res.status(403).json({ error: 'Your account is waiting for administrator approval' });
  next();
}
const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Your role does not allow this action' });
  next();
};
function publicUser(user) {
  return { _id: user._id, name: user.name, email: user.email, role: user.role, active: user.active, isOwner: Boolean(user.ownerSlot) };
}
function allowedOrigin(origin, req) {
  if (!origin) return true;
  const configured = process.env.APP_ORIGIN;
  if (configured) return origin === configured;
  if (process.env.NODE_ENV === 'production') return false;
  return ['http://127.0.0.1:5178', 'http://localhost:5178', 'http://127.0.0.1:5173', 'http://localhost:5173', `http://${req.get('host')}`].includes(origin);
}
// ponytail: one server process; use a shared rate limiter before running multiple instances.
const attempts = new Map();
function authLimit(req, res, next) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = `${req.ip}:${req.path}`;
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  if (++entry.count > 20 || attempts.size >= 10000) {
    res.set('Retry-After', '900');
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }
  attempts.set(key, entry); next();
}
module.exports = { passwordHash, verifyPassword, startSession, endSession, requireSession, requireActive, allowRoles, publicUser, allowedOrigin, authLimit };
