// Traditional long-lived server startup only. The Express application itself
// lives in app.js so that it can be imported without binding a port.
const app = require('./app');
const prisma = require('./utils/prisma');

const PORT = process.env.PORT || 5000;
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

prisma.$connect().then(() => {
  const server = app.listen(PORT, host, () => console.log(`Server running on port ${PORT}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(async () => { await prisma.$disconnect(); process.exit(0); }));
}).catch(async err => { console.error('Database startup failed:', err.code || err.name); await prisma.$disconnect(); process.exitCode = 1; });
