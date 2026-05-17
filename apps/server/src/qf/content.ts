import { env } from '../env.js';
import { getContentToken } from './tokens.js';

// QF Content API uses custom headers, NOT Authorization: Bearer.
async function qfContentFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getContentToken();
  const url = path.startsWith('http') ? path : `${env.qfApiUrl}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'x-auth-token': token,
      'x-client-id': env.qfClientId,
      Accept: 'application/json',
    },
  });
}

export async function listChapters(): Promise<unknown> {
  const res = await qfContentFetch('/content/api/v4/chapters');
  if (!res.ok) {
    throw new Error(`QF /chapters failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function searchAyahs(query: string, size = 10): Promise<unknown> {
  const params = new URLSearchParams({ q: query, size: String(size) });
  const res = await qfContentFetch(`/content/api/v4/search?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`QF /search failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
