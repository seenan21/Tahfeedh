-- 0008_rls.sql
-- Row Level Security. Every table has RLS enabled.
--
-- Read principles:
--   - Students read their own data.
--   - Teachers read student data only when actively enrolled (is_my_student()).
--
-- Write principles:
--   - Students write their own memorization and goals.
--   - Teachers write tests and errors for enrolled students.
--   - ayah_review_state, error_location_stats, qf_user_token: no client policies →
--     all client writes denied. Only the Express service-role client can mutate.

-- ---------- enable RLS on every table ----------
alter table app_user              enable row level security;
alter table student_settings      enable row level security;
alter table student_code          enable row level security;
alter table student_group         enable row level security;
alter table enrollment            enable row level security;
alter table memorization_page     enable row level security;
alter table memorization_verse    enable row level security;
alter table ayah_review_state     enable row level security;
alter table test                  enable row level security;
alter table error_log             enable row level security;
alter table error_location_stats  enable row level security;
alter table goal                  enable row level security;
alter table qf_user_token         enable row level security;

-- ---------- app_user ----------
-- read self; teachers read enrolled students; insert self only; update self only.
create policy app_user_select
  on app_user for select
  using (id = auth.uid() or is_my_student(id));

create policy app_user_insert
  on app_user for insert
  with check (id = auth.uid());

create policy app_user_update
  on app_user for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- student_settings ----------
create policy ss_select
  on student_settings for select
  using (student_id = auth.uid() or is_my_student(student_id));

create policy ss_modify
  on student_settings for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ---------- student_code ----------
-- Owner only. Teachers reach codes through enroll_via_code() RPC,
-- which is SECURITY DEFINER and bypasses this policy.
create policy code_self_select
  on student_code for select
  using (student_id = auth.uid());

-- ---------- student_group ----------
create policy sg_owner
  on student_group for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- ---------- enrollment ----------
create policy en_teacher_all
  on enrollment for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy en_student_select
  on enrollment for select
  using (student_id = auth.uid());

-- ---------- memorization_page ----------
create policy mp_select
  on memorization_page for select
  using (student_id = auth.uid() or is_my_student(student_id));

create policy mp_modify
  on memorization_page for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ---------- memorization_verse ----------
create policy mv_select
  on memorization_verse for select
  using (student_id = auth.uid() or is_my_student(student_id));

create policy mv_modify
  on memorization_verse for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ---------- ayah_review_state ----------
-- Read-only to clients; service role writes via post-test pipeline.
create policy ars_select
  on ayah_review_state for select
  using (student_id = auth.uid() or is_my_student(student_id));

-- ---------- test ----------
-- Students see their own tests (read-only via client).
-- Teachers can fully manage tests for actively enrolled students.
create policy test_student_select
  on test for select
  using (student_id = auth.uid());

create policy test_teacher_all
  on test for all
  using (teacher_id = auth.uid() and is_my_student(student_id))
  with check (teacher_id = auth.uid() and is_my_student(student_id));

-- ---------- error_log ----------
create policy el_student_select
  on error_log for select
  using (student_id = auth.uid());

create policy el_teacher_all
  on error_log for all
  using (
    exists (
      select 1 from test t
      where t.id = error_log.test_id
        and t.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from test t
      where t.id = error_log.test_id
        and t.teacher_id = auth.uid()
    )
  );

-- ---------- error_location_stats ----------
-- Read-only to clients; service role writes via post-test pipeline.
create policy els_select
  on error_location_stats for select
  using (student_id = auth.uid() or is_my_student(student_id));

-- ---------- goal ----------
create policy goal_select
  on goal for select
  using (student_id = auth.uid() or is_my_student(student_id));

create policy goal_modify
  on goal for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ---------- qf_user_token ----------
-- No policies → all client access denied. Express service-role client only.
