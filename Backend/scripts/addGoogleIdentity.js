// Additive upgrade only: never push unrelated schema changes to the live database.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query('ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "supabaseUserId" uuid');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "User_supabaseUserId_key" ON public."User" ("supabaseUserId")');
    await client.query('COMMIT');
    const result = await client.query("SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'supabaseUserId'");
    if (result.rows[0]?.data_type !== 'uuid') throw new Error('Unexpected identity column type');
    console.log('Google identity UUID column and unique index verified.');
  } finally { await client.end(); }
}
main().catch(error => { console.error('Google identity upgrade failed:', /^[A-Z0-9]{5}$/.test(error.code || '') ? error.code : 'connection or schema error'); process.exitCode = 1; });
