const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });
const connectDB = require('./config/db');

const masterSettingsRoutes = require('./routes/masterSettingsRoutes');
const dispatchRoutes = require('./routes/dispatchRoutes');
const loadingListRoutes = require('./routes/loadingListRoutes');
const auth = require('./utils/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');

if (isProduction) {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be set in production');
  if (!process.env.APP_ORIGIN) throw new Error('APP_ORIGIN must be set in production');
}

if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

app.use((req, res, next) => {
  if (req.headers.origin && !auth.allowedOrigin(req.headers.origin, req)) return res.status(403).json({ error: 'Origin is not allowed' });
  next();
});
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
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
  res.send('GraniteSync Server Running');
});

// Centralized error handler
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.status === 413 ? 'Logo must be at most 2 MB' : err.message });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid record ID' });
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate key error' });
  }
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

if (process.env.NODE_ENV !== 'test') {
  const host = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1');
  app.listen(PORT, host, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
