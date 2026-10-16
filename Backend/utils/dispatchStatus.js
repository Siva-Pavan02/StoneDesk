// Delivery status rules for PATCH /dispatches/:id/status, shared by the real
// controller and the mock server so the two cannot drift.
const STATUS_TARGETS = ['Delivered', 'Dispatched'];

const INVALID = { status: 400, error: 'Invalid status transition' };

// Returns null when the change is allowed, otherwise { status, error }.
// Dispatched -> Delivered: any role that passed the route (Admin, Dispatcher).
// Delivered -> Dispatched: Admin only. Everything else, including going back to Draft, is 400.
function statusTransitionError(from, to, role) {
  if (from === 'Dispatched' && to === 'Delivered') return null;
  if (from === 'Delivered' && to === 'Dispatched') {
    return role === 'Admin' ? null : { status: 403, error: 'Only an admin can change a delivered load\'s status' };
  }
  return INVALID;
}

module.exports = { STATUS_TARGETS, statusTransitionError };
