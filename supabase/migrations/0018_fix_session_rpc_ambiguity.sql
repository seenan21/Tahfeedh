-- 0018_fix_session_rpc_ambiguity.sql
-- Bugfix: `column reference is ambiguous` errors hitting the Today view.
--
-- Cause: the RETURNS TABLE(...) OUT parameter names (session_date,
-- session_index, status) in today_session / load_next_session /
-- session_status_today shadow the underlying table columns inside the
-- function body. Postgres 15+ treats unqualified references in queries as
-- ambiguous.
--
-- Fix: qualify every column reference in the function bodies with a table
-- alias so the parser binds to the table column, not the OUT parameter.
--
-- session_status_today carried the same latent bug since 0006 — fixed here
-- because StreakBadge / daily_streak fanout through it.

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
  if p_student_id is null or p_student_id <> auth.uid() then
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

create or replace function load_next_session(p_student_id uuid)
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
  v_latest_index int;
  v_new_plan     int[];
  v_rev_plan     int[];
  v_row          daily_session%rowtype;
begin
  if p_student_id is null or p_student_id <> auth.uid() then
    raise exception 'load_next_session: forbidden';
  end if;

  select coalesce(max(ds.session_index), 0) into v_latest_index
    from daily_session ds
   where ds.student_id = p_student_id
     and ds.session_date = current_date;

  select c.new_lesson_pages, c.revision_pages
    into v_new_plan, v_rev_plan
    from _compute_session_plan(p_student_id) c;

  insert into daily_session
    (student_id, session_date, session_index, new_lesson_pages, revision_pages)
  values
    (p_student_id, current_date, v_latest_index + 1,
     coalesce(v_new_plan, '{}'::int[]),
     coalesce(v_rev_plan, '{}'::int[]))
  returning daily_session.* into v_row;

  return query select
    v_row.id,
    v_row.session_date,
    v_row.session_index,
    (select coalesce(
              jsonb_agg(jsonb_build_object('page_number', p, 'attempted', false)),
              '[]'::jsonb)
       from unnest(v_row.new_lesson_pages) as p),
    (select coalesce(
              jsonb_agg(jsonb_build_object('page_number', p, 'attempted', false)),
              '[]'::jsonb)
       from unnest(v_row.revision_pages) as p),
    false;
end;
$$;

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
  select bool_or(t.test_type = 'newly_memorized'),
         bool_or(t.test_type = 'revision')
    into v_has_new, v_has_revision
  from test t
  where t.student_id = p_student_id
    and t.status = 'completed'
    and t.ended_at is not null
    and (t.ended_at at time zone 'UTC')::date = p_date;

  v_has_new := coalesce(v_has_new, false);
  v_has_revision := coalesce(v_has_revision, false);

  select au.has_completed_quran into v_completed_quran
  from app_user au
  where au.id = p_student_id;
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
