const { createClient } = require('@supabase/supabase-js');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta variable de entorno: ${name}`);
  }
  return value;
}

let cachedClient = null;

function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;

  const url = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedClient;
}

module.exports = { getSupabaseAdmin };