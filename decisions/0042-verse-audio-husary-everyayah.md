# 0042 — Verse Audio in ErrorDetailModal (Ḥusary via EveryAyah)

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M8

## Context
When the user opens an "error object" from the My Mushaf heatmap, they see
the list of logged errors for the ayah but have no way to immediately hear
the correct recitation. A small audio player at the top of the modal closes
that loop: tap the marker → see what was logged → hear what it should sound
like, side by side.

## Decision

**Reciter:** Khalil al-Ḥusary only, hardcoded. No picker.

**Audio source:** EveryAyah CDN at
`https://everyayah.com/data/Husary_128kbps/{surah:03d}{ayah:03d}.mp3`.
Chosen over the QF Content API audio endpoint because:
- No auth, no proxy — the CDN URL is public and CORS-friendly.
- One reciter, one URL pattern; zero server work.
- Same set that quran.com itself falls back to for Ḥusary playback.

**Component:** `apps/web/src/mushaf/VerseAudioPlayer.tsx`. Props:
`{ surah, ayah }`. Owns its `HTMLAudioElement`, `isPlaying`, and `rate`
state. UI is a single pill: Play/Pause `ActionIcon` + "Listen — Khalil
al-Ḥusary · S:A" label + speed `Select` (0.5× / 0.75× / 1× / 1.25× / 1.5×
/ 2×). When `surah`/`ayah` change, the effect pauses, resets `currentTime`,
and calls `audio.load()` against the new src so the modal reused for a new
marker doesn't keep playing the old verse.

**Mount point:** `ErrorDetailModal.tsx`, top of the body — above the
loading skeleton, above the empty state, above the grouped occurrences.
Renders only when `marker != null` (already gated by the modal's `open`
prop).

**Error handling:** `<audio onError>` flips a local `errored` flag; the
button disables and the label swaps to "Audio unavailable for this verse."
The modal continues to function — the player never blocks error history.

## Consequences
- ✅ Student/witness can A/B their recitation against Ḥusary's directly
  next to the logged errors. Pedagogically aligned with the error model.
- ✅ Zero server changes, zero new deps, zero new env vars.
- ✅ Speed control covers both "slow it down to learn" (0.5× / 0.75×) and
  "skim to confirm" (1.5× / 2×) needs.
- ⚠️ Hardcoded CDN: if EveryAyah ever changes URL shape or goes down,
  every modal's player breaks silently. Mitigated by the error-state
  fallback. Long-term, the QF audio API would be a more durable source.
- ⚠️ Single reciter. A future iteration can promote the constant to a
  `student_settings.preferred_reciter` column and add a picker.

## Reverses
(none — extends ADRs 0023 + 0026 + 0035)
