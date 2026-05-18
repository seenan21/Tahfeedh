# 0010 — Modernize App-Shell Visuals (Depth + Glass + 30-Cell Juz Grid)

**Date:** 2026-05-18
**Status:** Implemented
**Milestone:** M3 (Phase B polish pass)

## Context
Phase B shipped the app shell functionally correct but flat: parchment sidebar with weak hover/selected states, mihrab.9 main as a flat slab, header with no hierarchy, and a Today juz-progress bar that compressed 30 juz into a 2-segment Progress bar. Manual `onMouseEnter/Leave` on sidebar items also caused the hover state to "stick" — React fought CSS for the same state.

DESIGN-SYSTEM.md §2 prescribes a strict "mihrab + parchment + one accent" three-color rule and §5 confines all gradient/depth to the SilkBackground on entry-points. The shell as written respected those rules but felt dated — the depth budget for the app-shell was zero.

## Decision
Allow **structural depth** inside the app-shell, while keeping the palette unchanged:

1. **Subtle radial gradient on `AppShell.main`** — `mihrab.7 → mihrab.9 → deeper edges`. Stays within the mihrab ramp; no new colors.
2. **Glassmorphism on the header** — semi-transparent `parchment.0` with `backdrop-filter: blur(14px) saturate(140%)`. Reads as cream-on-mihrab but with motion-aware translucency.
3. **Sidebar = parchment gradient panel** with the brand wordmark moved inside it (was previously in the header). Bilingual nav rows (English left, Arabic right) with a sage-gradient active state and a 3px mihrab.9 left border. Hover/active expressed in CSS (`AppSidebar.module.css`), driven by `useMatchRoute` setting `data-active`. No more `onMouseEnter/Leave`.
4. **30-cell juz grid replaces the 2-segment progress bar.** Each cell colored by aggregated page status (mastered / memorized / in-progress / untouched), tooltip per cell, hover lift. This is the canonical "hifz at a glance" visualization and will be the same component shape used on the teacher students-list peek.
5. **Streak badge as a gradient pill** with a flame icon (honey→brick gradient when lit, neutral gray when not).
6. **Empty-state hero pattern** — 88px iconHalo (white disc with sage radial glow), tag chip (e.g. "Phase D · M5"), bilingual hero, helper copy. 600ms fade-in scale on mount. Used on every stub route.

## Consequences
- ✅ Hover state in the sidebar is correct (CSS, not state); selected state reads at glance.
- ✅ App-shell feels like an app, not a Mantine demo, while staying inside the palette.
- ✅ The 30-cell juz grid is a meaningful daily-progress visual that scales to teacher views.
- ⚠️ DESIGN-SYSTEM.md §2's three-color rule needs softening — depth via gradients within a single anchor (mihrab ramp, sage ramp) is now allowed inside the shell. §5's "no gradients in app-shell" is loosened correspondingly. Both sections patched in the same change.
- ⚠️ `AppSidebar.module.css` is the first CSS module in the codebase. Pattern established: route + component-scoped styles for anything beyond Mantine's inline reach (pseudo-classes, gradients, animations).

## Affects
- DESIGN-SYSTEM.md §2 — three-color rule softened to allow same-anchor gradients inside the shell.
- DESIGN-SYSTEM.md §5 — gradient/depth allowed in app-shell as structural depth (not decoration); SilkBackground still confined to entry points.
- DESIGN-SYSTEM.md §6 — Sidebar recipe updated (data-active CSS module, bilingual rows, brand wordmark inside).
- DESIGN.md §14.1 — header now glassy; brand wordmark moved into the sidebar.
- DESIGN.md §14.4 — Today's progress treatment is the 30-cell juz grid, not a Progress bar.
