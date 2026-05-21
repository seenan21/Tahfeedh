# 0047 — Drop `mastered` Memorization Status

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M8

## Context

`memorization_status` had three values: `in_progress`, `memorized`, `mastered`. Mastery promoted automatically when every ayah on a page had `consecutive_clean_tests >= 5` after a `revision + strong_pass` test (ADR 0024). The student never explicitly asked for the mastered tier — the UI surfaced it as a "star" badge in the juz progress bar + mushaf grid, but algorithmically it added nothing the algorithm couldn't already see via `consecutive_clean_tests`.

The user's framing: "a page should either be memorized or not memorized for simplicity." Mastery was conceptual overhead without product value at this stage.

## Decision

**Two statuses only:** `in_progress | memorized`. The `mastered` enum value stays defined in `pg_type` (Postgres can't `DROP VALUE`) but no application code writes it. Migration 0029 UPDATEs all existing `mastered` rows to `memorized` and drops the `mastered_at` column.

`consecutive_clean_tests` is **kept** — it still feeds the old-revision mastery dampener in the unified scoring formula (ADR 0050). The counter survived; the status threshold built on top of it did not.

UI sweep: `JuzProgressBar`, `MushafGrid`, `PageDetailsPanel`, `ForecastCard`, `revisionHealth`, `hydrate`, `TestCreationModal` all updated to drop the `mastered` arm from status filters, badges, legend rows, and color tokens. `statusColors.mastered` removed from `theme.ts`.

## Consequences

- ✅ Simpler mental model — students see "in progress → memorized" only.
- ✅ Fewer status branches in `submit_test` (the mastery promotion block in 0025 step 6b is deleted entirely).
- ✅ `memorization_page` row drops the `mastered_at` column → smaller PRs touching this table.
- ⚠️ Historical "mastered" pages collapse to plain "memorized" in the UI. Star icons disappear retroactively. Acceptable — the user explicitly asked for this collapse.
- ⚠️ If a future product version wants a "this page is rock-solid" tier back, it needs a new column/derived view. The data is recoverable from `consecutive_clean_tests` so the path back isn't blocked.

## Reverses

ADR 0024 (mastery rule). ADR 0037's UPSERT-promotion semantics still apply.
