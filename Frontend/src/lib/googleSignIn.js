import { request } from './pilotApi.js';

const pendingKey = 'stonedesk.google.pending';
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

export async function beginGoogleSignIn() {
  const { url } = await request('/auth/google/config');
  const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
  const state = encode(crypto.getRandomValues(new Uint8Array(24)));
  const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
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
  if (!params.has('google_callback')) return Promise.resolve(null);
  completion = (async () => {
    const raw = sessionStorage.getItem(pendingKey);
    sessionStorage.removeItem(pendingKey);
    window.history.replaceState(null, '', '/');
    let pending;
    try { pending = JSON.parse(raw); } catch { /* handled below */ }
    if (!pending || pending.state !== params.get('google_callback') || Date.now() - pending.started > 15 * 60 * 1000) throw new Error('Google sign-in expired. Please try again on this device.');
    if (params.has('error') || !params.get('code')) throw new Error('Google sign-in was cancelled or could not finish. Please try again.');
    return request('/auth/google/exchange', { method: 'POST', body: { code: params.get('code'), verifier: pending.verifier } });
  })();
  return completion;
}
