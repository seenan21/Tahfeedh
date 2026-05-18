# 0006 — Half-Page Session Size (NUMERIC pages_per_session_new)

**Date:** 2026-05-18
**Status:** Implemented
**Milestone:** M3

## Context
DESIGN.md §6.3 offers a "Half a page" preset for new-memorization-per-day so beginning huffaz can pace at ~7–8 lines. The original schema (migration 0002) typed `student_settings.pages_per_session_new` as `int` with a `>= 0` check, which silently truncates 0.5 to 0 and disables the half-page algorithm path described in §6.3.

## Decision
Migration 0013 alters `pages_per_session_new` to `numeric(3,1)` and re-bounds both per-session counters:
- `pages_per_session_new` between 0.5 and 20
- `pages_per_session_revision` between 0 and 20

The 20-page upper bound replaces the unspecified ceiling in DESIGN.md. Beyond ~20 pages/day, the natural input is "juz per session," not page count — that input lands later when the algorithm itself ships (M5).

## Consequences
- ✅ Step 3's "Half a page" option writes a meaningful value the algorithm can act on.
- ✅ Bounded check constraints protect against typos in the Custom… input.
- ⚠️ Anyone with an existing fixture row gets a numeric value but should re-pick on next visit; the migration is forward-compatible (int → numeric is lossless).
- ⚠️ Half-page algorithm logic (§6.3) is data-ready but not implemented — lands with M5.
