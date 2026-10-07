export async function getMasterSettings(quarryId) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const res = await fetch(`${baseUrl}/master-settings/${quarryId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch master settings');
  return res.json();
}

function getBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || '/api';
}

export async function addTruck(quarryId, truckNumber) {
  const res = await fetch(`${getBaseUrl()}/master-settings/${quarryId}/trucks`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ truckNumber })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to add truck');
  }
  return res.json();
}

export async function removeTruck(quarryId, truckNumber) {
  const res = await fetch(`${getBaseUrl()}/master-settings/${quarryId}/trucks/${truckNumber}`, {
    credentials: 'include',
    method: 'DELETE'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to remove truck');
  }
  return res.json();
}

export async function addDestination(quarryId, destination) {
  const res = await fetch(`${getBaseUrl()}/master-settings/${quarryId}/destinations`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destination })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to add destination');
  }
  return res.json();
}

export async function removeDestination(quarryId, destination) {
  const res = await fetch(`${getBaseUrl()}/master-settings/${quarryId}/destinations/${encodeURIComponent(destination)}`, {
    credentials: 'include',
    method: 'DELETE'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to remove destination');
  }
  return res.json();
}

export async function addStoneRate(quarryId, data) {
  const res = await fetch(`${getBaseUrl()}/master-settings/${quarryId}/stone-rates`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to add stone rate');
  }
  return res.json();
}

export async function updateStoneRate(quarryId, rateId, data) {
  const res = await fetch(`${getBaseUrl()}/master-settings/${quarryId}/stone-rates/${rateId}`, {
    credentials: 'include',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update stone rate');
  }
  return res.json();
}

export async function removeStoneRate(quarryId, rateId) {
  const res = await fetch(`${getBaseUrl()}/master-settings/${quarryId}/stone-rates/${rateId}`, {
    credentials: 'include',
    method: 'DELETE'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to remove stone rate');
  }
  return res.json();
}

export async function updateRoyalty(quarryId, defaultRoyaltyFee) {
  const res = await fetch(`${getBaseUrl()}/master-settings/${quarryId}/royalty`, {
    credentials: 'include',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ defaultRoyaltyFee })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update royalty');
  }
  return res.json();
}

export async function getAllDispatches() {
  const res = await fetch(`${getBaseUrl()}/dispatches`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to get dispatches');
  return res.json();
}

export async function createDispatch(payload) {
  const res = await fetch(`${getBaseUrl()}/dispatches`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to create dispatch');
  return res.json();
}

export async function updateDispatch(id, payload) {
  const res = await fetch(`${getBaseUrl()}/dispatches/${id}`, {
    credentials: 'include',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to update dispatch');
  return res.json();
}

export async function finalizeDispatch(id) {
  const res = await fetch(`${getBaseUrl()}/dispatches/${id}/finalize`, {
    credentials: 'include',
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to finalize dispatch');
  return res.json();
}

export async function getDispatch(id) {
  const res = await fetch(`${getBaseUrl()}/dispatches/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to get dispatch');
  return res.json();
}
