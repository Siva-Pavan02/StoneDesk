const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

const masterSettingsRoutes = require('./routes/masterSettingsRoutes');
const dispatchRoutes = require('./routes/dispatchRoutes');
const loadingListRoutes = require('./routes/loadingListRoutes');
const auth = require('./utils/auth');

const prisma = require('./utils/prisma');
const app = express();
// Preserve the existing client API while PostgreSQL uses id internally.
app.set('json replacer', (key, value) => value && typeof value === 'object' && !Array.isArray(value) && typeof value.id === 'string' ? { ...value, _id: value.id } : value);
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');

if (isProduction) {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be set in production');
  if (!process.env.APP_ORIGIN) throw new Error('APP_ORIGIN must be set in production');
}



app.use((req, res, next) => {
  if (req.headers.origin && !auth.allowedOrigin(req.headers.origin, req)) return res.status(403).json({ error: 'Origin is not allowed' });
  next();
});
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/api', (req, res, next) => {
  if (req.is('application/json') && (req.body === null || Array.isArray(req.body) || (req.body !== undefined && typeof req.body !== 'object'))) return res.status(400).json({ error: 'Expected a JSON object' });
  if (req.body === undefined) req.body = {};
  next();
});
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/uploads', auth.requireSession, auth.requireActive, express.static(require('./utils/businessBranding').uploadDir, {
  maxAge: 0, setHeaders: res => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, no-store'); }
}));

app.use('/api', auth.requireSession, auth.requireActive);
app.use('/api/master-settings/:quarryId', masterSettingsRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/loading-lists', loadingListRoutes);

app.get('/', (req, res) => {
  res.send('StoneDesk Server Running');
});

app.use(require('./utils/errorHandler'));

if (process.env.NODE_ENV !== 'test') {
  const host = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1');
  prisma.$connect().then(() => {
    const server = app.listen(PORT, host, () => console.log(`Server running on port ${PORT}`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(async () => { await prisma.$disconnect(); process.exit(0); }));
  }).catch(async err => { console.error('Database startup failed:', err.code || err.name); await prisma.$disconnect(); process.exitCode = 1; });
}

module.exports = app;
