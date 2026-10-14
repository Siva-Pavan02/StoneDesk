import { request } from './pilotApi.js';

const pendingKey = 'stonedesk.google.pending';
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

export const EMBEDDED_BROWSER_MESSAGE = 'Google sign-in does not work inside in-app browsers. Open this page in Chrome or Safari, or use email & password.';

// Google blocks OAuth in embedded webviews (error "disallowed_useragent") and the
// Identity Services guide notes sign-in is disabled there. Detect the common
// in-app browsers so users get a clear next step instead of a Google error page.
export function isEmbeddedBrowser(userAgent = globalThis.navigator?.userAgent || '') {
  if (/\b(FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|MicroMessenger|LinkedInApp|Snapchat|Twitter|WhatsApp)\b/i.test(userAgent)) return true;
  // Android System WebView marks itself with "; wv)".
  if (/Android.*;\s*wv\)/.test(userAgent)) return true;
  // iOS WKWebView: an iPhone/iPad WebKit agent without the "Safari/" token (Chrome, Firefox and Edge on iOS keep it).
  return /\b(iPhone|iPad|iPod)\b/.test(userAgent) && /AppleWebKit/.test(userAgent) && !/Safari\//.test(userAgent);
}

export async function beginGoogleSignIn({ signal, userAgent } = {}) {
  if (isEmbeddedBrowser(userAgent)) throw new Error(EMBEDDED_BROWSER_MESSAGE);
  const { url } = await request('/auth/google/config');
  const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
  const state = encode(crypto.getRandomValues(new Uint8Array(24)));
  const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  // Abandoned attempt: no pending state, no redirect. No await follows this check.
  if (signal?.aborted) return;
  sessionStorage.setItem(pendingKey, JSON.stringify({ verifier, state, started: Date.now() }));
  const redirect = new URL('/', window.location.origin);
  redirect.searchParams.set('google_callback', state);
  const authorize = new URL('/auth/v1/authorize', url);
  authorize.search = new URLSearchParams({ provider: 'google', redirect_to: redirect.href, code_challenge: challenge, code_challenge_method: 's256' });
  window.location.assign(authorize.href);
}

// A single promise avoids exchanging the one-use code twice under React StrictMode.
let completion;
export function finishGoogleSignIn() {
  if (completion) return completion;
  const params = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const providerError = params.get('error') || fragment.get('error');
  if (!params.has('code') && !providerError && !params.has('google_callback')) return Promise.resolve(null);
  completion = (async () => {
    const raw = sessionStorage.getItem(pendingKey);
    sessionStorage.removeItem(pendingKey);
    window.history.replaceState(null, '', '/');
    let pending;
    try { pending = JSON.parse(raw); } catch { /* handled below */ }
    if (providerError) {
      // Never display provider descriptions verbatim: they can contain sensitive data.
      const code = params.get('error_code') || fragment.get('error_code');
      const messages = {
        bad_oauth_callback: 'Google did not complete sign-in. Please try again.',
        bad_oauth_state: 'Google sign-in expired. Please start again from this tab.',
        provider_disabled: 'Google sign-in is disabled in Supabase. Ask your administrator to enable it.',
        signup_disabled: 'New Google accounts are disabled in Supabase. Ask your administrator to enable sign-ups.',
        unexpected_failure: 'Supabase could not complete Google sign-in. Check the Supabase Auth logs.',
        server_error: 'Supabase could not complete Google sign-in. Check the Supabase Auth logs.'
      };
      throw new Error(messages[code] || messages[providerError] || 'Google sign-in was cancelled or rejected. Please try again.');
    }
    if (!pending || !Number.isFinite(pending.started) || Date.now() - pending.started > 15 * 60 * 1000 ||
      (params.has('google_callback') && pending.state !== params.get('google_callback'))) {
      throw new Error('Google sign-in expired. Start again from the same browser tab and website address.');
    }
    // Supabase may return to its configured Site URL without our optional marker.
    // The stored PKCE verifier still binds the returned code to this browser tab.
    if (!params.get('code')) throw new Error('Google sign-in returned without a code. Check the Supabase redirect URL configuration.');
    return request('/auth/google/exchange', { method: 'POST', body: { code: params.get('code'), verifier: pending.verifier } });
  })();
  return completion;
}
