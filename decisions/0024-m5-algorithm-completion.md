# 0024 — M5 Algorithm Completion: Mastery, Fail-Reset, Queue 3 Priority

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M5

## Context

`submit_test` (0016, then 0019) had three deferred behaviors marked `-- TODO M5+`:
- mastery promotion (`memorized → mastered`)
- fail-downgrade behavior
- per-ayah stage machine and `consecutive_clean_tests` rollup

`_compute_session_plan` (0017) used a "stalest `last_reviewed_at` first" simplification for the revision queue, also marked `-- TODO M5+`. The DESIGN.md §7.2-7.3 spec for the three-queue model (Queue 1 frontier walk, Queue 2 stage machine, Queue 3 weighted priority) was unbuilt.

## Decision

**Mastery promotion.** A page promotes from `memorized` to `mastered` when, after a `revision`-type test with rating `strong_pass`, every ayah on the page has `consecutive_clean_tests >= 5`. The min across the page's ayahs is the gate — any weak ayah blocks promotion.

**Fail behavior.** A `fail` rating resets `recent_stage` to 1 and sets `ready_at = now + 1 day`. Page status is **not** downgraded. Graduated pages (`recent_stage IS NULL` AND `graduated_at IS NOT NULL`) drop back into Queue 2 stage 1 on a fail — `graduated_at` is cleared.

**Streak rule.** Unchanged. `daily_streak()` and `session_status_today()` still gate on "≥1 new test + ≥1 revision test today." Per-row coverage validation against the new `daily_session.attempted` flag is deferred (M5+).

**Queue 2 stage machine.** Engages on the `newly_memorized + strong_pass` test that promotes the page (per DESIGN.md §7.2 — "Pages enter at stage 1 when first marked memorized via strong_pass on a newly_memorized test"). Transitions per the §7.2 table:
- `strong_pass` / `excellent` → stage + 1; graduates when stage would exceed 3
- `good` / `pass_needs_practice` → stage unchanged; ready_at slid to interval[current_stage]
- `needs_work` → max(1, stage - 1); ready_at = +1 day
- `fail` → stage = 1; ready_at = +1 day

"1 session" is mapped to "1 calendar day" for MVP. Intervals: stage 1 → +1d; stage 2 → +3d; stage 3 → +7d; graduated → `ready_at = NULL`.

**Queue 3 priority.** Implements the full DESIGN.md §7.2 formula minus the `mutashabihat_penalty` term (left as `-- TODO M9`). Weights as spec'd: `recency × 1.0 + errors × 20.0 - mastery × 3.0 + juz_cohesion + overdue × 10.0`.

The `error_rate_last_3_tests` term is approximated by counting non-cleared `error_location_stats` rows for the page's ayahs and dividing by 3 — a coarser proxy than walking the last 3 tests directly, but highly correlated and far cheaper. Documented as a comment in the SQL.

Queue 2 fills first; Queue 3 tops up any remaining capacity in `pages_per_session_revision`.

## Consequences

- ✅ Closes all `-- TODO M5+` markers in migrations 0016 and 0017.
- ✅ Demoable: a 5-test sequence of clean `strong_pass` revision tests on the same page drives it to `mastered`.
- ✅ Stage machine activates on the same test that promotes the page — no awkward "memorized but no stage" transient state.
- ⚠️ Stage→interval treats "1 session" as "1 calendar day." Multi-session-per-day usage (the `load_next_session` CTA fires more than once) will need revisiting post-MVP.
- ⚠️ `error_rate_last_3_tests` is a proxy, not the literal "last 3 tests with errors" walk. Tunable later.
- ⚠️ Per-row streak coverage validation (using `daily_session.attempted`) deferred — current streak still uses the looser "any test in each bucket" rule.
