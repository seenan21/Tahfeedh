import { supabase } from '../lib/supabase';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };

  // Forward the current Supabase access token so the server can call
  // supabaseAdmin.auth.getUser(token) to verify the caller.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}
