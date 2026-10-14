// Shared by the real API and the mock so auth-method semantics cannot drift.
// No imports: the mock requires this without constructing a Prisma client.

// passwordLogin is undefined for pre-migration rows and old mock data: treat as true.
function authFlags(user) {
  return {
    hasGoogle: Boolean(user?.supabaseUserId),
    hasPassword: user?.passwordLogin !== false
  };
}

// A Password_Free_Account (Google signup that never set a password) can change
// its password without supplying a current one. Everything else — including a
// null/undefined user — fails closed and still requires the current password.
function requiresCurrentPassword(user) {
  return !(user?.supabaseUserId && user.passwordLogin === false);
}

// Hash routing: the token never reaches a server log or Referer header.
function buildResetUrl(appOrigin, token, email) {
  return `${String(appOrigin).replace(/\/+$/, '')}/#reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

module.exports = { authFlags, requiresCurrentPassword, buildResetUrl };
