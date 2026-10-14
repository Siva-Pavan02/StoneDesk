const { createClient } = require('@supabase/supabase-js');
const { supabaseSecretKey } = require('./supabaseKeys');

// Only remove the requesting user's linked Auth identity, never teammates.
// Keep the application record and session if Auth cleanup fails, for retry.
module.exports = async function deleteAuthUser(user) {
  if (!user.supabaseUserId) return;
  const fail = message => Object.assign(new Error(message), { status: 503, safeAuthError: true });
  const key = supabaseSecretKey('admin');
  if (!process.env.SUPABASE_URL || !key) {
    throw fail('Account deletion is unavailable until the server Supabase secret key is configured.');
  }
  const client = createClient(process.env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) }
  });
  const { error } = await client.auth.admin.deleteUser(user.supabaseUserId);
  // A previous attempt may have completed Auth cleanup before a database error.
  if (error && !(error.status === 404 && error.code === 'user_not_found')) {
    throw fail('Supabase account cleanup could not finish. Please retry deletion.');
  }
};
