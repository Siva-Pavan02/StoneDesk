// Mock StoneDesk API. Mimics the real Express API (same routes, validation and
// calculations) but stores data in Backend/mock/mock-data.json instead of Postgres.
// Delete mock-data.json to reset to the seed data. Run with: npm run mock
const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const zxcvbn = require('zxcvbn');
const calc = require('../utils/pilotCalculations');
const { organizationCode } = require('../utils/organizationCode');

const PORT = process.env.MOCK_PORT || 5001;
const DATA_FILE = path.join(__dirname, 'mock-data.json');
const ORG = 'unit_04';
const now = () => new Date().toISOString();

function seed() {
  const inventory = calc.processInventory([{ stoneType: 'Granite', finish: 'Polished', ratePerSqFt: 40.5, measurementRows: [
    { lengthFt: 3, widthFt: 2, quantity: 12, category: 'Regular' },
    { lengthFt: 4, widthFt: 2, quantity: 8, category: 'TOP' }] }]);
  return {
    users: [
      { id: 'user_001', name: 'Mock Admin', email: 'admin@example.test', role: 'Admin', active: true, organizationId: ORG, createdAt: now() },
      { id: 'user_002', name: 'Mock Dispatcher', email: 'dispatcher@example.test', role: 'Dispatcher', active: true, organizationId: ORG, createdAt: now() }
    ],
    settings: {
      id: ORG, organizationId: organizationCode('Original Stone Works'), version: 1, businessName: 'Original Stone Works', address: 'Kadapa, Andhra Pradesh', phone: '+91 98765 43210',
      gstNumber: '', tradeLicense: '', defaultRoyaltyFee: 2500, logoPath: null,
      stoneRates: [
        { id: 'rate_01', stoneType: 'Granite', finish: 'Polished', defaultRate: 40.5 },
        { id: 'rate_02', stoneType: 'Kota', finish: 'Natural', defaultRate: 32 },
        { id: 'rate_03', stoneType: 'Basalt', finish: 'Flamed', defaultRate: 28.75 }
      ],
      savedTrucks: ['AP 37 TA 4312', 'TS 09 AB 1203'],
      savedDestinations: ['Kadapa', 'Tirupati', 'Hyderabad']
    },
    dispatches: [{
      id: 'dispatch_001', organizationId: ORG, clientRequestId: 'seed-request-001', dispatchSlipNumber: 'GS-seed-0001',
      date: '2026-10-06T00:00:00.000Z', supervisor: 'Ramesh Kumar', partyName: 'Venkata Granites',
      logistics: { truckNumber: 'AP 37 TA 4312', buyerDestination: 'Kadapa' }, status: 'Dispatched',
      inventory, summary: calc.totals(inventory, 2500), businessSnapshot: null, createdAt: now(), updatedAt: now()
    }],
    loadingLists: []
  };
}

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return seed(); }
}
const db = load();
function save() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
save();

// The mock has one signed-in session. Logout makes /auth/me return 401 until login/signup.
let session = db.users[0].id;
const currentUser = () => db.users.find(u => u.id === session);
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, organizationId: u.organizationId, createdAt: u.createdAt });

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: true, credentials: true, maxAge: 600 }));
app.use(express.json({ limit: '100kb' }));

const api = express.Router();
api.use((req, res, next) => {
  if (req.is('application/json') && (req.body === null || Array.isArray(req.body) || (req.body !== undefined && typeof req.body !== 'object'))) return res.status(400).json({ error: 'Expected a JSON object' });
  if (req.body === undefined) req.body = {};
  res.set('Cache-Control', 'no-store');
  next();
});

const wrap = fn => (req, res) => {
  try { fn(req, res); }
  catch (err) { res.status(err.status || 500).json({ error: err.message }); }
};
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const requireSession = (req, res, next) => currentUser() ? next() : res.status(401).json({ error: 'Sign in to continue' });
const requireAdmin = (req, res, next) => currentUser().role === 'Admin' ? next() : res.status(403).json({ error: 'You do not have access to this action' });

api.get('/health', (req, res) => res.json({ ok: true, mode: 'mock' }));

