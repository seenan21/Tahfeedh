# 0046 — Error Severity Grading Removed

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M8

## Context
The error model carried a three-level severity tag (minor / moderate / major)
on every `error_log` row. The user flagged this as noise — "an error is an
error" — and asked that overlay heat be driven purely by frequency × recency,
which it already was: `apps/web/src/mushaf/getOverlayMarkers.ts:69-72`
computes intensity as

```
occurrence_count / (1 + tests_since_last_occurrence)
```

with no severity input. So the severity column was display-only.

## Decision

Drop severity from the entire stack:

- **Migration 0027** — `ALTER TABLE error_log DROP COLUMN IF EXISTS severity`.
  The `error_severity` PG enum type is left in place (dropping it would
  require CASCADE; it's harmless and unused now).
- **`packages/shared/src/types.ts`** — `ErrorSeverity` type deleted.
- **`packages/shared/src/schema.ts`** — `errorSeveritySchema` deleted and
  `severity` removed from `logErrorSchema`.
- **`apps/server/src/routes/tests.ts`** — `severity` removed from the
  `error_log` INSERT body.
- **Web UI** — severity dropped everywhere it surfaced:
  - `ErrorLogModal` — removed the `Severity` SegmentedControl + state.
  - `LoggedErrorsList` — removed the severity Badge.
  - `TestRecapView` — removed severity from the `error_log` SELECT, from
    the `ErrorLogRow` interface, and from the `LoggedError` mapper.
  - `VerseDetailModal` (formerly `ErrorDetailModal`) — removed
    `SEVERITY_COLOR` + the severity Badge inside `OccurrenceRow`.
  - `useTestSession` — `severity` removed from `LoggedError` + the local
    entry shape.
- **`scripts/seed.ts`** — `Severity` type deleted, severity removed from
  every `ErrorSpec` insert + `PostTestSummary` mapping.

Heatmap behaviour is unchanged. Teacher notes — the part the user explicitly
asked to preserve — stay visible on every occurrence row inside the verse
modal + recap view.

## Consequences
- ✅ Less cognitive load on the witness — one less thing to pick during a
  live test.
- ✅ Smaller `error_log` schema; one fewer enum column for migrations to
  worry about.
- ✅ Overlay rendering unaffected — math was already severity-free.
- ⚠️ Historical `error_log` rows lose their severity data. We're not
  preserving it as a soft-deleted column because we never used it for
  anything but display.
- ⚠️ If a future version wants severity back (or some richer importance
  metric), it needs a new column + new enum + new UI. No graceful
  reintroduction path.

## Reverses
Migration 0001 (enum definition stays but is unused), migration 0004 (the
`severity` column it added is dropped by 0027). ADR 0023 / 0026 modal
layouts described a severity badge in `OccurrenceRow` — that badge is gone.
