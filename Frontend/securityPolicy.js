// The production HTML carries CSP even when hosted separately from the API.
// Style attributes remain allowed for React layout and print/export libraries.
export function contentPolicy(apiBase = '') {
  const base = apiBase.trim();
  // A host source inherits the document scheme, just like a //host API URL.
  const remote = base.startsWith('//') ? new URL(`https:${base}`).host : /^https?:\/\//i.test(base) ? new URL(base).origin : '';
  return [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: blob:" + (remote ? ` ${remote}` : ''),
    "connect-src 'self'" + (remote ? ` ${remote}` : ''),
    "object-src 'none'", "base-uri 'none'", "form-action 'self'",
  ].join('; ');
}
export function securityHeaders(apiBase) {
  return {
    'Content-Security-Policy': contentPolicy(apiBase) + "; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}
