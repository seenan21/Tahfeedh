# 0048 — Collapse Test Ratings to `pass` | `repeat`

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M8

## Context

`test_rating` had six values split by `test_type`:

- `newly_memorized`: `strong_pass | pass_needs_practice | fail`
- `revision`: `excellent | good | needs_work | fail`

The user's framing: "teachers have subjective ideas on what accounts for memorized" — the four-point gradation is false precision. ADR 0037 already collapsed the *semantic* difference by making any pass advance Queue 1 + the stage machine to stage 1; the only daylight left between `strong_pass` and `good` was a faded UI label.

For revision, the same logic: errors already drive the priority signal via `error_location_stats`. A teacher saying "good with two errors" produces a more honest record than picking between `good` and `needs_work` based on gut feel.

## Decision

**Single 2-value enum: `pass` | `repeat`.** Same shape for both `newly_memorized` and `revision` tests. Teacher's subjective call — did the student pass, or do they need to repeat?

- `newly_memorized + pass` → page → `memorized`; ayah → stage 1, ready_at +1d.
- `newly_memorized + repeat` → page stays `in_progress`; review state untouched (consec_clean reset if errors).
- `revision + pass` → 2-stage advance per ADR 0049.
- `revision + repeat` → ayah resets to stage 1, ready_at +1d (regression from any stage, including graduated).

Migration 0028 adds `pass`/`repeat` to the enum (must commit standalone before 0029 can reference them). Migration 0029 UPDATEs all historical rows:

- `strong_pass | excellent | good | pass_needs_practice` → `pass`
- `needs_work | fail` → `repeat`

Old enum values stay defined (Postgres can't `DROP VALUE`) but no new code writes them.

UI sweep: `ErrorLogPane.RATING_OPTIONS` shows two options per test type; `ratingLabel` / `ratingColor` switches in `_authed.tests.index`, `_authed.students.$studentId`, `TestRecapView` collapse to two cases each (`pass` → sage, `repeat` → brick). `isPassingRating` becomes `r === 'pass'`. `seed.ts` Rating arc remapped.

## Consequences

- ✅ Less cognitive load per test — teachers pick from a binary, not a 4-way gradation.
- ✅ `submit_test` rating branch logic collapses dramatically (one IS-pass check instead of multi-value CASE chains).
- ✅ Recap UI's `ratingLabel` is two cases — no maintenance burden as new code paths add ratings (because none can).
- ⚠️ Loses fidelity in historical test rows. A "strong pass" from last week now reads as just "pass." Acceptable — the user explicitly accepts this.
- ⚠️ Pass-rate stat in `ActivityStatsCard` shifts upward (previously only `strong_pass | excellent` counted as passing; now every `pass` does). Numbers are still consistent over time, just on a new scale.
- ⚠️ If a future version wants nuance back (e.g., a 3-tier "needs work, pass, mastery"), it needs new enum values + new UI. The path isn't blocked.

## Reverses

ADR 0024 (rating-specific stage transitions). ADR 0037's "any pass advances" point is now structural — "any pass" *is* the only pass.
