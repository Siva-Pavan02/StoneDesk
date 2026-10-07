const { randomBytes } = require('node:crypto');

const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
const UPLOADS_CSP = "default-src 'none'; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'";

function generateNonce() {
  return randomBytes(16).toString('base64');
}

module.exports = (req, res, next) => {
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;
  
  const isApiRoute = req.path.startsWith('/api/');
  const isUploadsRoute = req.path.startsWith('/uploads/');
  
  let csp = API_CSP;
  if (isUploadsRoute) csp = UPLOADS_CSP;
  
  if (isApiRoute || isUploadsRoute) {
    csp += `; script-src 'nonce-${nonce}' 'strict-dynamic'`;
  }
  
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': csp,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  });
  next();
};

module.exports.generateNonce = generateNonce;