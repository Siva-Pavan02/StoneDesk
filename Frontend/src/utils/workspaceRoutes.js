// Pure workspace routing and navigation helpers (no React), so node --test can import them.

export const NEW_LOAD_ROUTE = 'load';

// Legacy hashes kept working; navigate() and route() both resolve through resolveRoute().
// Products, trucks and destinations used to have their own pages; products are now managed from
// the New load product list, and trucks/destinations are remembered as New load suggestions.
export const legacyRoutes = {
  monitor: 'entries?status=Dispatched',
  invoices: 'entries',
  references: NEW_LOAD_ROUTE,
  products: NEW_LOAD_ROUTE,
  'products/trucks': NEW_LOAD_ROUTE,
  'products/destinations': NEW_LOAD_ROUTE,
};

// Resolve a raw hash body (without '#') to the route to render.
export function resolveRoute(hash) {
  const raw = hash || 'home';
  const next = Object.hasOwn(legacyRoutes, raw) ? legacyRoutes[raw] : undefined;
  if (next) return { route: next, replaced: true };
  // Any other old products/... or products?... hash also lands on New load.
  if (raw.split(/[/?]/)[0] === 'products') return { route: NEW_LOAD_ROUTE, replaced: true };
  return { route: raw, replaced: false };
}

// [key, icon, label, adminOnly]
export const NAVIGATION = [
  ['home', 'home', 'Dashboard'],
  ['entries', 'loads', 'Loading entries'],
  ['profile', 'user', 'Profile', true],
  ['settings', 'settings', 'Settings'],
];

export const visibleNavigation = role =>
  NAVIGATION.filter(([, , , adminOnly]) => !adminOnly || role === 'Admin');

// Which sidebar key is highlighted for a view/current value.
export function navigationKey(view) {
  const page = String(view || '').split(/[/?]/)[0];
  return page === 'requirements' ? 'entries' : page;
}

// After a successful profile save: route to go to, or null to stay on #profile.
// Without products the admin goes straight to New load, which offers to add the first product.
export const profileSaveTarget = data => (data?.stoneRates?.length ? null : NEW_LOAD_ROUTE);
