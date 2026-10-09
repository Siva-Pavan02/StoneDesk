// Loading-list counts. balance = required - loaded; a negative balance is excess.
export const pending = req => Math.max(req.requiredQuantity - req.loadedQuantity, 0);
export const excess = req => Math.max(req.loadedQuantity - req.requiredQuantity, 0);
export function loadingTotals(requirements) {
  return requirements.reduce((t, r) => ({ required: t.required + r.requiredQuantity, loaded: t.loaded + r.loadedQuantity, pending: t.pending + pending(r), excess: t.excess + excess(r) }),
    { required: 0, loaded: 0, pending: 0, excess: 0 });
}
