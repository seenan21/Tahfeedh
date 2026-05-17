import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service-role client — bypasses RLS. Use for writes to derived tables
// (ayah_review_state, error_location_stats) and admin operations.
// Never expose this to the browser.
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
