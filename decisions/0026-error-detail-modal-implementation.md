# 0026 — Error Detail Modal Implementation

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M7
**Implements:** ADR 0023 (design intent)

## Context

ADR 0023 specified the design: tap an overlay marker on the mushaf → modal listing every `error_log` occurrence at that location, with `cleared = true` rows hidden by default behind a "Show ghost errors" toggle. The modal hadn't been built — overlay taps were a noop.

## Decision

Implement as `apps/web/src/mushaf/ErrorDetailModal.tsx`. Wired to `_authed.mushaf.tsx` only — NOT the live-test screen (which uses `ErrorLogModal` for **logging** new errors) and NOT the recap route (which doesn't render the mushaf).

**Data flow:**
- The parent route already fetches `error_location_stats` (for overlay rendering); it passes those rows into the modal as a `stats` prop.
- When the modal opens, it fires a Supabase query for `error_log` rows at the tapped `(student_id, surah, ayah, word_position?)` — `word_position IS NULL` for verse-scope markers, else exact match.
- Each loaded `error_log` row is classified ghost-or-active by looking up `signature` in the `stats` prop's cleared set. **No new column, no schema change** — the `cleared` flag is the single source of truth, mirroring the renderer filter in `getOverlayMarkers.ts:87` (ADR 0023).

**Layout:**
- Active occurrences grouped by `error_type` with a `count` chip per group. Within a group, rows ordered by `created_at DESC` (recency-first). DESIGN.md §20.15 within-group sort question resolved as recency-first; if severity-first matters later, reorder the within-group sort.
- Each row shows: severity badge, optional related-ayah reference (for `wrong_verse`), teacher note, timestamp.
- Ghost section appears below active groups, hidden behind a one-line `+ N ghost errors (cleared)` reveal with an Eye toggle. When revealed, rows render with `opacity: 0.55` and a "ghost" pill.

**What the modal does NOT do (yet):**
- Mark-resolved button — ADR 0023's `cleared` flag transitions automatically via `submit_test` decay; an explicit mark-resolved would need a new write path. Out of scope for M7; revisit if the demo benefits.
- Severity-first sort. Recency-first is the implementation default per the DESIGN.md §20.15 placeholder.

## Consequences

- ✅ Closes ADR 0023 (no longer "Planned").
- ✅ Mushaf overlay taps are now meaningful — the differentiator feature has its detail surface.
- ✅ Reusable across any view that mounts `MushafPage` with `overlays`. The modal accepts a `marker` prop (already part of the existing `onMarkerTap` handler shape).
- ⚠️ The `stats` prop must be loaded by the parent — if a future caller renders MushafPage without overlays loaded, ghost classification falls back to "all active." Acceptable for MVP; could be tightened to do its own stats fetch if needed.
- ⚠️ No `error_log` prefetch optimization — the per-location query fires on each modal open. Page-scoped prefetch (open the page → fetch all logs on that page once) is a perf knob deferred until measured to matter.
