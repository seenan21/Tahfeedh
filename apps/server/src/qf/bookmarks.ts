import { env } from '../env.js';
import { getUserAccessToken } from './userTokens.js';

/**
 * Fire-and-forget push of the student's frontier ayah to QF as their
 * "currently reading" bookmark. Never throws — sync failure must not break
 * the post-test pipeline or onboarding (DESIGN.md §13.6).
 *
 * Endpoint per QF docs:
 *   POST /v1/collections/__default__/bookmarks
 * Body shape inferred from the response schema (camelCase, type=ayah).
 *   isReading=true: "set the user's singleton reading bookmark and replace
 *   any previous reading bookmark." That's our semantic — we don't want
 *   one bookmark per test, we want "where they are now."
 */
export async function pushBookmark(
  userId: string,
  ayah: { surah: number; ayah: number },
): Promise<void> {
  try {
    const token = await getUserAccessToken(userId);
    if (!token) return; // not connected, skip silently

    const verseKey = `${ayah.surah}:${ayah.ayah}`;
    const url = `${env.qfApiUrl}/v1/collections/__default__/bookmarks`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-auth-token': token,
        'x-client-id': env.qfClientId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        type: 'ayah',
        key: ayah.surah,
        verseNumber: ayah.ayah,
        isReading: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[qf bookmark] non-OK for user ${userId} ${verseKey}: ${res.status} ${text}`);
      return;
    }
    console.log(`[qf bookmark] pushed ${verseKey} for user ${userId}`);
  } catch (err) {
    console.warn(`[qf bookmark] error for user ${userId}:`, err);
  }
}

export async function pushBookmarksAll(
  userId: string,
  ayahs: Array<{ surah: number; ayah: number }>,
): Promise<void> {
  await Promise.allSettled(ayahs.map((a) => pushBookmark(userId, a)));
}
