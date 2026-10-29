export const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export function logoUrl(path) {
  return path ? `${API_BASE.replace(/\/api\/?$/, '')}${path}` : undefined;
}

const pendingReads = new Map();

export function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    pendingReads.clear();
    return sendRequest(path, { ...options, method });
  }
  if (pendingReads.has(path)) return pendingReads.get(path);
  const promise = sendRequest(path, options).finally(() => {
    if (pendingReads.get(path) === promise) pendingReads.delete(path);
  });
  pendingReads.set(path, promise);
  return promise;
}

async function sendRequest(path, { method = 'GET', body, file } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(file ? { 'Content-Type': file.type } : body ? { 'Content-Type': 'application/json' } : {})
    },
    body: file || (body ? JSON.stringify(body) : undefined)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  if (!data) throw new Error('The server did not return a record');
  return data;
}

export function settingsPath(organizationId) {
  return `/master-settings/${encodeURIComponent(organizationId)}`;
}

export function getInvoicePayments(dispatchId) {
  return request(`/dispatches/${encodeURIComponent(dispatchId)}/payments`);
}

export function createInvoicePayment(dispatchId, payload) {
  return request(`/dispatches/${encodeURIComponent(dispatchId)}/payments`, {
    method: 'POST',
    body: payload
  });
}

export function deleteDispatch(id) {
  return request(`/dispatches/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function reviseDispatch(id, body) {
  return request(`/dispatches/${encodeURIComponent(id)}/revise`, { method: 'PUT', body });
}
