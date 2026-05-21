-- ADR 0046 — Severity grading retired. Every error is just an error.
-- Heatmap intensity already uses
--   occurrence_count / (1 + tests_since_last_occurrence)
-- (see apps/web/src/mushaf/getOverlayMarkers.ts) — never severity — so
-- removing this column has zero impact on overlay rendering. UI surfaces
-- that displayed the badge have been removed in the same change.

ALTER TABLE error_log DROP COLUMN IF EXISTS severity;

-- The error_severity enum type is left in place to avoid DROP CASCADE risks
-- on objects that may still reference it. It is unused going forward.
