# 0045 — Verse-Tap Modal + Explicit Bookmarks

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M8

## Context
Two reshape on My Mushaf:

(1) Tap target — under ADRs 0023 / 0026 / 0035, tapping a word marker opened
a word-scope error modal and tapping the ۝ verse-end glyph opened a verse
drill-up modal. The user wanted a single, simpler interaction: tap any verse
→ one modal that owns everything related to that verse.

(2) Bookmark semantics — ADR 0040 wired bookmarks as automatic "frontier"
pushes (after onboarding finish + after every test) with `isReading: true`
(singleton "currently reading" marker). That conflates "where I am" with
"verses I care about" and gives the user no agency. The user wanted explicit
bookmarks — a button in the verse modal, only the user clicking it touches
Quran.com.

## Decision

**Verse-tap is the only tap behaviour on My Mushaf.** `MushafPage` gains a
new `onVerseTap({ surah, ayah, pageNumber })` prop; when set, `handleClick`
short-circuits both `onMarkerTap` and the word-vs-verse-end split. Word and
verse-end taps both fire `onVerseTap` with the verse's coordinates. The
overlay rendering (word tints, whole-verse band, count badges, intensity
ramp) is unchanged — only the tap dispatch changes.

The live-test surface (`LiveTestRoute`) does NOT pass `onVerseTap`. It still
needs word-vs-verse distinction to anchor error logging, so `onWordTap` +
`onVerseNumberTap` stay alive.

**`ErrorDetailModal.tsx` → `VerseDetailModal.tsx`.** The modal now takes
`verse: { surah, ayah } | null` instead of a marker. Body (top → bottom):

1. `VerseStrip` — renders just the words of this verse using the same per-
   page QPC V2 font and the same `WordSpan` marker tints as `MushafPage`.
   Looks identical to the corresponding slice on the full page. Long verses
   that straddle two pages load both page JSONs. `WordSpan` was extracted
   from `MushafPage.tsx` into a new shared `WordSpan.tsx` so both surfaces
   share the visuals byte-for-byte.
2. `VerseAudioPlayer` — Ḥusary recitation (ADR 0042) with a new **Stop**
   `ActionIcon` next to Play/Pause. Stop pauses + rewinds to 0; disabled
   when audio is idle.
3. `VerseBookmarkButton` — see below.
4. Error history — unchanged in structure from ADR 0035's drill-up render
   (verse-scope group + per-word groups + ghost-error reveal). Teacher
   notes remain visible on every occurrence row (the user explicitly asked
   to preserve these). Empty case reads "No errors logged on this verse
   yet."

The single verse-scope query in `fetchErrorLogAtVerse` drops the
`word_position` filter unconditionally — there is no word-scope query mode
anymore.

**`VerseBookmarkButton`** — connected state shows a full-width "Bookmark on
Quran.com" button that POSTs to a new `/api/qf-user/bookmarks` endpoint and
toasts on response. After success, the button swaps to a "Saved to
Quran.com" state for the rest of the modal's open lifecycle (in-memory
only, no GET-list dedupe). Disconnected state replaces the button with a
green-tinted CTA row: "Connect Quran.com to bookmark this verse" + a
Connect button that kicks off the OAuth round-trip via `startQfConnect()`.

**Bookmark API rewire.**
- `apps/server/src/qf/bookmarks.ts` — `pushBookmark` renamed to
  `addBookmark`. Drops `isReading: true` from the body (regular saved
  bookmark, not the singleton "currently reading" marker). Returns
  `Promise<boolean>` so the route can surface success/failure.
  `pushBookmarksAll` deleted (no longer used).
- **Tahfeedh-named collection.** Bookmark writes route to a per-user
  collection named "Tahfeedh" on Quran.com, so app-saved verses stay
  visually separate from collections the student curates manually.
  `resolveTahfeedhCollection(userId)` lazily looks one up via
  `GET /v1/collections` on the first bookmark per user, falls back to
  `POST /v1/collections { name: 'Tahfeedh' }` if none exists, caches the
  id in an in-memory `Map<userId, collectionId>`, and degrades to
  `__default__` on resolution failure so the save is never silently
  dropped. Cache is process-local — restart costs one extra GET per
  active user.
- `apps/server/src/routes/qfUser.ts` — new `POST /bookmarks` accepts
  `{ surah, ayah }`, verifies the user, checks for a connected token
  (409 if not), calls `addBookmark`, returns `{ ok: true }` on 2xx and
  `{ error }` on the QF write failure.
- Removed: `pushBookmark(...)` calls from `apps/server/src/routes/
  onboarding.ts` (inProgress marker push) and `apps/server/src/routes/
  tests.ts` (frontier push after test finish). Comments left in place
  pointing to this ADR.

## Consequences
- ✅ One interaction model — every verse is tappable and opens one modal.
  No more guessing whether to aim for the word or the ۝.
- ✅ Bookmarks are user-driven and intentional. The verse modal doubles as
  a contextual Connect-to-Quran.com CTA for disconnected students.
- ✅ Audio player gains a real Stop control. Useful when scrubbing across
  several verses in a row.
- ✅ VerseStrip + WordSpan share visuals with the mushaf — no separate
  Arabic rendering codepath to maintain.
- ⚠️ Word-level error drill-down is gone from My Mushaf (the per-word
  groups inside the verse modal partly replace it; a teacher who wants to
  zero in on word position N reads the "word N" paper-card group).
- ⚠️ No bookmark toggle/dedupe — POSTing the same verse twice is fine
  (Quran.com dedupes), but the UI's "Saved" state only lasts as long as
  the modal stays open. Acceptable for hackathon scope.
- ⚠️ Existing students lose the automatic "frontier on Quran.com mirrors
  Tahfeedh" effect from ADR 0040. They have to bookmark deliberately now.

## Reverses
0023, 0026 (word-vs-verse modal split), 0040 (automatic bookmark pushes).
ADR 0035's verse-end drill-up is subsumed into the always-verse-scope query.
