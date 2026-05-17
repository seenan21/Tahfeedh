-- 0006_functions.sql
-- Helper functions referenced by triggers, the algorithm, and RLS.

-- Generic updated_at trigger function.
create or replace function touch_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 6-char invite code, no ambiguous chars (no I, L, O, 0, 1).
create or replace function generate_invite_code()
returns text
language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- RLS helper: is the current auth.uid() actively teaching this student?
create or replace function is_my_student(check_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public as $$
  select exists (
    select 1 from enrollment
    where teacher_id = auth.uid()
      and student_id = check_student_id
      and status = 'active'
  );
$$;

-- Count of distinct calendar days (UTC) on which the student completed a test.
-- Used as the session_number basis for ayah_review_state intervals.
create or replace function current_session_number(p_student_id uuid)
returns int
language sql
stable as $$
  select coalesce(count(distinct (ended_at at time zone 'UTC')::date), 0)::int
  from test
  where student_id = p_student_id
    and status = 'completed'
    and ended_at is not null;
$$;

-- Today's session status for a student: complete / partial / pending.
-- Returns flags so the UI can show which bucket is still missing.
create or replace function session_status_today(
  p_student_id uuid,
  p_date date default current_date
)
returns table (
  status text,
  has_new boolean,
  has_revision boolean,
  completed_quran boolean
)
language plpgsql
stable as $$
declare
  v_has_new boolean;
  v_has_revision boolean;
  v_completed_quran boolean;
begin
  select bool_or(test_type = 'newly_memorized'),
         bool_or(test_type = 'revision')
    into v_has_new, v_has_revision
  from test
  where student_id = p_student_id
    and status = 'completed'
    and ended_at is not null
    and (ended_at at time zone 'UTC')::date = p_date;

  v_has_new := coalesce(v_has_new, false);
  v_has_revision := coalesce(v_has_revision, false);

  select has_completed_quran into v_completed_quran
  from app_user
  where id = p_student_id;
  v_completed_quran := coalesce(v_completed_quran, false);

  return query select
    case
      when v_has_new and v_has_revision then 'complete'
      when v_completed_quran and v_has_revision then 'complete'
      when v_has_new or v_has_revision then 'partial'
      else 'pending'
    end::text,
    v_has_new,
    v_has_revision,
    v_completed_quran;
end;
$$;

-- Walk backward from yesterday counting consecutive complete days.
-- Today is excluded; today's streak only ticks once today is complete
-- (the +1 happens implicitly the next day).
create or replace function daily_streak(p_student_id uuid)
returns int
language plpgsql
stable as $$
declare
  streak int := 0;
  check_date date := current_date - 1;
  day_status text;
begin
  loop
    select status into day_status
    from session_status_today(p_student_id, check_date);

    exit when day_status is distinct from 'complete';
    streak := streak + 1;
    check_date := check_date - 1;

    -- safety bound; no one has a 10-year streak
    exit when streak > 3650;
  end loop;
  return streak;
end;
$$;

-- Teacher uses a student's 6-char code to create an enrollment.
-- SECURITY DEFINER so the teacher doesn't need SELECT on student_code
-- (which RLS restricts to the owning student).
create or replace function enroll_via_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  resolved_student uuid;
  new_enrollment_id uuid;
begin
  if not exists (
    select 1 from app_user
    where id = auth.uid() and role = 'teacher'
  ) then
    raise exception 'only teachers can enroll students';
  end if;

  select student_id into resolved_student
  from student_code
  where code = upper(p_code);

  if resolved_student is null then
    raise exception 'invalid invite code';
  end if;

  insert into enrollment (teacher_id, student_id, status)
  values (auth.uid(), resolved_student, 'active')
  on conflict (teacher_id, student_id) do update
    set status = 'active', updated_at = now()
  returning id into new_enrollment_id;

  return new_enrollment_id;
end;
$$;
