const { bad } = require('./pilotCalculations');
const summaryFields = { id: true, loadingListNumber: true, buyerDestination: true, supervisor: true, status: true, date: true, updatedAt: true, createdAt: true };
function loadingListQuery(query) {
  if (query.limit !== undefined && (typeof query.limit !== 'string' || !/^[1-9]\d?$/.test(query.limit) || Number(query.limit) > 50)) bad('Limit must be between 1 and 50');
  if (query.cursor !== undefined && (typeof query.cursor !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(query.cursor))) bad('Invalid cursor');
  if (query.status !== undefined && !['Draft', 'Loading', 'Completed'].includes(query.status)) bad('Invalid status');
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 120)) bad('Search must be at most 120 characters');
  return { limit: Number(query.limit || 20), cursor: query.cursor, status: query.status, search: query.q?.trim() || '' };
}
module.exports = { loadingListQuery, summaryFields };
