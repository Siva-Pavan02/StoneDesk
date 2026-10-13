const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { Client } = require('pg');
const database = require('./database');
test('additive invitation SQL applies to an existing yard without changing its data', async t => {
  await database.setup(t);
  const url = new URL(process.env.DIRECT_URL), schema = url.searchParams.get('schema');
  assert.match(schema, /^stonedesk_test_[a-f0-9]{32}$/);
  const client = new Client({ connectionString:url.toString() }); await client.connect(); t.after(()=>client.end());
  const yard = await database.prisma.masterSettings.create({data:{organizationId:'MIGRATION-YARD', businessName:'Existing Yard'}});
  // Recreate only the new, empty table in this test-owned schema to exercise the generated delta.
  await client.query(`SET search_path TO "${schema}"`);
  await client.query('DROP TABLE "Invitation"');
  await client.query(readFileSync(require('node:path').join(__dirname,'../prisma/changes/20261012_invitations.sql'),'utf8'));
  assert.equal((await database.prisma.masterSettings.findUnique({where:{id:yard.id}})).businessName,'Existing Yard');
  assert.equal(await database.prisma.invitation.count(),0);
  const {rows} = await client.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',[`"${schema}"."Invitation"`]);
  assert.equal(rows[0].relrowsecurity,true);
});
