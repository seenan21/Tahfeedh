# 0003 — Per-Page QPC V2 Fonts (Not Single QPC Hafs)

**Date:** 2026-05-18
**Status:** Implemented
**Milestone:** M2

## Context
DESIGN.md §10.2 and §15.4 described a single `QPC Hafs V2` woff2 font for the entire mushaf. In practice, the canonical Madani 15-line rendering used by quran.com and QUL uses **page-scoped fonts**: each page has its own woff2 (`p1.woff2` … `p604.woff2`) containing only the glyphs for that page. Words are encoded as Private Use Area code points (`code_v2`) that resolve correctly only against their own page's font. This is how the exact mushaf layout is preserved.

## Decision
Ship 604 page-scoped woff2 files at `apps/web/public/fonts/v2/`. `apps/web/src/styles/quran-fonts.css` is auto-generated with 604 `@font-face` rules of the form `font-family: 'QPC V2 P{N}'`. `<MushafPage pageNumber={N}>` applies `style={{ fontFamily: 'QPC V2 P${N}' }}` to its `.mushaf-word` descendants. Browser fetches each font on demand (font-display: swap).

## Consequences
- ✅ Exact mushaf layout — line breaks, word spacing, end-of-ayah glyphs match the printed Madani mushaf.
- ✅ Lazy by default — only fonts for viewed pages are fetched.
- ⚠️ 95 MB total font payload (vs ~1 MB for a single font). Gitignored; fetched at deploy time only.
- ⚠️ Browser cache pressure if a session hits many pages, but per-page granularity also means each font is tiny (~150 KB).

## Affects
DESIGN.md §10.2 (`QPC Hafs font (.woff2)` line item) and §15.4 (`Quranic text: QPC Hafs V2`) — updated in the same change.
