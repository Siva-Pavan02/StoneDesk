// Filter buttons for #entries. The list is server-filtered by status and cursor
// paginated, so the buttons carry no counts: the rows in state are only one page.
export const LOAD_STATUSES = ["Draft", "Dispatched", "Delivered"];
export const LOAD_FILTERS = [
  ["all", "All"],
  ["Draft", "Draft"],
  ["Dispatched", "In transit"],
  ["Delivered", "Delivered"],
];