// ---- auth ----
function credentials(body = {}, checkStrength = true) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 12 || password.length > 128) fail(400, 'Enter a valid email and a password of 12 to 128 characters');
  const strength = zxcvbn(password);
  if (checkStrength && strength.score < 3) fail(400, 'Password is too weak. ' + (strength.feedback?.warning || 'Use a stronger password with mixed case, numbers, and symbols.'));
  return { email, password };
}
api.post('/auth/signup', wrap((req, res) => {
  const { email } = credentials(req.body);
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const orgId = typeof req.body.organizationId === 'string' ? req.body.organizationId.trim() : '';
  const create = req.body.createOrganization === true || req.body.createOrganization === 'true';
  const businessName = typeof req.body.businessName === 'string' ? req.body.businessName.trim() : '';
  if (!name || name.length > 120) fail(400, 'Enter your name (up to 120 characters)');
  if (create && (!businessName || businessName.length > 120)) fail(400, 'Enter your business name (up to 120 characters)');
  if (!create && !/^[a-zA-Z0-9-]{1,50}$/.test(orgId)) fail(400, 'Enter the organization ID shared by your administrator');
  if (db.users.some(u => u.email === email)) fail(409, 'Unable to create this account. Try signing in.');
  let target = db.settings;
  if (create) {
    // The mock holds a single organization; a new workspace renames and resets it.
    Object.assign(db.settings, { organizationId: organizationCode(businessName), businessName, stoneRates: [], savedTrucks: [], savedDestinations: [] });
    db.dispatches = []; db.loadingLists = [];
  } else if (orgId.toLowerCase() !== db.settings.organizationId.toLowerCase()) fail(404, 'Organization ID is invalid or unavailable. Check it with your administrator.');
  const user = { id: 'user_' + randomUUID().slice(0, 8), name, email, role: create ? 'Admin' : 'Dispatcher', active: true, organizationId: target.id, createdAt: now() };
  if (create) db.users = [user]; else db.users.push(user);
  session = user.id; save();
  res.status(201).json({ user: publicUser(user), organizationCode: db.settings.organizationId });
}));
api.post('/auth/login', wrap((req, res) => {
  const { email } = credentials(req.body, false);
  const user = db.users.find(u => u.email === email && u.active);
  if (!user) fail(401, 'Email or password is incorrect');
  session = user.id;
  res.json({ user: publicUser(user) });
}));
api.post('/auth/logout', (req, res) => { session = null; res.json({ ok: true }); });
api.get('/auth/me', requireSession, (req, res) => res.json({ user: publicUser(currentUser()) }));
api.post('/auth/password', requireSession, wrap((req, res) => {
  credentials({ email: currentUser().email, password: req.body.password });
  if (typeof req.body.currentPassword !== 'string' || req.body.currentPassword.length > 128) fail(400, 'Enter your current password');
  res.json({ ok: true });
}));
api.get('/auth/users', requireSession, requireAdmin, (req, res) => res.json(db.users.map(publicUser)));
api.patch('/auth/users/:id', requireSession, requireAdmin, wrap((req, res) => {
  const role = req.body.role === 'Yard Manager' ? 'YardManager' : req.body.role;
  if (!['Admin', 'YardManager', 'Dispatcher'].includes(role) || typeof req.body.active !== 'boolean') fail(400, 'Choose a valid role and access status');
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) fail(404, 'Account not found');
  if (user.role === 'Admin' || user.id === session) fail(400, 'You cannot change the owner or your own access');
  Object.assign(user, { role, active: req.body.active }); save();
  res.json(publicUser(user));
}));
api.post('/auth/forgot-password', wrap((req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address');
  res.json({ ok: true });
}));
api.post('/auth/reset-password', wrap((req, res) => {
  credentials({ email: req.body.email, password: req.body.password });
  fail(400, 'Invalid or expired reset token'); // no emails are sent in mock mode, so no valid token exists
}));

