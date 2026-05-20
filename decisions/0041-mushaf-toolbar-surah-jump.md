# 0041 — Mushaf Reader Toolbar: Centered Flipper + Surah Jump

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M8

## Context
The `/mushaf` reader toolbar (`_authed.mushaf.tsx`) was two-column with the
prev/next page flipper on the left and overlay-toggle + "Jump to page" on the
right. Two pain points: (a) the page flipper wasn't visually centered, so it
felt off-balance, and (b) the only way to reach a specific surah was to know
its page number and use the NumberInput jump.

## Decision
Restructure the toolbar into a CSS-grid three-column layout
(`1fr auto 1fr`):

- **Left:** searchable Mantine `Select` of all 114 chapters. Options encode
  both Latin + Arabic names plus the chapter id (`"2. Al-Baqarah · البقرة"`)
  so typing "baqarah", "البقرة", or "2" all surface the same row. Picking a
  chapter sets `selectedPage` to `chapter.pages[0]`. The Select's current
  value tracks `quranIndex.pages[selectedPage].surah_start`, so prev/next/
  jump-to-page navigation keeps the dropdown in sync.
- **Center:** the prev arrow · page indicator (Page N / 604 + Juz X) · next
  arrow stack, moved from the left.
- **Right:** the existing "Show errors" Switch + "Jump to page" NumberInput.

A `.toolbarGrid` class in `MushafRoute.module.css` owns the grid, with a
≤760px breakpoint that collapses to one column. Three `.toolbarLeft /
Center / Right` justify-self helpers anchor each slot.

## Consequences
- ✅ Page flipper sits in the visual center regardless of how wide the
  surah Select renders.
- ✅ Surah-by-name navigation is now first-class; no need to memorize page
  numbers for common surahs.
- ✅ Reuses `CHAPTERS` + `chapter()` from `data/quran-data.ts` — zero new
  data wiring.
- ⚠️ Mobile collapse stacks all three groups vertically. The toolbar is
  taller on phones, but each row stays usable.

## Reverses
(none — extends DESIGN.md §10 / §14.4)
