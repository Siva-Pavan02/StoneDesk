const { randomBytes, createHash } = require('node:crypto');
const { Redis } = require('@upstash/redis');

// Short-lived, server-side record of a verified Google identity that still needs
// StoneDesk signup or password linking. The browser only holds an opaque ticket,
// never a Supabase access or refresh token. Upstash Redis keeps tickets shared
// across serverless instances; the in-memory store is for development and tests.
const TTL_SECONDS = 600;
const PREFIX = 'stonedesk:google-ticket:';
const MEMORY_LIMIT = 10000;
const memory = new Map();
let redis = null;

const failure = (message, status) => Object.assign(new Error(message), { status, safeAuthError: true });
const expired = () => failure('Google sign-in expired. Please continue with Google again.', 401);
const unavailable = () => failure('Google sign-in is temporarily unavailable. Please retry.', 503);
const distributedRequired = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const keyFor = ticket => PREFIX + createHash('sha256').update(ticket).digest('hex');
const validTicket = ticket => typeof ticket === 'string' && /^[A-Za-z0-9_-]{43}$/.test(ticket);

function redisClient() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// Runs the Redis operation, or the memory fallback outside production.
async function withStore(distributed, local) {
  const client = redisClient();
  if (client) {
    try { return await distributed(client); } catch { if (distributedRequired()) throw unavailable(); }
  } else if (distributedRequired()) throw unavailable();
  return local();
}

function pruneMemory() {
  const now = Date.now();
  for (const [key, entry] of memory) if (entry.until <= now) memory.delete(key);
}

async function issue({ email, supabaseUserId }) {
  const ticket = randomBytes(32).toString('base64url');
  const key = keyFor(ticket), value = { email, supabaseUserId };
  await withStore(client => client.set(key, value, { ex: TTL_SECONDS }), () => {
    pruneMemory();
    if (memory.size >= MEMORY_LIMIT) throw unavailable();
    memory.set(key, { value, until: Date.now() + TTL_SECONDS * 1000 });
  });
  return ticket;
}

// Reads without consuming, so a mistyped link password does not end the attempt.
async function read(ticket) {
  if (!validTicket(ticket)) throw expired();
  const key = keyFor(ticket);
  const value = await withStore(client => client.get(key), () => {
    pruneMemory();
    return memory.get(key)?.value ?? null;
  });
  if (!value || typeof value.email !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.supabaseUserId || '')) throw expired();
  return { email: value.email, supabaseUserId: value.supabaseUserId };
}

// Called after signup or linking succeeds. Best effort: the ticket expires anyway,
// and failing here must not undo an account that was already created.
async function consume(ticket) {
  if (!validTicket(ticket)) return;
  const key = keyFor(ticket);
  try { await withStore(client => client.del(key), () => memory.delete(key)); } catch { /* expires on its own */ }
}

module.exports = { issue, read, consume, TTL_SECONDS };
