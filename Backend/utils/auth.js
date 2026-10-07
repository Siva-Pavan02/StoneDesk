const { randomBytes, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const prisma = require('./prisma');
const { authLimit } = require('./rateLimiter');
const derive = promisify(scrypt);
const cookieName = 'stonedesk_session';
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
  if (token) {
    const tokenHash = hash(token);
    await prisma.session.deleteMany({ where: { tokenHash } });
  }
  res.clearCookie(cookieName, cookieOptions());
}
async function startSession(req, res, user) {
  await endSession(req, res);
  const token = randomBytes(32).toString('hex');
  await prisma.session.create({ data: { tokenHash: hash(token), userId: user.id, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) } });
  res.cookie(cookieName, token, { ...cookieOptions(), maxAge: 12 * 60 * 60 * 1000 });
}
async function requireSession(req, res, next) {
  try {
    const token = tokenFrom(req);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Please sign in to continue' });
    const tokenHash = hash(token);
    const session = await prisma.session.findFirst({ where: { tokenHash, expiresAt: { gt: new Date() } }, include: { user: true } });
    if (!session?.user) return res.status(401).json({ error: 'Please sign in to continue' });
    req.user = session.user;
    next();
  } catch (err) { next(err); }
}
function requireActive(req, res, next) {
  if (!req.user.active) return res.status(403).json({ error: 'Your account access has been paused. Contact your administrator.' });
  next();
}
const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.map(role => role.replace('Yard Manager', 'YardManager')).includes(req.user.role)) return res.status(403).json({ error: 'Your role does not allow this action' });
  next();
};
function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role === 'YardManager' ? 'Yard Manager' : user.role, active: user.active, organizationId: user.organizationId, isOwner: user.role === 'Admin' };
}
function allowedOrigin(origin, req) {
  if (!origin) return true;
  const configured = process.env.APP_ORIGIN;
  if (origin === configured) return true;
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) return false;
    // Dev phones use the Vite proxy on the same LAN origin. They never need
    // a database password or localhost API address in their browser.
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || origin === `${req.protocol || 'http'}://${req.get?.('host')}`;
  } catch { return false; }
}

module.exports = { passwordHash, verifyPassword, startSession, endSession, requireSession, requireActive, allowRoles, publicUser, allowedOrigin, authLimit };
