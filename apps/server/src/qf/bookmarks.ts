import { env } from '../env.js';
import { getUserAccessToken } from './userTokens.js';

/**
 * Bookmark writes go into a per-user "Tahfeedh" collection on Quran.com so
 * student-saved verses stay separate from collections they curate manually.
 * The collection is created lazily on the first bookmark and cached in
 * memory; on server restart the first bookmark per user re-resolves it via
 * GET + fallback POST. If collection resolution fails entirely we degrade
 * to `__default__` so the user's click is never silently dropped.
 *
 * ADR 0045 — replaces the previous `pushBookmark` that wrote `isReading: true`
 * as a singleton "currently reading" marker after onboarding finish + every
 * test finish. Those automatic callsites are gone; explicit per-click is the
 * only path now.
 */

const TAHFEEDH_COLLECTION_NAME = 'Tahfeedh';
const FALLBACK_COLLECTION_ID = '__default__';

// In-memory cache keyed by user id. Cleared on server restart.
const collectionIdByUser = new Map<string, string>();

interface CollectionsListResponse {
  data?: Array<{ id?: string; name?: string; title?: string }>;
}

interface CollectionCreateResponse {
  data?: { id?: string };
  id?: string;
}

async function qfFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${env.qfApiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'x-auth-token': token,
      'x-client-id': env.qfClientId,
      Accept: 'application/json',
    },
  });
}

async function resolveTahfeedhCollection(userId: string, token: string): Promise<string> {
  const cached = collectionIdByUser.get(userId);
  if (cached) return cached;

  // Look for an existing "Tahfeedh" collection.
  try {
    const listRes = await qfFetch(token, '/v1/collections');
    if (listRes.ok) {
      const json = (await listRes.json()) as CollectionsListResponse;
      const rows = json.data ?? [];
      const match = rows.find((c) => {
        const label = (c.name ?? c.title ?? '').trim().toLowerCase();
        return label === TAHFEEDH_COLLECTION_NAME.toLowerCase();
      });
      if (match?.id) {
        collectionIdByUser.set(userId, match.id);
        return match.id;
      }
    } else {
      const text = await listRes.text().catch(() => '');
      console.warn(`[qf bookmark] list collections non-OK ${listRes.status} for ${userId}: ${text}`);
    }
  } catch (err) {
    console.warn(`[qf bookmark] list collections error for ${userId}:`, err);
  }

  // Create the collection.
  try {
    const createRes = await qfFetch(token, '/v1/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: TAHFEEDH_COLLECTION_NAME }),
    });
    if (createRes.ok) {
      const json = (await createRes.json()) as CollectionCreateResponse;
      const id = json.data?.id ?? json.id;
      if (id) {
        collectionIdByUser.set(userId, id);
        console.log(`[qf bookmark] created Tahfeedh collection ${id} for ${userId}`);
        return id;
      }
      console.warn(`[qf bookmark] create collection ok but no id in body for ${userId}`);
    } else {
      const text = await createRes.text().catch(() => '');
      console.warn(`[qf bookmark] create collection non-OK ${createRes.status} for ${userId}: ${text}`);
    }
  } catch (err) {
    console.warn(`[qf bookmark] create collection error for ${userId}:`, err);
  }

  // Degraded fallback — save still lands somewhere reachable.
  return FALLBACK_COLLECTION_ID;
}

export async function addBookmark(
  userId: string,
  ayah: { surah: number; ayah: number },
): Promise<boolean> {
  try {
    const token = await getUserAccessToken(userId);
    if (!token) return false; // not connected

    const collectionId = await resolveTahfeedhCollection(userId, token);
    const verseKey = `${ayah.surah}:${ayah.ayah}`;
    const res = await qfFetch(
      token,
      `/v1/collections/${encodeURIComponent(collectionId)}/bookmarks`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ayah',
          key: ayah.surah,
          verseNumber: ayah.ayah,
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(
        `[qf bookmark] non-OK for user ${userId} ${verseKey} → collection ${collectionId}: ${res.status} ${text}`,
      );
      return false;
    }
    console.log(`[qf bookmark] saved ${verseKey} → collection ${collectionId} for user ${userId}`);
    return true;
  } catch (err) {
    console.warn(`[qf bookmark] error for user ${userId}:`, err);
    return false;
  }
}
