-- 0030_refix_session_rpc_ambiguity.sql
--
-- Re-applies the fix from 0018_fix_session_rpc_ambiguity. The 0029 rewrite
-- (algorithm simplification: ADR 0048) dropped the `daily_session ds` table
-- aliases that 0018 had added, so unqualified references to `session_date` +
-- `session_index` once again collide with the RETURNS TABLE OUT parameter
-- names of the same name. Postgres reports:
--
--   42702: column reference "session_date" is ambiguous
--   It could refer to either a PL/pgSQL variable or a table column.
--
-- The today_session call inside the /today fetch path now crashes with that
-- error and the UI shows "Couldn't load today's session".
--
-- Fix: re-qualify every reference to a daily_session column inside the
-- function bodies. The RETURNING-into-record + the VALUES/INSERT lists are
-- already safe (positional / column-list); only the SELECT … WHERE … ORDER BY
-- legs need aliasing.
--
-- Keeps every other change from 0029 (revision_kinds plumbing, the v2 RPC
-- shape, etc.) intact.

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
  v_rev_kinds        text[];
  v_attempted_pages  int[];
  v_total            int;
  v_attempted_count  int;
begin
  if p_student_id is null or (p_student_id <> auth.uid() and not is_my_student(p_student_id)) then
    raise exception 'today_session: forbidden';
  end if;

  select ds.* into v_row from daily_session ds
   where ds.student_id = p_student_id
     and ds.session_date = current_date
   order by ds.session_index desc
   limit 1;

  if v_row.id is null then
    select c.new_lesson_pages, c.revision_pages, c.revision_kinds
      into v_new_plan, v_rev_plan, v_rev_kinds
      from _compute_session_plan(p_student_id) c;

    insert into daily_session
      (student_id, session_date, session_index, new_lesson_pages, revision_pages, revision_kinds)
    values
      (p_student_id, current_date, 1,
       coalesce(v_new_plan, '{}'::int[]),
       coalesce(v_rev_plan, '{}'::int[]),
       coalesce(v_rev_kinds, '{}'::text[]))
    returning daily_session.* into v_row;
  end if;

  -- Pages attempted today: any page-typed range on a completed test today.
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
                'attempted',   p = any(v_attempted_pages),
                'kind',        coalesce(v_row.revision_kinds[i], 'older'))
                order by i),
              '[]'::jsonb)
       from unnest(v_row.revision_pages) with ordinality as t(p, i)),
    (v_total > 0 and v_attempted_count = v_total);
end;
$$;

revoke execute on function today_session(uuid) from anon, public;
grant  execute on function today_session(uuid) to authenticated;

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
  v_rev_kinds    text[];
  v_row          daily_session%rowtype;
begin
  if p_student_id is null or p_student_id <> auth.uid() then
    raise exception 'load_next_session: forbidden';
  end if;

  select coalesce(max(ds.session_index), 0) into v_latest_index
    from daily_session ds
   where ds.student_id = p_student_id
     and ds.session_date = current_date;

  select c.new_lesson_pages, c.revision_pages, c.revision_kinds
    into v_new_plan, v_rev_plan, v_rev_kinds
    from _compute_session_plan(p_student_id) c;

  insert into daily_session
    (student_id, session_date, session_index, new_lesson_pages, revision_pages, revision_kinds)
  values
    (p_student_id, current_date, v_latest_index + 1,
     coalesce(v_new_plan, '{}'::int[]),
     coalesce(v_rev_plan, '{}'::int[]),
     coalesce(v_rev_kinds, '{}'::text[]))
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
              jsonb_agg(jsonb_build_object(
                'page_number', p,
                'attempted',   false,
                'kind',        coalesce(v_row.revision_kinds[i], 'older'))
                order by i),
              '[]'::jsonb)
       from unnest(v_row.revision_pages) with ordinality as t(p, i)),
    false;
end;
$$;

revoke execute on function load_next_session(uuid) from anon, public;
grant  execute on function load_next_session(uuid) to authenticated;
