-- 0011_guest_witnessed_tests.sql
-- Implements ADR 0004: a non-enrolled witness can run a test the student
-- initiates. teacher_id becomes nullable; test_mode discriminates between an
-- enrolled-teacher row (teacher_id set) and a guest-witnessed row (teacher_id
-- null, optional guest_tester_name).

create type test_mode as enum ('enrolled_teacher', 'guest_teacher');

alter table test
  alter column teacher_id drop not null,
  add column test_mode test_mode not null default 'enrolled_teacher',
  add column guest_tester_name text;

alter table test alter column test_mode drop default;

alter table test add constraint test_mode_witness_check check (
  (test_mode = 'enrolled_teacher' and teacher_id is not null) or
  (test_mode = 'guest_teacher'    and teacher_id is null)
);

-- Student may insert/update their own guest-witnessed tests.
create policy test_student_guest_write
  on test for all
  using      (student_id = auth.uid() and test_mode = 'guest_teacher')
  with check (student_id = auth.uid() and test_mode = 'guest_teacher');

-- Student may insert/update error_log rows that belong to their own guest tests.
-- The existing el_teacher_all policy only matches enrolled-teacher tests.
create policy el_student_guest_write
  on error_log for all
  using (
    exists (
      select 1 from test t
      where t.id = error_log.test_id
        and t.test_mode = 'guest_teacher'
        and t.student_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from test t
      where t.id = error_log.test_id
        and t.test_mode = 'guest_teacher'
        and t.student_id = auth.uid()
    )
  );
