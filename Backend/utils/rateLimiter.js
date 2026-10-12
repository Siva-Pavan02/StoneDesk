const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');
const { createHash } = require('node:crypto');
let ratelimit = null;
let hasWarned = false;
const route = req => String(req.route?.path || req.path).toLowerCase().replace(/\/+$/, '') || '/';
const unavailable = () => Object.assign(new Error('Sign-in protection is temporarily unavailable. Please retry.'), { status: 503, safeAuthError: true });
function getRatelimiter() {
  if (ratelimit) return ratelimit;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  ratelimit = new Ratelimit({ redis: new Redis({ url, token }), limiter: Ratelimit.slidingWindow(20, '15 m'), analytics: false, prefix: 'stonedesk:ratelimit', timeout: 3000 });
  return ratelimit;
}
const attempts = new Map();
function localLimit(key) {
  const now = Date.now();
  for (const [k, value] of attempts) if (value.until <= now) attempts.delete(k);
  const entry = attempts.get(key) || { count: 0, until: now + 900000 };
  const success = ++entry.count <= 20 && (attempts.has(key) || attempts.size < 10000);
  if (success) attempts.set(key, entry);
  return { success, limit: 20, remaining: Math.max(0, 20 - entry.count), reset: entry.until };
}
async function limit(key) {
  try {
    const limiter = getRatelimiter();
    if (!limiter) throw unavailable();
    const result = await limiter.limit(key);
    if (result.reason === 'timeout') throw unavailable();
    return result;
  } catch {
    if (!hasWarned) { console.error('Distributed authentication rate limiting unavailable. Check Upstash configuration.'); hasWarned = true; }
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw unavailable();
    return localLimit(key);
  }
}
function rejected() { return Object.assign(new Error('Too many attempts. Try again in 15 minutes.'), { status: 429 }); }
async function limitAccount(email) {
  if (typeof email !== 'string' || email.length > 254) return;
  const key = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  if (!(await limit('account:' + key)).success) throw rejected();
}
async function authLimit(req, res, next) {
  try {
    const result = await limit('ip:' + req.ip + ':' + route(req));
    res.set('X-RateLimit-Limit', result.limit);
    res.set('X-RateLimit-Remaining', result.remaining);
    res.set('X-RateLimit-Reset', Math.ceil(result.reset / 1000));
    if (!result.success) throw rejected();
    // Google account limits use the verified provider identity inside its handlers.
    if (['/login', '/signup', '/forgot-password', '/reset-password'].includes(route(req)) && !(route(req) === '/signup' && req.body?.googleAccessToken)) await limitAccount(req.body?.email);
    next();
  } catch (error) {
    res.set('Retry-After', error.status === 429 ? '900' : '30');
    res.status(error.status || 503).json({ error: error.message });
  }
}
module.exports = { authLimit, limitAccount };
