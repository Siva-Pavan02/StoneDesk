// Display labels for workspace roles. The API and database keep 'Yard Manager' / 'YardManager';
// only the label shown to people changes.
export const ROLE_LABELS = Object.freeze({
  Admin: 'Admin',
  'Yard Manager': 'Manager',
  YardManager: 'Manager',
  Dispatcher: 'Dispatcher',
});

export const roleLabel = role => ROLE_LABELS[role] ?? role;

const ROLE_TONES = Object.freeze({ Admin: 'admin', 'Yard Manager': 'manager', YardManager: 'manager', Dispatcher: 'dispatcher' });

// Colour key for the small role tag in Settings. Unknown roles fall back to the most limited role's colour.
export const roleTone = role => ROLE_TONES[role] ?? 'dispatcher';

const PRODUCT_ADDERS = new Set(['Admin', 'Yard Manager', 'YardManager']);

// Admins and managers can add products. Dispatcher has no product-add permission.
export const canAddProduct = role => PRODUCT_ADDERS.has(role);

// Editing, removing and pricing products stays with the Admin.
export const canManageProducts = role => role === 'Admin';

// Only the Admin can remove saved suggestions (trucks, destinations).
export const canRemoveSuggestions = role => role === 'Admin';