// ---- master settings ----
const settingsRouter = express.Router({ mergeParams: true });
const bump = s => { s.version = (s.version || 0) + 1; };
const settingsRoute = (method, route, fn) => settingsRouter[method](route, wrap((req, res) => { fn(db.settings, req); bump(db.settings); save(); res.json(db.settings); }));
settingsRouter.get('/', wrap((req, res) => {
  if (![ORG, db.settings.id, db.settings.organizationId].includes(req.params.quarryId)) fail(404, 'Not found');
  res.json(db.settings);
}));
settingsRouter.use(requireAdmin);
settingsRoute('put', '/', (s, req) => {
  for (const key of ['savedTrucks', 'savedDestinations', 'stoneRates', 'defaultRoyaltyFee']) if (req.body[key] !== undefined) {
    if (key === 'defaultRoyaltyFee') s[key] = calc.number(req.body[key], 'charges');
    else if (key === 'stoneRates') s[key] = req.body[key].map(r => ({ id: r.id || randomUUID(), stoneType: calc.text(r.stoneType, 'product'), finish: calc.text(r.finish, 'finish'), defaultRate: calc.number(r.defaultRate, 'rate') }));
    else s[key] = [...new Set(req.body[key].map(v => calc.text(v, key)))];
  }
});
settingsRoute('put', '/profile', (s, req) => {
  s.businessName = calc.text(req.body.businessName, 'business name');
  const str = key => (typeof req.body[key] === 'string' ? req.body[key].trim() : '');
  const gstNumber = str('gstNumber').toUpperCase();
  if (gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstNumber)) fail(400, 'Enter a valid 15-character GST number, or leave it blank');
  if (str('tradeLicense').length > 80) fail(400, 'Trade license is too long');
  if (str('address').length > 300 || str('phone').length > 30) fail(400, 'Address or phone is too long');
  Object.assign(s, { address: str('address'), phone: str('phone'), gstNumber, tradeLicense: str('tradeLicense') });
  if (req.body.removeLogo === true) s.logoPath = null;
  if (req.body.defaultRoyaltyFee !== undefined) s.defaultRoyaltyFee = calc.number(req.body.defaultRoyaltyFee, 'charges');
});
settingsRoute('post', '/trucks', (s, req) => {
  const v = calc.text(req.body.truckNumber, 'truck number', 40).toUpperCase();
  if (s.savedTrucks.includes(v)) fail(409, 'Duplicate truck');
  s.savedTrucks.push(v);
});
settingsRoute('delete', '/trucks/:truckNumber', (s, req) => { s.savedTrucks = s.savedTrucks.filter(v => v !== req.params.truckNumber.trim().toUpperCase()); });
settingsRoute('post', '/destinations', (s, req) => {
  const v = calc.text(req.body.destination, 'destination', 200);
  if (s.savedDestinations.includes(v)) fail(409, 'Duplicate destination');
  s.savedDestinations.push(v);
});
settingsRoute('delete', '/destinations/:destination', (s, req) => { s.savedDestinations = s.savedDestinations.filter(v => v !== req.params.destination.trim()); });
settingsRoute('post', '/stone-rates', (s, req) => {
  const stoneType = calc.text(req.body.stoneType, 'product'), finish = calc.text(req.body.finish, 'finish'), defaultRate = calc.number(req.body.defaultRate, 'rate');
  if (s.stoneRates.some(r => r.stoneType === stoneType && r.finish === finish)) fail(409, 'Duplicate stone-rate combination');
  s.stoneRates.push({ id: randomUUID(), stoneType, finish, defaultRate });
});
settingsRoute('put', '/stone-rates/:rateId', (s, req) => {
  const rate = s.stoneRates.find(r => r.id === req.params.rateId);
  if (!rate) fail(404, 'Not found');
  const stoneType = req.body.stoneType === undefined ? rate.stoneType : calc.text(req.body.stoneType, 'product');
  const finish = req.body.finish === undefined ? rate.finish : calc.text(req.body.finish, 'finish');
  const defaultRate = calc.number(req.body.defaultRate, 'rate');
  if (s.stoneRates.some(r => r.id !== rate.id && r.stoneType === stoneType && r.finish === finish)) fail(409, 'Duplicate stone-rate combination');
  Object.assign(rate, { stoneType, finish, defaultRate });
});
settingsRoute('delete', '/stone-rates/:rateId', (s, req) => { s.stoneRates = s.stoneRates.filter(r => r.id !== req.params.rateId); });
settingsRoute('put', '/royalty', (s, req) => { s.defaultRoyaltyFee = calc.number(req.body.defaultRoyaltyFee, 'charges'); });
settingsRouter.post('/logo', (req, res) => res.status(400).json({ error: 'Logo upload is not available in mock mode' }));
api.use('/master-settings/:quarryId', requireSession, settingsRouter);

// ---- dispatches ----
function details(body) {
  const supervisor = calc.text(body.supervisor, 'supervisor');
  const logistics = {
    truckNumber: calc.text(body.logistics?.truckNumber, 'truck number', 40).toUpperCase(),
    buyerDestination: calc.text(body.logistics?.buyerDestination, 'destination', 200)
  };
  if (body.date !== undefined && (typeof body.date !== 'string' || !body.date.trim())) calc.bad('Invalid date');
  const date = body.date === undefined ? new Date() : new Date(body.date);
  if (!Number.isFinite(date.getTime())) calc.bad('Invalid date');
  const isPilot = Array.isArray(body.inventory) && body.inventory.some(g => g?.measurementRows?.length);
  const partyName = isPilot || body.partyName !== undefined ? calc.text(body.partyName, 'party name') : undefined;
  return { supervisor, logistics, date: date.toISOString(), partyName };
}
const findDispatch = id => db.dispatches.find(d => d.id === id);
const LIST_FIELDS = ['id', 'dispatchSlipNumber', 'date', 'supervisor', 'partyName', 'logistics', 'status', 'summary', 'createdAt', 'updatedAt'];
const dispatches = express.Router();
const allow = (...roles) => (req, res, next) => roles.includes(currentUser().role) ? next() : res.status(403).json({ error: 'You do not have access to this action' });

