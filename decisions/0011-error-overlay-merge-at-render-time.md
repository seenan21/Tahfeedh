# 0011 — Error Overlay Merge At Render Time

**Date:** 2026-05-18
**Status:** Implemented
**Milestone:** M2

## Context
The mushaf can show many overlapping errors at the same visual location: multiple historical errors on one word, a word-scope and a verse-scope error on the same ayah, or several errors logged in a single test. Two reasonable approaches: (a) merge errors at the storage layer (collapse overlapping rows into one aggregate row), or (b) keep `error_log` as the immutable occurrence list and merge only at marker computation + modal time. Approach (a) makes rendering trivial but loses occurrence history granularity needed for the detail modal (§9.6) and trend lines (§9.5).

## Decision
Errors merge at render time, never at storage. `error_log` stays one row per occurrence. Two frontend functions own the merge:

- `getOverlayMarkers(pageNumber, stats, mode)` → one marker per distinct visual location (word or verse-end), with `intensity = max(individual intensities)`, `count`, `signatures`, and a `color` chosen by mode.
- `getErrorsAtLocation(scope, surah, ayah, word_position?)` → the underlying `ErrorLog[]` the modal shows.

Word-range errors are associated with every word in `[word_position, word_position_end]` for marker aggregation. Word-scope and verse-scope errors render at distinct visual positions (under-word dot vs. verse-end icon) even on the same ayah. Markers with >1 associated error show a count badge; >5 collapses to a "5+" badge to protect mushaf legibility — modal still lists all of them. In `colored` mode, when multiple error types share one location, the marker uses the most-recent error's type color and the modal shows the rest. See DESIGN.md §9.7 and §10.4.

## Consequences
- ✅ `error_log` remains a faithful occurrence record — the detail modal can show date-by-date history, trends, and per-occurrence severity/note.
- ✅ Overlay rules live in one place (the two computation functions) and can evolve without migrations.
- ✅ Aggregation reuses `error_location_stats` for intensity so the marker pass doesn't re-scan `error_log` row-by-row.
- ⚠️ Two parallel functions to keep in sync — a marker shown by `getOverlayMarkers` must always return a non-empty list from `getErrorsAtLocation`. Worth a unit test once Phase D lands real data.
- ⚠️ Visual density guardrail (5+ cap) hides count precision at the worst-affected words. Acceptable because the modal still lists them.
