# apps/web/src/mushaf/

Mushaf renderer + juz tracker grid + read-only page-details side panel. All components for "the mushaf" surface (CLAUDE.md shorthand) live here. Imported from `_authed.mushaf.tsx` and (in Phase D) from the live-test feature. No marking UI — status is test-driven per ADR 0015.

## Index

| File | What | When to read |
|---|---|---|
| `MushafPage.tsx` | Renders one Madani 15-line page. Dynamic-imports `data/pages/{N}.json`, applies `font-family: 'QPC V2 P{N}'`, RTL container with `direction: rtl` (no `row-reverse`, ADR 0016), per-page font preload, word + verse tap handlers (delegated through one click listener). Accepts `overlays: ErrorLocationStatsRow[]` + `overlayMode: 'none' \| 'heatmap'`; renders intensity-tinted background + count badge per merged marker (ADR 0011) | Rendering a mushaf page, tweaking marker rendering, debugging RTL / line justification |
| `MushafPage.module.css` | Page shell (max-width 720px to mimic printed-mushaf proportions), surah-header chip, justified line layout, marker tint + count badge styles | Tweaking renderer visuals, marker color/badge |
| `getOverlayMarkers.ts` | `getOverlayMarkers(pageNumber, stats, mode, quranIndex)` collapses `error_location_stats` rows to one marker per visual location, max-intensity for color, total-occurrence for badge (5+ collapse). `loggedErrorsToStats` adapter for live-test in-memory rows. `getErrorsAtLocation` helper for the future error-detail modal. Marker color is recency-weighted (heatmap ramp) only; `ERROR_TYPE_COLOR` palette is exported for the log pane / modal but never applied to the mushaf marker (ADRs 0011, 0019) | Touching overlay computation, heatmap ramp, or wiring overlays in a new surface |
| `MushafGrid.tsx` | Collapsible juz grid: each juz collapses to a strip with a stacked progress bar + counts; tap to expand and see the page cells. Colored by `memorization_page.status`. Click any cell → `onPick(pageNumber)` | Touching the tracker view |
| `MushafGrid.module.css` | Accordion item card, stacked progress bar, page-cell grid | Tweaking tracker visuals |
| `PageDetailsPanel.tsx` | Read-only side panel: status badge + memorized/mastered timestamps + review freshness (max `last_reviewed_at` across page's `ayah_review_state` rows) + error summary + recent tests (Phase D placeholders). ADR 0015 (no marking UI) | Touching what the reader's side panel shows |
| `PageDetailsPanel.module.css` | Sticky cream panel styling | Tweaking the side panel visuals |
| `MushafRoute.module.css` | Reader-mode toolbar pill + two-column reader layout with the side panel | Tweaking the mushaf route layout |
