# 0016 — Mushaf Line Layout: RTL Flex Without Row-Reverse

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M4 (Phase D foundation)

## Context
The `<MushafPage>` renderer was laying out words **left-to-right** despite RTL parent and Arabic content. Root cause: a BiDi double-reversal in CSS. `apps/web/src/styles/fonts.css` line 30–32 sets `direction: rtl` on `.mushaf-page`, and `apps/web/src/mushaf/MushafPage.module.css` line 32 additionally set `flex-direction: row-reverse` on each `.line`. Both reverse the visual order of flex children — combined they cancel out and render LTR. Quran.com (and every Madani 15-line reference renderer) uses `direction: rtl` alone and lets the BiDi algorithm + flex's natural directional flow handle order.

Separately, lines were rendered with `gap: 0.18em` only (no justification), so words clumped at one edge instead of filling the line edge-to-edge — Madani mushaf convention is that every non-final, non-centered line is fully justified across the width of the page.

## Decision
- Remove `flex-direction: row-reverse` from `.line`. Rely on the parent's `direction: rtl` for RTL order.
- Set `justify-content: space-between` (inline via JSX) on filled lines so words fill the row edge-to-edge.
- Continue to set `justify-content: center` (inline) for surah-name, basmallah, and `is_centered === true` lines (e.g. short final ayahs detected by `scripts/build-quran-data.ts:175-177`).
- Add `unicode-bidi: isolate` to `.mushaf-word` so a mushaf embedded inside an LTR pane (Phase D live-test layout) renders correctly without leaking BiDi context.
- Add `letter-spacing: 0` on both `.line` and `.mushaf-word` to prevent Mantine defaults from creeping in and breaking glyph kerning (QPC V2 glyphs are positioned precisely by the font).
- Preload the current page's QPC V2 font via a `<link rel="preload" as="font">` injected in `MushafPage.tsx`'s effect. Cuts the FOIT/FOUT flash on first render where fallback text would briefly render LTR before swapping to the page font.

## Consequences
- ✅ Words read right-to-left across all 604 pages.
- ✅ Lines fill the page width like the printed Madani mushaf (and quran.com).
- ✅ Centered lines (surah header, basmallah, short closing ayahs) remain centered.
- ✅ Mushaf renders correctly when embedded in an LTR pane (Phase D's two-pane live-test view).
- ⚠️ The page-font preload adds one HTTP request per page change. Negligible cost (woff2 < 50 KB per page), avoided per-paint flash.
- ⚠️ Visual QA still required against quran.com for pages with unusual layouts (page 1 Al-Fatihah all-centered, page 604 Al-Nas with short verses).
