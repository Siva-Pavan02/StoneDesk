// Removes Supabase Auth users left behind by abandoned Google sign-ups or links:
// Google-only Auth users that no StoneDesk account references. Dry run by default.
//
//   node scripts/cleanupAuthUsers.js                    list candidates only
//   node scripts/cleanupAuthUsers.js --apply            delete them (irreversible)
//   node scripts/cleanupAuthUsers.js --min-age-hours=48 change the age threshold
//
// Needs DIRECT_URL, SUPABASE_URL and SUPABASE_ADMIN_SECRET_KEY (or SUPABASE_SECRET_KEY).
// Prints Auth user IDs and dates only, never emails.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });

const DEFAULT_MIN_AGE_HOURS = 24;

// Pure selection, exported for tests. An Auth user is a candidate only when it
// signed in with Google alone, is not linked to any StoneDesk user, and both its
// creation and last sign-in are older than the threshold (so in-progress sign-ups,
// whose tickets last 10 minutes, are never touched).
function orphanedAuthUsers(authUsers, linkedIds, { now = Date.now(), minAgeHours = DEFAULT_MIN_AGE_HOURS } = {}) {
  const cutoff = now - minAgeHours * 3600000;
  const linked = new Set([...linkedIds].map(id => String(id).toLowerCase()));
  const olderThanCutoff = value => value == null || (Number.isFinite(Date.parse(value)) && Date.parse(value) < cutoff);
  return authUsers.filter(user => {
    const providers = user.app_metadata?.providers || (user.app_metadata?.provider ? [user.app_metadata.provider] : []);
    return typeof user.id === 'string' && !linked.has(user.id.toLowerCase())
      && providers.length > 0 && providers.every(provider => provider === 'google')
      && user.created_at != null && olderThanCutoff(user.created_at) && olderThanCutoff(user.last_sign_in_at);
  });
}

async function main() {
  const { Client } = require('pg');
  const { createClient } = require('@supabase/supabase-js');
  const { supabaseSecretKey } = require('../utils/supabaseKeys');
  const apply = process.argv.includes('--apply');
  const ageArg = process.argv.find(arg => arg.startsWith('--min-age-hours='));
  const minAgeHours = ageArg ? Number(ageArg.split('=')[1]) : DEFAULT_MIN_AGE_HOURS;
  if (!Number.isFinite(minAgeHours) || minAgeHours < 1) throw new Error('--min-age-hours must be at least 1');
  const key = supabaseSecretKey('admin');
  if (!process.env.DIRECT_URL || !process.env.SUPABASE_URL || !key) throw new Error('Set DIRECT_URL, SUPABASE_URL and SUPABASE_ADMIN_SECRET_KEY (or SUPABASE_SECRET_KEY)');

  const db = new Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 10000 });
  await db.connect();
  let linkedIds, userCount;
  try {
    userCount = Number((await db.query('SELECT count(*) FROM public."User"')).rows[0].count);
    linkedIds = (await db.query('SELECT "supabaseUserId" FROM public."User" WHERE "supabaseUserId" IS NOT NULL')).rows.map(row => row.supabaseUserId);
  } finally { await db.end(); }
  // Guard against pointing at an empty or wrong database, which would make every Auth user look orphaned.
  if (userCount === 0) throw new Error('The StoneDesk database has no users. Check DIRECT_URL before cleaning up Auth users.');

  const admin = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;
  const authUsers = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error('Could not list Supabase Auth users');
    authUsers.push(...data.users);
    if (data.users.length < 1000) break;
  }

  const candidates = orphanedAuthUsers(authUsers, linkedIds, { minAgeHours });
  console.log(`Auth users: ${authUsers.length}. Linked to StoneDesk: ${linkedIds.length}. Orphaned Google-only users older than ${minAgeHours}h: ${candidates.length}.`);
  for (const user of candidates) console.log(`  ${user.id}  created ${user.created_at}`);
  if (!apply) { if (candidates.length) console.log('Dry run. Re-run with --apply to delete these Auth users.'); return; }

  let deleted = 0;
  for (const user of candidates) {
    const { error } = await admin.deleteUser(user.id);
    if (error && !(error.status === 404 && error.code === 'user_not_found')) { console.error(`  could not delete ${user.id}`); process.exitCode = 1; continue; }
    deleted++;
  }
  console.log(`Deleted ${deleted} of ${candidates.length} orphaned Auth users.`);
}

if (require.main === module) {
  main().catch(error => { console.error('Auth user cleanup failed:', error.message || 'unexpected error'); process.exitCode = 1; });
}
module.exports = { orphanedAuthUsers };
