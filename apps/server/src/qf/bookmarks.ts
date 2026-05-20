import { env } from '../env.js';
import { getUserAccessToken } from './userTokens.js';

/**
 * Fire-and-forget push of a single bookmark to QF. Never throws — failure to
 * sync should not break the post-test pipeline or onboarding (DESIGN.md §13.6).
 *
 * Per the QF Bookmarks API shape (best-effort): POST /auth/v1/bookmarks with
 * a verse_key body. The exact shape is light on public docs; if QF rejects,
 * we log the response body for future inspection without surfacing to the user.
 */
export async function pushBookmark(
  userId: string,
  ayah: { surah: number; ayah: number },
): Promise<void> {
  try {
    const token = await getUserAccessToken(userId);
    if (!token) return; // not connected, skip silently

    const verseKey = `${ayah.surah}:${ayah.ayah}`;
    const url = `${env.qfApiUrl}/auth/v1/bookmarks`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-auth-token': token,
        'x-client-id': env.qfClientId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ verse_key: verseKey, key: verseKey }),
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
