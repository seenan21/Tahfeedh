# 0020 — Tests Landing Shows Recent History

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M4

## Context
The Tests landing (`/_authed/tests`) previously surfaced only the *most recent completed test* as a one-line breadcrumb back to Today. That underuses the data — students can't see at a glance whether they're testing regularly, and there's no easy path to revisit a specific past test. The Today view shows the next slot, not history.

## Decision
Replace the single "Most recent test" card with two stacked surfaces on the same page:

1. **30-day activity sparkline** — one bar per day for the last 30 days, height proportional to count of completed tests that day. Rendered as inline SVG (no chart-library dep). Caption shows `N tests · last 30 days`.
2. **Recent tests list** — last 15 completed tests as Card rows, sorted by `ended_at desc`. Each row: type label (New lesson / Revision) + range summary + relative date + rating badge. Whole row links to `/tests/$testId`.

Queries hit the `test_student_ended_idx` partial index (`student_id, ended_at desc where status='completed'`). RLS scopes to the current student.

The "Begin test" / "Resume test" CTA stays at the top of the page unchanged.

## Consequences
- ✅ History is glanceable; trends and streaks visible without leaving the page
- ✅ Re-uses the existing partial index — no new schema
- ✅ No new dependency (inline SVG sparkline, ~40 LOC)
- ⚠️ Clicking a row currently lands on the existing `LiveTestRoute`, which renders a flat "This test is already completed" alert for non-in-progress tests. The link is honest but the destination is bare. A read-only test-detail view (showing logged errors + summary) is a follow-up.
- ⚠️ Page now has three surfaces (CTA + chart + list). Watch for vertical bloat on mobile; collapse the chart below a breakpoint if needed.
