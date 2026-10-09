const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
// Explicit test credentials only: test setup must never fall back to live data.
require('dotenv').config({ path: path.join(__dirname, '../.env.test'), quiet: true });
process.env.NODE_ENV = 'test';
const schema = 'stonedesk_test_' + randomUUID().replaceAll('-', '');
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL in Backend/.env.test to a disposable PostgreSQL database.');
function testUrl(value) {
  const url = new URL(value);
  url.searchParams.set('schema', schema);
  url.searchParams.set('connect_timeout', '10');
  url.searchParams.set('pool_timeout', '10');
  url.searchParams.set('connection_limit', '2');
  return url.toString();
}
process.env.DATABASE_URL = testUrl(process.env.TEST_DATABASE_URL);
process.env.DIRECT_URL = testUrl(process.env.TEST_DIRECT_URL || process.env.TEST_DATABASE_URL);
const prisma = require('../utils/prisma');
async function setup(t) {
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate'], { cwd: path.join(__dirname, '..'), env: process.env, stdio: 'pipe', timeout: 60000 });
  t.after(async () => {
    // Only this run's generated schema is ever dropped; never public or a configured schema.
    if (!/^stonedesk_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe test schema');
    await prisma.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
    await prisma.$disconnect();
  });
  return prisma;
}
module.exports = { setup, prisma };
