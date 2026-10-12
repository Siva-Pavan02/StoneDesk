// Express owns authorization. Discover all models from the generated current schema.
const { Prisma } = require('@prisma/client');
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const applicationTables = () => Prisma.dmmf.datamodel.models.map(model => model.dbName || model.name);
async function protect(client, schema) {
  await client.query('BEGIN');
  try {
    const roles = await client.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')");
    for (const table of applicationTables()) {
      const name = quote(schema) + '.' + quote(table);
      await client.query('ALTER TABLE ' + name + ' ENABLE ROW LEVEL SECURITY');
      await client.query('REVOKE ALL ON TABLE ' + name + ' FROM PUBLIC' + roles.rows.map(r => ', ' + quote(r.rolname)).join(''));
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
if (require.main === module) {
  require('dotenv').config({ quiet: true });
  const { Client } = require('pg');
  const url = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL);
  const schema = url.searchParams.get('schema') || 'public';
  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000, query_timeout: 15000 });
  (async () => { await client.connect(); await protect(client, schema); console.log('All current application tables protected from direct Data API access.'); })()
    .catch(error => { console.error('Database protection failed:', error.code || error.name); process.exitCode = 1; })
    .finally(() => client.end());
}
module.exports = { protect, applicationTables };
