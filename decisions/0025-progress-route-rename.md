# 0025 — Timeline route rebuilt as forward-looking Progress dashboard

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M7

## Context

The Phase A sidebar shipped a `/timeline` entry pointing at an `EmptyState` stub. The original DESIGN.md §19 M7 line called for a calendar-style view of past tests, errors, and milestones. By 2026-05-19, that "past view" is already covered without a timeline route:

- The Tests landing route shows a 30-day activity sparkline + last 15 completed tests (ADR 0021).
- Per-test detail lives at `/tests/:id/recap` (ADR 0022).

What the student still doesn't have is a forward-looking view — "if I keep up my current pace, when will I finish the next juz? When will the whole hifz be done? Which juz am I behind on?"

## Decision

Rename `_authed.timeline.tsx` → `_authed.progress.tsx`. Sidebar label changes from "Timeline" / "السجل" to "Progress" / "التقدم" (icon: `TrendingUp`). The Progress page renders three reusable components, all accepting an optional `studentId` prop (defaulting to the current user via route context):

- **`ForecastCard`** — configured-pace projection. Reads `student_settings.pages_per_session_new` + `hifz_direction` + `memorization_page`. Shows two dates: next juz completion + full Quran completion, plus the deltas (pages-left and days-away). Deterministic — no rolling-pace math, no "if you slip" sub-line.
- **`ActivityStatsCard`** — 7d/30d toggle with three metrics: pages newly memorized (from `memorization_page.memorized_at`), pages reviewed (distinct pages via `ayah_review_state.last_reviewed_at` mapped through `quranIndex`), tests taken with pass rate (from `test.status='completed'` rows, pass = strong_pass | excellent).
- **`RevisionHealthGrid`** — 30 juz cells colored by the **stalest ayah's `last_reviewed_at`** among memorized pages in that juz. Five bands: fresh (< 7d), aging (7-14d), stale (14-30d), overdue (30d+), never (memorized but no review state), untouched (no memorized pages).

All three components are pure of route context — pass `studentId` and they render any student's data. This is the same prop convention M6's teacher drill-in (`_authed.students.$studentId.tsx`) reuses to show a teacher their student's progress without rebuilding the components.

## Consequences

- ✅ Past-events surfaces (recap, sparkline) and forward-looking surfaces (progress) no longer overlap conceptually.
- ✅ M6 drill-in gets the three cards for free — no parallel implementation.
- ✅ Honest naming: "Progress" matches what the view computes (not "Timeline", which implied chronology).
- ⚠️ The forecast assumes "1 session = 1 calendar day" (the same assumption ADR 0024 makes for stage intervals). Multi-session days will need a future refinement.
- ⚠️ `error_log` history is not visualized here — the per-occurrence drilldown lives in the error detail modal on the mushaf (ADR 0026), not the Progress route.
