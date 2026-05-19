# apps/web/src/mushaf/

Mushaf renderer + grid + marking modal. All components for "the mushaf" surface (CLAUDE.md shorthand) live here. Imported from `_authed.mushaf.tsx` and (in Phase D) from the live-test feature.

## Index

| File | What | When to read |
|---|---|---|
| `MushafPage.tsx` | Renders one Madani 15-line page. Dynamic-imports `data/pages/{N}.json`, applies `font-family: 'QPC V2 P{N}'`, RTL container, word + verse tap handlers (delegated through one click listener). Accepts `overlays` + `overlayMode` props for Phase D (stub: only `'none'` rendered). `compact` prop for grid drill-down peeks (ADRs 0002, 0003) | Rendering a mushaf page, wiring overlays in Phase D |
| `MushafPage.module.css` | Page shell, surah-header chip, line and centered-line layouts | Tweaking renderer visuals |
| `MushafGrid.tsx` | Collapsible juz grid: each juz collapses to a strip with a stacked progress bar + counts; tap to expand and see the page cells. Colored by `memorization_page.status`. Click any cell → `onPick(pageNumber)` | Touching the tracker view |
| `MushafGrid.module.css` | Accordion item card, stacked progress bar, page-cell grid | Tweaking tracker visuals |
| `PageDetailsPanel.tsx` | Read-only side panel: status badge + memorized/mastered timestamps + review freshness (max `last_reviewed_at` across page's `ayah_review_state` rows) + error summary + recent tests (Phase D placeholders). ADR 0015 (no marking UI) | Touching what the reader's side panel shows |
| `PageDetailsPanel.module.css` | Sticky cream panel styling | Tweaking the side panel visuals |
| `MushafRoute.module.css` | Reader-mode toolbar pill + two-column reader layout with the side panel | Tweaking the mushaf route layout |
