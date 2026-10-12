const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('./database');
const { protect, applicationTables } = require('../scripts/protectDatabase');
const { Client } = require('pg');
test('every current Prisma table gets RLS and loses public/Data API grants', async t => {
  await database.setup(t);
  const url = new URL(process.env.DIRECT_URL);
  const schema = url.searchParams.get('schema');
  const client = new Client({ connectionString: url.toString() }); await client.connect();
  t.after(() => client.end());
  for (const name of ['PasswordResetToken', 'AuditLog', 'Invitation']) assert.ok(applicationTables().includes(name));
  for (const table of applicationTables()) await client.query(`GRANT SELECT ON "${schema}"."${table}" TO PUBLIC`);
  await protect(client, schema);
  const { rows } = await client.query(`SELECT c.relname, c.relrowsecurity, EXISTS (SELECT 1 FROM aclexplode(c.relacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.grantee=0 OR r.rolname IN ('anon','authenticated')) AS exposed FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname=$1 AND c.relkind='r'`, [schema]);
  assert.equal(rows.length, applicationTables().length);
  for (const row of rows) { assert.equal(row.relrowsecurity, true, row.relname); assert.equal(row.exposed, false, row.relname); }
});
