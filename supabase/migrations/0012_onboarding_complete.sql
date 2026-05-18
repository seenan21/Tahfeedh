-- 0012_onboarding_complete.sql
-- Adds the onboarding gate flag used by the _authed layout route in Phase A.
-- All existing student_settings rows (test fixtures only — production has none yet)
-- are backfilled to false so the gate forces them through onboarding on next visit.

alter table student_settings
  add column onboarding_complete boolean not null default false;
