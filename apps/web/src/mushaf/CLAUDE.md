# apps/web/src/mushaf/

Mushaf renderer + grid + marking modal. All components for "the mushaf" surface (CLAUDE.md shorthand) live here. Imported from `_authed.mushaf.tsx` and (in Phase D) from the live-test feature.

## Index

| File | What | When to read |
|---|---|---|
| `MushafPage.tsx` | Renders one Madani 15-line page. Dynamic-imports `data/pages/{N}.json`, applies `font-family: 'QPC V2 P{N}'`, RTL container, word + verse tap handlers (delegated through one click listener). Accepts `overlays` + `overlayMode` props for Phase D (stub: only `'none'` rendered). `compact` prop for grid drill-down peeks (ADRs 0002, 0003) | Rendering a mushaf page, wiring overlays in Phase D |
| `MushafPage.module.css` | Page shell, surah-header chip, line and centered-line layouts | Tweaking renderer visuals |
| `MushafGrid.tsx` | 604-page grid grouped by juz, colored by `memorization_page.status` (sage.7 / sage.4 / honey.4 / cream untouched). Click → `onPick(pageNumber)` | Touching the grid view |
| `MushafGrid.module.css` | Juz section card, page-cell grid | Tweaking grid visuals |
| `MarkPageModal.tsx` | Bottom-style modal for marking a page memorized / in-progress (first or second half) / untouched. Dynamic-imports the page JSON to read `midpoint_ayah_break`. On submit, POSTs `/api/memorization/mark` via `apiFetch` and invalidates the `memorization_pages` + `next_new_lesson` queries (ADR 0012) | Touching the marking UX |
