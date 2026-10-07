// Disposable browser-test workspace. Never writes into the configured application schema.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const database = require('../tests/database');
const cleanup = [];
(async () => {
  await database.setup({ after: fn => cleanup.push(fn) });
  console.log('E2E schema:', new URL(process.env.DATABASE_URL).searchParams.get('schema'));
  await database.prisma.$connect();
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stonedesk-e2e-'));
  process.env.UPLOAD_DIR = uploadDir;
  process.env.APP_ORIGIN = 'http://127.0.0.1:5180';
  const app = require('../server');
  const server = app.listen(5001, '127.0.0.1', () => console.log('Isolated E2E backend ready on 5001'));
  async function close() {
    await new Promise(resolve => server.close(resolve));
    for (const fn of cleanup) await fn();
    await fs.rm(uploadDir, { recursive: true, force: true });
    process.exit(0);
  }
  process.once('SIGINT', close); process.once('SIGTERM', close);
})().catch(async error => { console.error('E2E preview failed:', error.code || error.errorCode || error.name); for (const fn of cleanup) await fn().catch(() => {}); process.exitCode = 1; });
