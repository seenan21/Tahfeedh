# 0051 — Default `pages_per_session_revision` = 3

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M8

## Context

`student_settings.pages_per_session_revision` defaulted to 5 (set in migration 0002, repeated as `coalesce(..., 5)` in every iteration of `_compute_session_plan`). The user's stated default is 3 — a more realistic starting point for fresh memorizers given the simplified pass/repeat workflow.

## Decision

**Change the column DEFAULT to 3.** Existing rows untouched — students who chose 5 (or any other custom value) during onboarding keep their choice. Step 3 onboarding UI preselects 3.

Implementation:
- Migration 0029 `ALTER TABLE student_settings ALTER COLUMN pages_per_session_revision SET DEFAULT 3`.
- `_compute_session_plan` coalesces to 3 (was 5).
- `apps/web/src/onboarding/state.ts` initial `revisionPerDay = 3`.
- `apps/web/src/onboarding/hydrate.ts` fallback `?? 3`.
- `Step3Sessions.tsx` keeps the 3 / 5 / 10 / Custom presets but adds a sub-line: "3 pages is the recommended starting point. Bump it up once revision feels easy."

## Consequences

- ✅ New users get a default that respects their cognitive load on day one.
- ✅ Defaults across SQL + TS + onboarding all aligned at 3.
- ⚠️ The 5-page default is silently grandfathered for anyone already onboarded. They won't be nudged toward the new default. Acceptable — the user explicitly chose not to backfill.
- ⚠️ Revision queues will be 40% shorter for new students. If their pass rate climbs and they want more pages, Settings lets them adjust.

## Reverses

Nothing structural. Soft-supersedes DESIGN.md §6.3's "5 pages ← default" line, which §6.3 will reflect after this lands.
