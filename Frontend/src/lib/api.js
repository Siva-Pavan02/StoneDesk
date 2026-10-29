import { request } from './pilotApi.js';
const settings = id => '/master-settings/' + encodeURIComponent(id);
export const getMasterSettings = id => request(settings(id));
export const removeTruck = (id, truckNumber) => request(settings(id) + '/trucks/' + encodeURIComponent(truckNumber), { method: 'DELETE' });
export const removeDestination = (id, destination) => request(settings(id) + '/destinations/' + encodeURIComponent(destination), { method: 'DELETE' });
export const updateStoneRate = (id, rateId, body) => request(settings(id) + '/stone-rates/' + encodeURIComponent(rateId), { method: 'PUT', body });
export const removeStoneRate = (id, rateId) => request(settings(id) + '/stone-rates/' + encodeURIComponent(rateId), { method: 'DELETE' });
