// Read-only connectivity check. Never prints passwords, connection strings or SQL data.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const { Client } = require('pg');
(async () => {
  for (const setting of ['DATABASE_URL', 'DIRECT_URL']) {
    if (!process.env[setting]) { console.error(`${setting}: not configured`); process.exitCode = 1; continue; }
    const url = new URL(process.env[setting]);
    const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000, query_timeout: 10000 });
    try {
      await client.connect(); await client.query('SELECT 1');
      console.log(`${setting}: connected (${url.hostname}:${url.port || '5432'})`);
    } catch (error) {
      console.error(`${setting}: connection failed (${error.code || 'CONNECTION_ERROR'})`); process.exitCode = 1;
    } finally { await client.end().catch(() => {}); }
  }
})().catch(() => { console.error('Invalid database configuration'); process.exitCode = 1; });
