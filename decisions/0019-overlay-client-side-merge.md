# 0019 — Overlay Computation Lives Client-Side

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M4 (Phase D)

## Context
ADR 0011 mandated that errors merge at render time (not at storage). That left open *where* the marker computation runs — client (consume the already-fetched `error_location_stats` rows for the page) or a dedicated Postgres RPC (`get_overlay_markers(page_number)` returning pre-merged markers). The latter centralizes the merge logic in SQL; the former keeps everything in TypeScript and avoids a network round-trip when a user pages through the mushaf.

## Decision
Client-side. `apps/web/src/mushaf/getOverlayMarkers.ts` exposes `getOverlayMarkers(pageNumber, stats, mode, quranIndex): OverlayMarker[]` and a sibling `getErrorsAtLocation()` helper. The mushaf page filters the student's already-loaded `error_location_stats` rows to those on the current page, groups by visual location (word vs verse-end), takes max-intensity for color and total occurrence_count for the badge, and tags each marker with the most-recent error_type for the `colored` mode. MushafPage consumes the markers via its `overlays` + `overlayMode` props (already plumbed since Phase C).

## Consequences
- ✅ Page navigation is instant — no extra RPC per page change. The student's full `error_location_stats` is small (one row per distinct error pattern, capped naturally by how many errors a student logs).
- ✅ Overlay logic is unit-testable in TS without spinning up Postgres.
- ✅ Mode switching (none / simple / heatmap / colored) is a pure re-render — no refetch.
- ⚠️ The marker compute runs on every render of MushafPage. Memoized with `useMemo` keyed on `(pageNumber, overlayMode, overlays)`; per-page input is small so this is well within budget.
- ⚠️ If a future feature needs server-side overlay aggregation (e.g. teacher dashboards across many students), it'll need a separate RPC — this ADR is scoped to per-student per-page rendering.
