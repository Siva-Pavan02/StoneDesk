// Connection diagnostics use the configured server secret, never a source-code credential.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
(async () => {
  try { await client.connect(); console.log('Configured PostgreSQL connection succeeded.'); }
  catch (error) { console.error('Connection failed:', error.code || error.name); process.exitCode = 1; }
  finally { await client.end(); }
})();
