// One Supabase secret key per backend component, so a leak in one component
// only requires rotating that component's key (Supabase API keys guide).
// SUPABASE_SECRET_KEY stays as a shared fallback for existing deployments.
const variables = {
  storage: 'SUPABASE_STORAGE_SECRET_KEY',
  admin: 'SUPABASE_ADMIN_SECRET_KEY',
};

function supabaseSecretKey(component) {
  const name = variables[component];
  if (!name) throw new Error(`Unknown Supabase key component: ${component}`);
  return process.env[name]?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
}

module.exports = { supabaseSecretKey };
