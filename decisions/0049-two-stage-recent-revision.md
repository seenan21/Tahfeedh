# 0049 — Two-Stage Recent Revision

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M8

## Context

ADR 0024 set up a three-stage recent revision ladder: stage 1 → 2 → 3 → graduate, with intervals 1d / 3d / 7d. With the rating enum collapsed to `pass | repeat` (ADR 0048), the third stage no longer carried distinct information — its sole pedagogical job was "one more successful test before graduating," which is exactly what a second stage already represents.

User's spec: "stage 1 when freshly memorized, advance to stage 2 after one successful test 1 session later, and graduate to old revision after a second successful test 3 sessions after that."

## Decision

**Two stages.** Intervals:

- Stage 1 entered on memorization (or repeat regression); `ready_at = +1 day`.
- Stage 1 pass → stage 2; `ready_at = +3 days`.
- Stage 2 pass → graduated (`recent_stage = NULL, graduated_at = now`); no `ready_at`.
- Any repeat at any stage (including graduated) → stage 1; `ready_at = +1 day`.

Migration 0029 normalizes existing stage-3 ayahs: `recent_stage = NULL, ready_at = NULL, graduated_at = coalesce(graduated_at, now())`. Stage 3 meant "completed the ladder," which under the new model is exactly "graduated." A CHECK constraint is added: `recent_stage IS NULL OR recent_stage IN (1, 2)`.

The 1-session = 1-calendar-day mapping from ADR 0024 is preserved; multiple `session_index` rows in a day still count as 1 session for `ready_at` math.

## Consequences

- ✅ Faster graduation pipeline — a clean page can move from fresh-memorized to old-revision in 4 calendar days (stage 1 → stage 2 at day 1; pass → graduate at day 4) instead of 11 days under the old 3-stage ladder.
- ✅ Fewer CASE arms in `submit_test`. The stage transition collapses to: `prev_stage IS NULL → 1; prev_stage = 1 → 2; prev_stage = 2 → NULL (graduate)`.
- ✅ Cleaner pedagogy: "tested today, tested again in 3 days → it's yours." Matches how human teachers describe revision cadence.
- ⚠️ Pages graduate to old-revision faster. Old-revision's priority scoring (ADR 0050) needs to keep them healthy or they'll decay quietly. The 60-day overdue safety net (`+(days - 60)*10`) is the backstop.
- ⚠️ Existing stage-3 ayahs get force-graduated. If a student was mid-stage-3 with `ready_at` 3 days away, they'd lose that scheduled check. Acceptable for the user base size.

## Reverses

ADR 0024 (3-stage machine with intervals 1d/3d/7d). The interval pattern is preserved (stage 1 → +1d, stage 2 → +3d) — just truncated by one rung.
