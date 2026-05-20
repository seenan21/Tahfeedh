import { env } from '../env.js';
import { getUserAccessToken } from './userTokens.js';

/**
 * Fire-and-forget push of a teacher note on an error_log entry to QF Notes.
 * Never throws — sync failure must not break error logging (mirrors
 * `pushBookmark`'s contract per DESIGN.md §13.6).
 *
 * Endpoint per QF docs:
 *   POST /v1/notes
 * Notes are attached to a verse range using the `ranges` field with strings
 * of the form "S:A-S:A" (single-verse range collapses to "S:A-S:A").
 *
 * Requires the `note.create` scope (added to qfAuth.ts SCOPES). Users who
 * connected before that scope was added will need to disconnect + reconnect
 * for the new scope to be granted.
 */
export async function pushNote(
  userId: string,
  args: { body: string; surah: number; ayah: number },
): Promise<void> {
  try {
    const trimmed = args.body.trim();
    if (!trimmed) return;

    const token = await getUserAccessToken(userId);
    if (!token) return; // not connected, skip silently

    const range = `${args.surah}:${args.ayah}-${args.surah}:${args.ayah}`;
    const url = `${env.qfApiUrl}/v1/notes`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-auth-token': token,
        'x-client-id': env.qfClientId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        body: trimmed,
        ranges: [range],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[qf note] non-OK for user ${userId} ${range}: ${res.status} ${text}`);
      return;
    }
    console.log(`[qf note] pushed ${range} for user ${userId}`);
  } catch (err) {
    console.warn(`[qf note] error for user ${userId}:`, err);
  }
}
