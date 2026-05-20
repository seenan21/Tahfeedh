# 0038 — submit_test Populates memorization_verse

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M5

## Context

ADR 0037 closed the "passing a new lesson doesn't advance the slot" bug and added Queue 2b as a fallback for memorized pages with no stage progression. But it left a known gap: pages promoted to `memorized` via the new UPSERT had no `memorization_verse` rows, so the revision queue's Queue 2 join (`memorization_page → memorization_verse → ayah_review_state`) couldn't find their ayahs. Promoted pages still landed in Queue 2b's flat-priority fallback rather than the proper stage machine. The same pathology applies to onboarding-memorized pages — `commit_onboarding` only writes `memorization_verse` for the inProgress page, not the bulk-memorized ones.

## Decision

Extend `submit_test` to UPSERT `memorization_verse` rows for every (page, surah, ayah) of every fully-covered page. The Express resolver emits these in a new payload field `coveredPageAyahs: Array<{page, surah, ayah}>`. The insert is `ON CONFLICT (student_id, surah_number, ayah_number) DO NOTHING` because an ayah's canonical page in the QPC layout is fixed — existing rows (onboarding's inProgress page) are preserved untouched.

Runs unconditionally — any test on any fully-covered page populates the rows, regardless of `test_type` or pass/fail. Failed `newly_memorized` tests still write the rows; the page just isn't promoted to `memorized` (status stays `in_progress`), and Queue 2's status filter keeps it out of the revision queue until a later pass.

## Consequences

- ✅ Pages promoted via `submit_test` now appear in **Queue 2** with proper stage-machine cadence (1d / 3d / 7d intervals) instead of Queue 2b's flat-priority fallback.
- ✅ Onboarding-memorized pages migrate from Queue 2b → Queue 2 the first time they're tested (any test type), since the upsert runs unconditionally and populates the missing `memorization_verse` rows.
- ✅ Queue 2b's role is now strictly "memorized but never tested" — a stable, well-defined fallback rather than a dumping ground for promotion misses.
- ⚠️ Onboarding's `commit_onboarding` still doesn't populate `memorization_verse` for bulk-memorized pages. Those pages stay in Queue 2b until first tested. Acceptable — a never-tested memorized page is exactly what Queue 2b is for.
- ⚠️ Payload size grows: a 15-ayah page tested adds ~15 entries to `coveredPageAyahs`. Negligible (kilobytes at most) given the per-test scale.

## Closes

The deferred bullet at the end of ADR 0037 ("pages promoted via the new UPSERT still don't get `memorization_verse` rows").
