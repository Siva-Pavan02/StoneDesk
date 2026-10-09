const failure = (message, status = 401) => Object.assign(new Error(message), { status, safeAuthError: true });

function configuration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw failure('Google sign-in is not configured on the server yet.', 503);
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.username || parsed.password) throw failure('Invalid Supabase server configuration.', 503);
  if (!key.startsWith('sb_publishable_')) throw failure('Configure a Supabase publishable API key.', 503);
  return { url: parsed.origin, key };
}

async function authRequest(path, options = {}) {
  const { url, key } = configuration();
  let response;
  try {
    response = await fetch(`${url}/auth/v1${path}`, {
      ...options, headers: { apikey: key, 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(10000), redirect: 'error'
    });
  } catch { throw failure('Google sign-in could not reach Supabase. Please try again.', 503); }
  if (!response.ok) throw failure('Google sign-in expired or was rejected. Please try again.');
  return response.json();
}

async function verifiedGoogleUser(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 12000) throw failure('Please sign in with Google again.');
  const user = await authRequest('/user', { headers: { Authorization: `Bearer ${token}` } });
  const email = user.email?.trim().toLowerCase();
  // Only server-validated identity data can establish ownership of an email.
  // Never accept user_metadata, a decoded JWT, or an email supplied by the browser.
  const identity = user.identities?.find(item => item.provider === 'google' &&
    item.identity_data?.email?.toLowerCase() === email && item.identity_data?.email_verified === true);
  if (!user.id || !email || !user.email_confirmed_at || !identity) throw failure('A verified Google email is required.');
  if (!/^[0-9a-f-]{36}$/i.test(user.id)) throw failure('Invalid Google identity.');
  return { email, supabaseUserId: user.id };
}

async function exchange(code, verifier) {
  if (typeof code !== 'string' || !code || code.length > 2048 || typeof verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) throw failure('Invalid Google sign-in response.', 400);
  const result = await authRequest('/token?grant_type=pkce', { method: 'POST', body: JSON.stringify({ auth_code: code, code_verifier: verifier }) });
  const identity = await verifiedGoogleUser(result.access_token);
  return { ...identity, accessToken: result.access_token };
}

module.exports = { configuration, verifiedGoogleUser, exchange };
