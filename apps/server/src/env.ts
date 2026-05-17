import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: parseInt(process.env.PORT ?? optional('EXPRESS_PORT', '3001'), 10),
  sessionSecret: required('SESSION_SECRET'),

  supabaseUrl: required('SUPABASE_URL'),
  supabaseAnonKey: required('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  qfClientId: required('QF_CLIENT_ID'),
  qfClientSecret: required('QF_CLIENT_SECRET'),
  qfAuthUrl: optional('QF_AUTH_URL', 'https://oauth2.quran.foundation'),
  qfApiUrl: optional('QF_API_URL', 'https://apis.quran.foundation'),

  webOrigin: optional('WEB_ORIGIN', 'http://localhost:5173'),
};
