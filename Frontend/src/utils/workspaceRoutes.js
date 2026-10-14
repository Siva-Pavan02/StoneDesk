// Pure workspace routing and navigation helpers (no React), so node --test can import them.

// Legacy hashes kept working; navigate() and route() both resolve through this map.
export const legacyRoutes = {
  monitor: 'entries?status=Dispatched',
  invoices: 'entries',
  references: 'products/trucks',
};

// Resolve a raw hash body (without '#') to the route to render.
export function resolveRoute(hash) {
  const raw = hash || 'home';
  const next = Object.hasOwn(legacyRoutes, raw) ? legacyRoutes[raw] : undefined;
  return next ? { route: next, replaced: true } : { route: raw, replaced: false };
}

export const PRODUCTS_TABS = ['products', 'trucks', 'destinations'];

export const productsTabRoute = tab => (tab === 'products' ? 'products' : `products/${tab}`);

// Total: any view maps to a tab; unknown or non-products views fall back to the Products tab.
export function productsTab(view) {
  const path = String(view || '').split('?')[0];
  if (!path.startsWith('products/')) return 'products';
  const rest = path.slice('products/'.length);
  return PRODUCTS_TABS.includes(rest) && rest !== 'products' ? rest : 'products';
}

// [key, icon, en, te, adminOnly]
export const NAVIGATION = [
  ['home', 'home', 'Dashboard', 'డ్యాష్‌బోర్డ్'],
  ['entries', 'loads', 'Loading entries', 'లోడ్ వివరాలు'],
  ['products', 'products', 'Products & places', 'రకాలు మరియు ప్రదేశాలు', true],
  ['profile', 'user', 'Profile settings', 'ప్రొఫైల్ సెట్టింగ్స్', true],
  ['settings', 'settings', 'Settings', 'సెట్టింగ్స్'],
];

export const visibleNavigation = role =>
  NAVIGATION.filter(([, , , , adminOnly]) => !adminOnly || role === 'Admin');

// Which sidebar key is highlighted for a view/current value.
export function navigationKey(view) {
  const page = String(view || '').split(/[/?]/)[0];
  return page === 'requirements' ? 'entries' : page;
}

// After a successful profile save: route to go to, or null to stay on #profile.
export const profileSaveTarget = data => (data?.stoneRates?.length ? null : 'products');
