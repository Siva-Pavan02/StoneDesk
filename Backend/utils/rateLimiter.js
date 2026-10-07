const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');

let ratelimit = null;
let hasWarned = false;

function getRatelimiter() {
  if (ratelimit) return ratelimit;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    if (!hasWarned && process.env.NODE_ENV !== 'test') {
      console.warn('Upstash Redis credentials not configured, falling back to in-memory rate limiter');
      hasWarned = true;
    }
    return null;
  }
  
  const redis = new Redis({ url, token });
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '15 m'),
    analytics: true,
    prefix: 'stonedesk:ratelimit'
  });
  
  return ratelimit;
}

function authLimit(req, res, next) {
  const limiter = getRatelimiter();
  
  if (!limiter) {
    return fallbackRateLimit(req, res, next);
  }
  
  const key = `${req.ip}:${req.path}`;
  
  limiter.limit(key).then(({ success, limit, remaining, reset }) => {
    res.set('X-RateLimit-Limit', limit);
    res.set('X-RateLimit-Remaining', remaining);
    res.set('X-RateLimit-Reset', Math.ceil(reset / 1000));
    
    if (!success) {
      res.set('Retry-After', '900');
      return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    }
    next();
  }).catch(err => {
    console.error('Rate limiter error:', err);
    fallbackRateLimit(req, res, next);
  });
}

const attempts = new Map();
function fallbackRateLimit(req, res, next) {
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

module.exports = { authLimit };