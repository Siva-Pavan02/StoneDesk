export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
export const QUARRY_ID = 'unit_04';
export function logoUrl(path) {
  return path ? `${API_BASE.replace(/\/api\/?$/, '')}${path}` : undefined;
}
export async function request(path, { method = 'GET', body, file } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: file ? { 'Content-Type': file.type } : body ? { 'Content-Type': 'application/json' } : undefined,
    body: file || (body ? JSON.stringify(body) : undefined)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !['/auth/me', '/auth/login'].includes(path)) window.dispatchEvent(new Event('session-expired'));
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  if (!data) throw new Error('The server did not return a record');
  return data;
}
export const settingsPath = `/master-settings/${QUARRY_ID}`;
