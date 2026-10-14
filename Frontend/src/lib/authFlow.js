const HASH = '#reset-password';

// Returns null when the URL is not a reset link, else { token, email } (empty strings when missing).
export function readResetLink({ hash = '', pathname = '/', search = '' } = {}) {
  let query = null;
  if (hash === HASH || hash.startsWith(`${HASH}?`)) query = hash.slice(HASH.length + 1);
  else if (pathname === '/reset-password') query = search.replace(/^\?/, '');
  if (query === null) return null;
  const params = new URLSearchParams(query);
  return { token: params.get('token') || '', email: (params.get('email') || '').trim() };
}

// Parse once per page load and strip the secret from the address bar.
// Memoized like finishGoogleSignIn so StrictMode's double initializer is harmless.
let consumed;
export function consumeResetLink(win = window) {
  if (consumed !== undefined) return consumed;
  consumed = readResetLink(win.location);
  if (consumed) win.history.replaceState(null, '', '/');
  return consumed;
}

// Hash-only navigation in an already-loaded tab. Stateless: safe to call on every
// hashchange; after stripping, a repeat call finds no link and returns null.
export function takeResetLinkFromHash(win = window) {
  const link = readResetLink({ hash: win.location.hash });
  if (link) win.history.replaceState(null, '', '/');
  return link;
}

export const validResetLink = link => /^[a-f0-9]{64}$/i.test(link?.token || '') && Boolean(link?.email);

// App routing precedence (see decision table).
export function appView({ reset, checking, user, welcome }) {
  if (reset) return 'reset';
  if (checking) return 'loading';
  if (!user || welcome) return 'landing';
  if (!user.active) return 'pending';
  return 'workspace';
}

// AuthDialog screen precedence (Fix 5).
export function authView({ mode, method, googleSignup, forgot }) {
  if (!mode) return 'closed';
  if (googleSignup?.needsLink) return 'link';
  if (googleSignup) return 'google-signup';
  if (method === 'google') return 'google';
  if (method === 'email') return mode === 'login' && forgot ? 'forgot' : 'email';
  return 'chooser';
}
