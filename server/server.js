const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');

const masterSettingsRoutes = require('./routes/masterSettingsRoutes');
const dispatchRoutes = require('./routes/dispatchRoutes');
const loadingListRoutes = require('./routes/loadingListRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(require('./utils/businessBranding').uploadDir, {
  immutable: true, maxAge: '1y', setHeaders: res => res.setHeader('X-Content-Type-Options', 'nosniff')
}));

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
  app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
