const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
process.env.NODE_ENV = 'test';
const schema = 'stonedesk_test_' + randomUUID().replaceAll('-', '');
const url = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
url.searchParams.set('schema', schema);
process.env.DATABASE_URL = url.toString();
if (process.env.DIRECT_URL) {
  const directUrl = new URL(process.env.TEST_DIRECT_URL || process.env.DIRECT_URL);
  directUrl.searchParams.set('schema', schema);
  process.env.DIRECT_URL = directUrl.toString();
}
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
