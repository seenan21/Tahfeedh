-- 0023_student_reads_teacher_app_user.sql
-- ADR 0030 — Mirror policy for the student → teacher read direction on
-- `app_user`. The existing `app_user_select` policy (0008) only covers
-- self + teacher-reads-their-students; the ADR 0028 Classroom tab needs
-- the inverse so students can render teacher display names.
--
-- PostgreSQL OR's multiple policies for the same operation, so this is
-- additive — the existing policy is left untouched.

create policy app_user_select_my_teacher
  on app_user for select
  using (
    exists (
      select 1 from enrollment e
       where e.teacher_id = app_user.id
         and e.student_id = auth.uid()
         and e.status = 'active'
    )
  );
