import { env } from '../env.js';

// In-memory client_credentials token cache for QF Content API.
// Token lifetime is ~1 hour; refresh proactively before expiry.

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cached: CachedToken | null = null;

const REFRESH_SKEW_MS = 60_000; // refresh 60s before actual expiry

export async function getContentToken(): Promise<string> {
  if (cached && cached.expiresAt - REFRESH_SKEW_MS > Date.now()) {
    return cached.accessToken;
  }

  const basic = Buffer.from(`${env.qfClientId}:${env.qfClientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'content',
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
    throw new Error(`QF token request failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cached.accessToken;
}
