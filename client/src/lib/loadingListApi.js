export const fetchLoadingLists = async () => {
  const response = await fetch('/api/loading-lists');
  if (!response.ok) throw new Error('Failed to fetch loading lists');
  return response.json();
};

export const createLoadingList = async (data) => {
  const response = await fetch('/api/loading-lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to create loading list');
  return response.json();
};

export const updateLoadingList = async (id, data) => {
  const response = await fetch(`/api/loading-lists/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update loading list');
  return response.json();
};

export const deleteLoadingList = async (id) => {
  const response = await fetch(`/api/loading-lists/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete loading list');
  return response.json();
};
