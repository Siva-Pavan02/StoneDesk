import { request } from './pilotApi.js';
export const fetchLoadingLists = () => request('/loading-lists');
export const createLoadingList = body => request('/loading-lists', { method: 'POST', body });
export const updateLoadingList = (id, body) => request('/loading-lists/' + encodeURIComponent(id), { method: 'PUT', body });
export const deleteLoadingList = id => request('/loading-lists/' + encodeURIComponent(id), { method: 'DELETE' });
