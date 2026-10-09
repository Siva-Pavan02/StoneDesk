// Express owns authorization. Do not expose these tables through the Supabase Data API.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const url = new URL(process.env.DATABASE_URL);
const schema = url.searchParams.get('schema') || 'public';
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000, query_timeout: 15000 });
(async () => {
  await client.connect();
  await client.query('BEGIN');
  for (const table of ['User', 'Session', 'MasterSettings', 'LoadingList', 'Dispatch']) {
    const name = quote(schema) + '.' + quote(table);
    await client.query('ALTER TABLE ' + name + ' ENABLE ROW LEVEL SECURITY');
    await client.query('REVOKE ALL ON TABLE ' + name + ' FROM anon, authenticated');
  }
  await client.query('COMMIT');
  console.log('Application tables protected from direct Data API access.');
})().catch(async error => { await client.query('ROLLBACK').catch(() => {}); console.error('Database protection failed:', error.code || error.name); process.exitCode = 1; }).finally(() => client.end());
