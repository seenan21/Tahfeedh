-- 0024_teacher_session_and_test_reads.sql
-- ADR 0033 — Open up two student-data reads for the teacher drill-in:
--   (1) SELECT policy on `test` that lets the teacher read ALL tests of an
--       actively enrolled student (not just the ones they administered).
--       Existing `test_teacher_all` continues to gate writes to teacher-administered.
--   (2) Redefine `today_session(p_student_id)` with a relaxed guard so the
--       teacher can read the student's session plan. Body is unchanged from
--       migration 0018 — read-or-create idempotent semantics.
--
-- `load_next_session` and `next_new_lesson` deliberately stay locked to the
-- student themselves — those are real writes / advance the queue, only the
-- student should trigger them.

-- ---------------------------------------------------------------------------
-- 1. Additive SELECT policy on test for teacher-of-student.
-- ---------------------------------------------------------------------------

create policy test_teacher_select_student
  on test for select
  using (is_my_student(student_id));

-- ---------------------------------------------------------------------------
-- 2. today_session(p_student_id) — relaxed guard, same body as 0018.
-- ---------------------------------------------------------------------------

create or replace function today_session(p_student_id uuid)
returns table(
  session_id uuid,
  session_date date,
  session_index int,
  new_lesson_pages jsonb,
  revision_pages jsonb,
  all_attempted boolean
)
language plpgsql
security definer
set search_path = public as $$
declare
  v_row              daily_session%rowtype;
  v_new_plan         int[];
  v_rev_plan         int[];
  v_attempted_pages  int[];
  v_total            int;
  v_attempted_count  int;
begin
  if p_student_id is null then
    raise exception 'today_session: forbidden';
  end if;
  if p_student_id <> auth.uid() and not is_my_student(p_student_id) then
    raise exception 'today_session: forbidden';
  end if;

  select ds.* into v_row from daily_session ds
   where ds.student_id = p_student_id
     and ds.session_date = current_date
   order by ds.session_index desc
   limit 1;

  if v_row.id is null then
    select c.new_lesson_pages, c.revision_pages
      into v_new_plan, v_rev_plan
      from _compute_session_plan(p_student_id) c;

    insert into daily_session
      (student_id, session_date, session_index, new_lesson_pages, revision_pages)
    values
      (p_student_id, current_date, 1,
       coalesce(v_new_plan, '{}'::int[]),
       coalesce(v_rev_plan, '{}'::int[]))
    returning daily_session.* into v_row;
  end if;

  select coalesce(array_agg(distinct gs), '{}'::int[])
    into v_attempted_pages
  from test t
  cross join lateral jsonb_array_elements(t.ranges) r
  cross join lateral generate_series((r->>'start')::int, (r->>'end')::int) gs
   where t.student_id = p_student_id
     and t.status = 'completed'
     and (t.ended_at at time zone 'UTC')::date = current_date
     and r->>'type' = 'page';

  v_total := coalesce(array_length(v_row.new_lesson_pages, 1), 0)
           + coalesce(array_length(v_row.revision_pages, 1), 0);

  select count(*)::int into v_attempted_count
    from unnest(v_row.new_lesson_pages || v_row.revision_pages) as p
   where p = any(v_attempted_pages);

  return query select
    v_row.id,
    v_row.session_date,
    v_row.session_index,
    (select coalesce(
              jsonb_agg(jsonb_build_object(
                'page_number', p,
                'attempted',   p = any(v_attempted_pages))),
              '[]'::jsonb)
       from unnest(v_row.new_lesson_pages) as p),
    (select coalesce(
              jsonb_agg(jsonb_build_object(
                'page_number', p,
                'attempted',   p = any(v_attempted_pages))),
              '[]'::jsonb)
       from unnest(v_row.revision_pages) as p),
    (v_total > 0 and v_attempted_count = v_total);
end;
$$;

revoke execute on function today_session(uuid) from anon, public;
grant  execute on function today_session(uuid) to authenticated;
