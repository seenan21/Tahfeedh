# 0017 — Post-Test Pipeline As One Fat SQL Function

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M4 (Phase D)

## Context
Phase D's post-test pipeline must transactionally close the test, touch ayah review state, upsert error stats, decay stats whose ayah was tested but had no fresh error, promote `memorization_page.status` on a strong pass, and return a new/recurring/cleared summary for the post-test screen. Two implementation shapes were considered: (a) several smaller SQL functions orchestrated by Express, (b) one fat PL/pgSQL function called once from Express — the same shape as `commit_onboarding` (ADR 0008) and `mark_memorization` (ADR 0012, reserved).

## Decision
Single SECURITY DEFINER function `submit_test(p_test_id uuid, p_payload jsonb) returns jsonb` in `supabase/migrations/0016_post_test_pipeline.sql`. Granted only to `service_role`; Express invokes it via `supabaseAdmin.rpc('submit_test', …)`. Express resolves `test.ranges` into `coveredAyahs` + `coveredPages` before calling the function, so the function does not need to load the static quran-index. The function body executes seven sequential steps inside one implicit transaction.

Phase-D scope of step 6 (page promotion) is intentionally minimal: `newly_memorized` + `strong_pass` promotes a fully-covered `in_progress` page to `memorized`. Three behaviors are deferred to M5 with `-- TODO M5` comments in the function body:
- `memorized → mastered` (requires per-page consecutive_clean rollup).
- Fail-downgrade (`memorized → in_progress` on rating='fail').
- The recent-revision stage machine (`ayah_review_state.recent_stage` / `ready_at`).

The decay step uses the literal `3` as the clearing threshold per DESIGN.md §12 line 690 and §13.4 line 1137.

## Consequences
- ✅ Atomicity is free — one PL/pgSQL body = one implicit transaction. No half-committed state if a step fails.
- ✅ Pattern parity with `commit_onboarding` — reviewers and future maintainers read the same shape twice.
- ✅ One round-trip from Express. Streaming-error inserts already populate `error_log`; the finish call doesn't need to ship them again.
- ⚠️ ~200 lines of PL/pgSQL in one function. The CTE blocks (decay + new/recurring summary) are the most subtle — if these get more complex (M5 mastery promotion, recent-revision machine) the function may need decomposition. For now, simplicity wins.
- ⚠️ Express must resolve ranges client-side; that logic lives in `apps/server/src/pipelines/post-test/resolve.ts` and is exercised by the `/finish` endpoint only.
