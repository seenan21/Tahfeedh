-- 0022_realtime_enrollment.sql
-- ADR 0029 — Enable Supabase Realtime on `enrollment` so the teacher directory
-- (`_authed.students.tsx`) reflects new joins live, without a page refresh.
--
-- RLS still gates which rows the subscriber sees: the teacher's channel will
-- only receive enrollment events where `teacher_id = auth.uid()` per the
-- existing `enrollment_owner_*` policies. The publication just opts the table
-- in to the realtime broadcast stream — it does not bypass RLS.

alter publication supabase_realtime add table enrollment;