dispatches.post('/', wrap((req, res) => {
  const { clientRequestId } = req.body;
  if (clientRequestId !== undefined && (typeof clientRequestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(clientRequestId))) calc.bad('Invalid request ID');
  const existing = clientRequestId && db.dispatches.find(d => d.clientRequestId === clientRequestId);
  if (existing) return res.json(existing);
  const meta = details(req.body);
  const inventory = calc.processInventory(req.body.inventory);
  if (inventory.some(g => g.measurementRows.length) && (!db.settings.businessName || !db.settings.stoneRates.length)) calc.bad('Set up business and at least one product first');
  const fee = req.body.loadingAndRoyaltyFees ?? db.settings.defaultRoyaltyFee ?? 0;
  const record = {
    id: 'dispatch_' + randomUUID().slice(0, 8), organizationId: ORG, ...meta, inventory,
    ...(clientRequestId ? { clientRequestId } : {}), dispatchSlipNumber: 'GS-' + randomUUID(),
    summary: calc.totals(inventory, fee), businessSnapshot: null, status: 'Draft', createdAt: now(), updatedAt: now()
  };
  db.dispatches.unshift(record); save();
  res.json(record);
}));
dispatches.get('/', wrap((req, res) => {
  const { status, cursor } = req.query;
  if (status && !['Draft', 'Dispatched', 'Delivered'].includes(status)) calc.bad('Invalid status');
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  let rows = db.dispatches.filter(d => !status || d.status === status);
  if (cursor) { const i = rows.findIndex(d => d.id === cursor); rows = i >= 0 ? rows.slice(i + 1) : rows; }
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  res.json({ data: page.map(d => Object.fromEntries(LIST_FIELDS.map(k => [k, d[k]]))), nextCursor: hasMore ? page[page.length - 1].id : null });
}));
dispatches.get('/slip/:slip', wrap((req, res) => {
  const d = db.dispatches.find(x => x.dispatchSlipNumber === req.params.slip);
  if (!d) fail(404, 'Not found');
  res.json(d);
}));
dispatches.get('/:id', wrap((req, res) => {
  const d = findDispatch(req.params.id);
  if (!d) fail(404, 'Not found');
  res.json(d);
}));
dispatches.put('/:id', wrap((req, res) => {
  const d = findDispatch(req.params.id);
  if (!d) fail(404, 'Not found');
  if (d.status !== 'Draft') fail(400, 'Only Draft can be modified');
  const merged = { ...d, ...req.body };
  if (d.partyName == null && !Object.hasOwn(req.body, 'partyName')) delete merged.partyName;
  const meta = details(merged);
  const inventory = calc.processInventory(merged.inventory);
  const fee = req.body.loadingAndRoyaltyFees ?? d.summary.loadingAndRoyaltyFees;
  Object.assign(d, meta, { inventory, summary: calc.totals(inventory, fee), updatedAt: now() });
  save();
  res.json(d);
}));
dispatches.post('/:id/finalize', allow('Admin', 'Dispatcher'), wrap((req, res) => {
  const d = findDispatch(req.params.id);
  if (!d) fail(404, 'Not found');
  if (d.status !== 'Draft') return res.json(d);
  const s = db.settings;
  d.inventory = calc.processInventory(d.inventory);
  d.summary = calc.totals(d.inventory, d.summary.loadingAndRoyaltyFees);
  d.businessSnapshot = { businessName: s.businessName, address: s.address, phone: s.phone, gstNumber: s.gstNumber, tradeLicense: s.tradeLicense, logoDataUrl: null };
  Object.assign(d, { status: 'Dispatched', updatedAt: now() });
  save();
  res.json(d);
}));
dispatches.patch('/:id/status', allow('Admin', 'Dispatcher'), wrap((req, res) => {
  const d = findDispatch(req.params.id);
  if (req.body.status !== 'Delivered' || !d || d.status !== 'Dispatched') fail(400, 'Invalid status transition');
  Object.assign(d, { status: 'Delivered', updatedAt: now() });
  save();
  res.json(d);
}));
api.use('/dispatches', requireSession, dispatches);

