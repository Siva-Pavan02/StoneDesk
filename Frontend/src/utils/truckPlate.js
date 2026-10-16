// Truck plate helpers used by the New load truck suggestions. Logic copied from SettingsScreen.jsx;
// Backend/utils/savedReferences.js has a port that must match.

export const compactPlate = value => value.toUpperCase().replace(/[\s.-]/g, '');

// Indian registration: TN 01 AB 1234, or Bharat series 22 BH 1234 AA. Returns formatted plate or null.
export function formatTruckNumber(value) {
  const plate = compactPlate(value);
  const standard = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{4})$/.exec(plate);
  if (standard) return [standard[1], standard[2].padStart(2, '0'), standard[3], standard[4]].filter(Boolean).join(' ');
  const bharat = /^(\d{2})BH(\d{4})([A-Z]{1,2})$/.exec(plate);
  return bharat ? `${bharat[1]} BH ${bharat[2]} ${bharat[3]}` : null;
}

// '' (ok or blank) | 'invalid' | 'duplicate'
export function truckPlateError(value, items) {
  if (!value.trim()) return '';
  const formatted = formatTruckNumber(value);
  if (!formatted) return 'invalid';
  return items.some(item => compactPlate(item) === compactPlate(formatted)) ? 'duplicate' : '';
}
