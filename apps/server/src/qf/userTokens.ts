import { env } from '../env.js';
import { supabaseAdmin } from '../supabase.js';

/**
 * QF User API tokens — DB-persisted per app_user. Refresh proactively before
 * expiry. Mirrors the cache pattern in qf/tokens.ts but for per-user tokens
 * via the QF refresh_token grant.
 */

const REFRESH_SKEW_MS = 60_000; // refresh 60s before actual expiry

export interface QfUserToken {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO from Postgres timestamptz
  scope: string | null;
}

export async function readUserTokenRow(userId: string): Promise<QfUserToken | null> {
  const { data, error } = await supabaseAdmin
    .from('qf_user_token')
    .select('user_id, access_token, refresh_token, expires_at, scope')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as QfUserToken | null) ?? null;
}

/** Upsert a user token row from a freshly-issued TokenSet. */
export async function writeUserTokenRow(input: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qf_user_token')
    .upsert(
      {
        user_id: input.userId,
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
        expires_at: input.expiresAt.toISOString(),
        scope: input.scope ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}

export async function deleteUserTokenRow(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qf_user_token')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Returns a fresh access token for the user. Refreshes via the QF refresh-token
 * grant if the stored token is within REFRESH_SKEW_MS of expiry. Returns null
 * if the user has no qf_user_token row.
 */
export async function getUserAccessToken(userId: string): Promise<string | null> {
  const row = await readUserTokenRow(userId);
  if (!row) return null;

  const expiresAtMs = new Date(row.expires_at).getTime();
  if (expiresAtMs - REFRESH_SKEW_MS > Date.now()) {
    return row.access_token;
  }

  // Refresh via the refresh_token grant.
  const basic = Buffer.from(`${env.qfClientId}:${env.qfClientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token,
  });

  const res = await fetch(`${env.qfAuthUrl}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QF refresh failed for user ${userId}: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };

  const newExpiresAt = new Date(Date.now() + json.expires_in * 1000);
  await writeUserTokenRow({
    userId,
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? row.refresh_token,
    expiresAt: newExpiresAt,
    scope: json.scope ?? row.scope,
  });
  return json.access_token;
}
