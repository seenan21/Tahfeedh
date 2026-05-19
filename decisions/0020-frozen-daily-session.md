# 0020 — Today's Session is Frozen, Not Recomputed

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M5

## Context

DESIGN.md §7.1 originally specified that "the plan is computed on read each time the student opens the Today view" and that "session completion is a derived check, not a stored flag." Phase D shipped against that model: `NewLessonCard` called `next_new_lesson` live on every render and the revision row stayed an empty slot.

Two problems surfaced once `submit_test` started promoting pages:
1. After a `strong_pass` on the only in-progress page, `next_new_lesson` returns nothing and Today wrongly says "every page is in your mushaf" — even for a student with three memorized pages.
2. An on-read plan lets a student "refresh into" a different lesson if the algorithm tips toward a new candidate between reads. `notes-for-future.md` calls this an anti-pattern and explicitly forbids it.

## Decision

Persist the day's plan in a new `daily_session` table — one row per (student, date, session_index) holding `new_lesson_pages int[]` and `revision_pages int[]`. The row is computed once (via `_compute_session_plan`) when the student first opens Today on a given calendar day, then stays frozen. The `today_session(uuid)` RPC auto-creates a `session_index = 1` row on first read; subsequent reads return the same row.

The `attempted` flag on each row is **still** derived at read time: a page is attempted iff a completed test today has a page-typed range that includes it (pass or fail — both count). The plan freezes; the checkmarks update as tests close.

A new calendar day triggers a fresh session automatically (no row for `current_date` → `today_session` computes + inserts). The explicit `load_next_session(uuid)` RPC inserts an additional `session_index = N+1` row for the same date (DESIGN.md §7.7 "continue tomorrow's session early"); it is opt-in only and the streak does not double.

Revision is the simplest viable ordering for the hackathon: memorized pages sorted by stalest `ayah_review_state.last_reviewed_at`, capped at `student_settings.pages_per_session_revision`. The full Queue 2 stage machine + Queue 3 `priority_score` formula (DESIGN.md §7.2–7.3) is deferred — marked `TODO M5+` inside `_compute_session_plan`. Same posture as the mastery promotion + fail-downgrade TODOs already living in `submit_test` (migration 0016).

## Consequences

- ✅ Fixes the Phase D regression — the new-lesson row stays put once promoted, and Today shows it with a ✓ checkmark.
- ✅ Removes the refresh-to-reroll surface (anti-gaming).
- ✅ Revision queue is visible from M5 onward without waiting on the full priority math.
- ✅ Multiple sessions per day are first-class (`session_index`) — supports §7.7.
- ⚠️ DESIGN.md §7.1's "computed on read" line is now wrong; patched in the same commit. Sessions are stored; only completion-state is derived.
- ⚠️ Simple-revision picks may surprise the user vs. the documented `priority_score` formula. Live with it for the demo; tighten in M5+.
- ⚠️ Coverage detection (the attempted flag) only handles **page-typed** ranges. Surah/juz/ayah-typed ranges from `TestCreationModal` would not check rows off. Today's modal only emits page ranges, so this is a non-issue for the MVP; extend the SQL if/when other range types ship.

## Reverses
Partially supersedes DESIGN.md §7.1 (the "computed on read… not a stored flag" rule). The frozen-plan model replaces it; the derived-attempted-state principle is preserved.
