# 0023 — Error Detail Modal Shows Every Occurrence, Hides Ghosts

**Date:** 2026-05-19
**Status:** Superseded by 0045
**Milestone:** M7

## Context
The error overlay markers on the mushaf merge every occurrence at a location into one tappable dot. Tapping currently does nothing — the modal isn't built. Before M7, we need to pin down two questions that affect the data shape the modal pulls and what it shows:

1. **Scope of the list.** Show every individual occurrence at the location, or one row per (error_type, severity) signature with a count?
2. **What happens to cleared errors.** `error_location_stats.cleared = true` after 3 tests without recurrence (DESIGN.md §9.5). Today the renderer hides them completely (`getOverlayMarkers.ts:87`). That's fine for the at-a-glance heatmap but throws away history the user may want when investigating a recurring trouble-spot.

## Decision

**(a) Show every individual occurrence.** The modal queries `error_log` rows at the (surah, ayah, word_position) location and lists each one — date, severity, teacher note, test it came from. The existing DESIGN.md §9.6 grouping-by-signature is preserved as the *visual* structure (collapsible "Tajweed (2 times)" headers), but the underlying data is every row, not a summary.

**(b) Ghost-error mode for cleared rows.** When the user opens the modal at a location where some occurrences belong to `cleared = true` stats rows, those occurrences are hidden by default and surfaced as a single muted line:

```
+ 4 ghost errors (cleared)   [show]
```

Tapping `[show]` reveals them inline, visually de-emphasized (lower opacity, "ghost" pill on each row). They never count toward the marker badge on the mushaf — only toward the detail modal when explicitly revealed.

Definition of "ghost": an `error_log` row whose corresponding `error_location_stats` row has `cleared = true` at read time. No new column needed. If a cleared signature later recurs and `cleared` flips back to false (which happens automatically the next time it's logged), all those rows un-ghost on the next modal open — the flag is the only source of truth.

## Consequences
- ✅ The modal becomes a real history surface, not just a redundant overlay legend. Users investigating "why does this ayah keep tripping me?" get full chronology.
- ✅ Ghost rules align with the existing `cleared` invariant — no schema change, just a render-time filter mirroring `getOverlayMarkers.ts:87` with a "show" toggle.
- ✅ Defers the sort-key question (severity-first vs. recency-first) to implementation time — the visual grouping keeps the question lower-stakes (it's only the within-group order). Tracked as DESIGN.md §20.15.
- ⚠️ The modal needs `error_log` rows, not just stats. That means either a per-location query at open time, or pre-fetching all `error_log` rows for the displayed page when overlays load. Defer the choice to M7 — it's a perf call, not a UX call.
- ⚠️ Modal must visually distinguish three row states: active, recently-cleared (within this `[show]` reveal), and "would re-appear if logged again." Design that during M7.
