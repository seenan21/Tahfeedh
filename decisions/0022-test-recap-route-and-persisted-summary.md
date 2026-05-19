# 0022 — Test Recap Route and Persisted Summary

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M4

## Context
The tests landing page now lists the last 15 completed tests as clickable rows (ADR 0021), but clicking a row navigated to `LiveTestRoute`, which renders a flat "this test is already completed" alert for non-in-progress tests. The history list pointed at a dead end. We want a read-only **recap** view: test metadata, rating, notes, the post-test NEW / RECURRING / CLEARED summary, and the full list of errors logged during the test. No mushaf rendering — recap is a record, not a re-read.

The post-test summary is generated inside `submit_test()` and returned to the live finish endpoint, but never persisted. `error_location_stats` — the table the summary is derived from — is global mutable state that gets decayed and overwritten by subsequent tests, so reconstructing the historical classification after the fact is impossible.

## Decision
Two coupled changes:

1. **Persist the summary on the `test` row.** Migration `0019_test_summary_persistence.sql` adds `test.summary jsonb` and rewrites `submit_test()` to `UPDATE test SET summary = v_summary WHERE id = p_test_id` immediately before returning. Behavior for the live finish flow is unchanged; we just also write the same payload to the row.

2. **Separate read-only recap route.** New file `_authed.tests.$testId.recap.tsx` renders `<TestRecapView>` — fetches the `test` row (incl. `summary`, `notes`, `started_at`, `ended_at`, `guest_tester_name`, `ranges`, `rating`) and the `error_log` rows for the test (direct Supabase SELECT, existing RLS allows student-owned reads). Renders header + notes block + summary sections + full error list. The history list on `_authed.tests.index.tsx` routes to `/tests/$testId/recap` (not `/tests/$testId`), and `LiveTestRoute`'s "already completed" branch redirects to the recap with `replace: true`.

For shared rendering, extract `LoggedErrorsList` from `ErrorLogPane` and `PostTestSummaryView` from `PostTestSummaryModal` so both surfaces consume the same primitives.

## Consequences
- ✅ History rows lead somewhere useful — past tests are now reviewable
- ✅ Classification stays truthful historically (persisted at submit-time)
- ✅ No new endpoint, no new RLS — uses existing student-select policies
- ✅ Extraction tidies the live-test components (less duplication)
- ⚠️ Tests completed before this migration land here with `summary = null`; the view renders a "summary unavailable for tests before this date" placeholder. Errors and metadata still render normally.
- ⚠️ Extends ADR 0017 — `submit_test` now also writes to `test.summary`. The "one fat fn" principle is preserved; this adds one side-effect write, not a new function.