// ---- loading lists ----
const STATUSES = ['Draft', 'Loading', 'Completed'];
function listFields(body) {
  const data = {};
  for (const key of ['supervisor', 'buyerDestination', 'stoneType', 'finish']) data[key] = calc.text(body[key], key);
  const date = body.date === undefined ? new Date() : new Date(body.date);
  if (!Number.isFinite(date.getTime())) calc.bad('Invalid date');
  data.date = date.toISOString();
  data.status = body.status || 'Draft';
  if (!STATUSES.includes(data.status)) calc.bad('Invalid status');
  if (!Array.isArray(body.requirements)) calc.bad('Requirements must be a list');
  data.requirements = body.requirements.map(row => {
    if (!row || typeof row !== 'object' || (row.loadedPieces !== undefined && !Array.isArray(row.loadedPieces))) calc.bad('Invalid requirement');
    const lengthFt = calc.number(row.lengthFt, 'length'), widthFt = calc.number(row.widthFt, 'width');
    const requiredQuantity = calc.number(row.requiredQuantity, 'quantity');
    if (lengthFt <= 0 || widthFt <= 0 || !Number.isSafeInteger(requiredQuantity)) calc.bad('Invalid dimensions or quantity');
    const loadedPieces = (row.loadedPieces || []).map(p => {
      if (!p || typeof p !== 'object') calc.bad('Invalid piece');
      const l = calc.number(p.lengthFt, 'length'), w = calc.number(p.widthFt, 'width');
      if (l <= 0 || w <= 0) calc.bad('Invalid dimensions');
      return { lengthFt: l, widthFt: w, sqFt: calc.number(l * w, 'area'), lengthDisplay: String(l), widthDisplay: String(w) };
    });
    const loadedQuantity = row.loadedQuantity === undefined ? loadedPieces.length : calc.number(row.loadedQuantity, 'loaded quantity');
    if (!Number.isSafeInteger(loadedQuantity)) calc.bad('Invalid loaded quantity');
    return { id: typeof row.id === 'string' ? row.id : randomUUID(), lengthFt, widthFt, lengthDisplay: String(lengthFt), widthDisplay: String(widthFt), requiredQuantity, loadedQuantity, balance: requiredQuantity - loadedQuantity, loadedPieces };
  });
  return data;
}
const findList = id => db.loadingLists.find(l => l.id === id);
const lists = express.Router();
lists.get('/', (req, res) => res.json(db.loadingLists));
lists.get('/:id', wrap((req, res) => {
  const l = findList(req.params.id);
  if (!l) fail(404, 'Not found');
  res.json(l);
}));
lists.post('/', wrap((req, res) => {
  const list = { id: 'list_' + randomUUID().slice(0, 8), organizationId: ORG, ...listFields(req.body),
    loadingListNumber: req.body.loadingListNumber ? calc.text(req.body.loadingListNumber, 'loading number') : 'LL-' + randomUUID(), createdAt: now(), updatedAt: now() };
  db.loadingLists.unshift(list); save();
  res.status(201).json(list);
}));
lists.put('/:id', wrap((req, res) => {
  const l = findList(req.params.id);
  if (!l) fail(404, 'Not found');
  Object.assign(l, listFields({ ...l, ...req.body }), { updatedAt: now() });
  save();
  res.json(l);
}));
lists.delete('/:id', allow('Admin'), wrap((req, res) => {
  if (!findList(req.params.id)) fail(404, 'Not found');
  db.loadingLists = db.loadingLists.filter(l => l.id !== req.params.id); save();
  res.json({ message: 'Deleted successfully' });
}));
lists.patch('/:id/status', allow('Admin', 'Dispatcher'), wrap((req, res) => {
  if (!STATUSES.includes(req.body.status)) fail(400, 'Invalid status');
  const l = findList(req.params.id);
  if (!l) fail(404, 'Not found');
  Object.assign(l, { status: req.body.status, updatedAt: now() }); save();
  res.json(l);
}));
api.use('/loading-lists', requireSession, lists);

app.use('/api', api);
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));

app.listen(PORT, (error) => {
  if (error) {
    console.error(`Failed to start mock server on port ${PORT}: ${error.message}`);
    process.exit(1);
  }
  console.log(`Mock StoneDesk API running on http://localhost:${PORT} (data: ${DATA_FILE})`);
});
