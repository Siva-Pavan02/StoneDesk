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
      // Read-only presence check on the same client; never changes exitCode.
      try {
        const { rowCount } = await client.query(
          `SELECT 1 FROM information_schema.columns
           WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'passwordLogin'`);
        console.log(`${setting}: "passwordLogin" column ${rowCount ? 'present' : 'missing (apply prisma/changes/20261020_password_login.sql before deploying)'}`);
      } catch (error) {
        console.error(`${setting}: "passwordLogin" column unknown (${error.code || 'QUERY_ERROR'})`);
      }
      // The logo bucket must stay backend-only (secret key): no storage.objects policies
      // may reference it. Read-only; never prints policy text.
      const bucket = process.env.SUPABASE_LOGO_BUCKET || 'stonedesk-logos';
      try {
        const { rows } = await client.query(
          `SELECT count(*)::int AS n FROM pg_policies
           WHERE schemaname = 'storage' AND (coalesce(qual, '') ILIKE $1 OR coalesce(with_check, '') ILIKE $1)`, [`%${bucket}%`]);
        const found = rows[0]?.n || 0;
        if (found) { console.error(`${setting}: storage policies on ${bucket}: ${found} found: remove them, the bucket must stay backend-only`); process.exitCode = 1; }
        else console.log(`${setting}: storage policies on ${bucket}: none (deny-all)`);
      } catch (error) {
        console.error(`${setting}: storage policies on ${bucket} unknown (${error.code || 'QUERY_ERROR'})`);
      }
    } catch (error) {
      console.error(`${setting}: connection failed (${error.code || 'CONNECTION_ERROR'})`); process.exitCode = 1;
    } finally { await client.end().catch(() => {}); }
  }
})().catch(() => { console.error('Invalid database configuration'); process.exitCode = 1; });
