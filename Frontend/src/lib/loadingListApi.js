import { request } from './pilotApi.js';
export const fetchLoadingLists = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request('/loading-lists' + (qs ? '?' + qs : ''));
};
export const fetchLoadingList = id => request('/loading-lists/' + encodeURIComponent(id));
export const createLoadingList = body => request('/loading-lists', { method: 'POST', body });
export const updateLoadingList = (id, body) => request('/loading-lists/' + encodeURIComponent(id), { method: 'PUT', body });
export const deleteLoadingList = id => request('/loading-lists/' + encodeURIComponent(id), { method: 'DELETE' });
