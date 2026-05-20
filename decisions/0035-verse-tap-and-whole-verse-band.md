# 0035 — Verse-Number Tap + Whole-Verse Band + Drill-Up Modal

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M7 (polish)

## Context

Before this ADR, the verse-end glyph (۝, `char_type === 'end'`) was treated as just another word by the click handler: tapping it during a live test opened the word-scope `ErrorLogModal` with the verse number's `position` filled in, and on the read-only mushaf it opened the error detail modal with `word_position = end's position`. There was no way for a tester to express "the issue is the whole ayah" without manually toggling something — and verse-scope errors that were logged (e.g. `forgotten_verse`) only rendered as a small marker on the ۝ glyph, easy to miss when scanning a page.

Combined with ADR 0034's scope split, the verse-number glyph needs to become a first-class tap target with its own behavior.

## Decision

### Two layers, two tap targets

**Visual on the mushaf** (heatmap mode):

- **Word-scope markers** keep their current treatment — tinted background + bottom underline + count badge on the specific word. Word-specificity is preserved.
- **Verse-scope markers** now render *two* visual elements:
  - A subtle background band across **every word** of the ayah (≈8% of the marker color, no underline). This is the "something happened to this whole ayah" signal.
  - The existing marker + count badge on the ۝ verse-end glyph.
- When a verse has both verse-scope and word-scope errors, the word marker wins visually on its own word (more saturated, has the underline); the band still shows on the *other* words of the verse. They never compete on the same word.

**Tap behavior — My Mushaf (`_authed.mushaf.tsx`):**

- Tap a word with a marker → `ErrorDetailModal` scoped to that word's `word_position` only.
- Tap the verse-end glyph → `ErrorDetailModal` in **drill-up mode**: query fetches *all* `error_log` rows on the ayah (any `word_position`), and the modal groups them as a verse-scope section + per-word sections. This is the "show me everything on this ayah" view.
- Tap a word with no marker → noop.

**Tap behavior — Live Test (`features/live-test/LiveTestRoute.tsx`):**

- Tap a word → `ErrorLogModal` opens with `word_position` set; chip list is restricted to word-scope types per ADR 0034.
- Tap the verse-end glyph → `ErrorLogModal` opens with `word_position = null`; chip list is restricted to verse-scope types per ADR 0034.

### Mechanism

- `MushafPage` gains a new `onVerseNumberTap` callback fired only for `char_type === 'end'` taps that don't resolve to a marker tap. The existing `onWordTap` fires only for word-type words.
- The `ErrorDetailModal` `marker.scope === 'verse'` branch issues a query without the `word_position` filter (drill-up). The modal renders a "Verse-scope" group at the top and one group per touched `word_position` below.
- The `MushafPage` renderer looks up two markers per word: its own (`markerKeyForWord`) and its verse's (`markerKeyForVerse`). When the word has no own marker but its verse does, it gets the band class. When the word has its own marker, the word class takes precedence.

### Why not collapse word taps into the verse tap

The user explicitly wanted to keep word-level highlights in My Mushaf — they read as the spatial picture of where errors cluster on the page. Collapsing word taps to "show all verse errors" would lose that specificity and make the per-word marker tap a noop.

## Reverses / patches

Patches DESIGN.md §9.7:
- The "Whole verse" rendering rule now reads "subtle background band across all words of the ayah **plus** a small marker at the verse-end glyph."
- "Verse-end marker → modal shows all verse-scope errors for that ayah (**excludes** word-scope errors)" becomes "→ modal shows all errors on the ayah, verse-scope group plus per-word groups (drill-up)."
- Case 3 example revised per ADR 0034 to use two word-scope types.

## Consequences

- ✅ Verse-scope errors stop being easy to miss — the whole verse subtly tints when a verse-scope marker exists.
- ✅ The verse-number glyph becomes a meaningful tap target instead of incidental geometry.
- ✅ "Show me everything that's gone wrong on this ayah" has a single, obvious gesture.
- ✅ Word-specificity preserved when the user wants to inspect a particular word.
- ⚠️ A verse with many word-scope errors *plus* a verse-scope error will look visually busy. Mitigated by the band being subtler than the word marker; if it becomes a problem, drop the band when ≥3 word markers are on the same verse.
- ⚠️ `ErrorDetailModal` now has two query shapes (word-scope vs drill-up). The cache key includes scope to keep them separate.
- ⚠️ DESIGN.md §9.7 says verse-end-marker modal excluded word-scope errors. That rule is intentionally inverted here — explicit in the §9.7 patch.
