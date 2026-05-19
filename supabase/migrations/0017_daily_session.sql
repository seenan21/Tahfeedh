-- 0017_daily_session.sql
-- M5: frozen Today's-session machine.
-- ADR 0020 (supersedes the "computed on read" half of DESIGN.md §7.1).
--
-- A daily_session row is the day's plan: one new-lesson page (per Queue 1)
-- plus N revision pages (per a simplified revision rule — see _compute_session_plan).
-- The row is written once and stays frozen for the day; a student cannot
-- "refresh into" a different lesson by reloading Today.
--
-- The "attempted" flag per page is derived at read time from completed tests
-- whose page-typed ranges include the page. A page is attempted as soon as
-- a test ends today whose range covers it — pass or fail, both count
-- (the student attempted).
--
-- Default behavior: when today's session is fully attempted, the UI shows a
-- "Today's session complete" state. The next session loads automatically on
-- the next calendar day (first call to today_session() on a fresh date).
-- Optional override: load_next_session() inserts another session_index for
-- the same date (DESIGN.md §7.7 — "continue tomorrow's session early").

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table daily_session (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references app_user(id) on delete cascade,
  session_date date not null,
  session_index int not null default 1,
  new_lesson_pages int[] not null default '{}',
  revision_pages   int[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, session_date, session_index)
);

create index daily_session_student_date_idx
  on daily_session(student_id, session_date desc, session_index desc);

alter table daily_session enable row level security;

-- Read: students see their own rows; teachers see enrolled students'.
create policy ds_select
  on daily_session for select
  using (student_id = auth.uid() or is_my_student(student_id));

-- No client write policy — all inserts go via the SECURITY DEFINER RPCs.

-- ---------------------------------------------------------------------------
-- _compute_session_plan(uuid)
-- ---------------------------------------------------------------------------
-- Runs the queues once and returns the (new_lesson_pages, revision_pages)
-- arrays. Internal helper; not granted to authenticated.
--
-- Queue 1 (new lesson) mirrors the body of next_new_lesson(uuid) from
-- 0015_hifz_direction.sql — direction-aware frontier walk, returns 0 or 1
-- page. If the student has has_completed_quran=true, returns 0.
--
-- Simple revision: memorized pages ordered by the stalest
-- ayah_review_state.last_reviewed_at across the page's ayahs (NULL first),
-- capped at student_settings.pages_per_session_revision.
-- TODO M5+: replace with the full Queue 2 stage machine + Queue 3
-- priority_score formula (DESIGN.md §7.2-7.3).

create or replace function _compute_session_plan(p_student_id uuid)
returns table(new_lesson_pages int[], revision_pages int[])
language plpgsql
security definer
set search_path = public as $$
declare
  v_direction      hifz_direction;
  v_has_completed  boolean;
  v_revision_cap   int;
  v_new_pages      int[] := '{}';
  v_rev_pages      int[] := '{}';
  v_next_new       int;
begin
  select has_completed_quran into v_has_completed
    from app_user where id = p_student_id;

  select hifz_direction,
         coalesce(pages_per_session_revision, 5)::int
    into v_direction, v_revision_cap
    from student_settings where student_id = p_student_id;

  v_direction    := coalesce(v_direction, 'forward'::hifz_direction);
  v_revision_cap := greatest(coalesce(v_revision_cap, 5), 0);

  -- Queue 1 — direction-aware frontier walk.
  if not coalesce(v_has_completed, false) then
    if v_direction = 'forward'::hifz_direction then
      select gs into v_next_new
        from generate_series(1, 604) gs
       where not exists (
         select 1 from memorization_page mp
          where mp.student_id  = p_student_id
            and mp.page_number = gs
            and mp.status in ('memorized'::memorization_status,
                              'mastered'::memorization_status)
       )
       order by gs asc
       limit 1;
    else
      select gs into v_next_new
        from generate_series(604, 1, -1) gs
       where not exists (
         select 1 from memorization_page mp
          where mp.student_id  = p_student_id
            and mp.page_number = gs
            and mp.status in ('memorized'::memorization_status,
                              'mastered'::memorization_status)
       )
       order by gs desc
       limit 1;
    end if;
    if v_next_new is not null then
      v_new_pages := array[v_next_new];
    end if;
  end if;

  -- Simple revision — stalest memorized pages first, capped at v_revision_cap.
  select coalesce(array_agg(page_number order by stalest asc nulls first, page_number asc), '{}')
    into v_rev_pages
  from (
    select mp.page_number,
           (select min(ars.last_reviewed_at)
              from ayah_review_state ars
              join memorization_verse mv
                on mv.student_id   = mp.student_id
               and mv.surah_number = ars.surah_number
               and mv.ayah_number  = ars.ayah_number
               and mv.page_number  = mp.page_number
             where ars.student_id = mp.student_id) as stalest
      from memorization_page mp
     where mp.student_id = p_student_id
       and mp.status in ('memorized'::memorization_status,
                         'mastered'::memorization_status)
       and (v_next_new is null or mp.page_number <> v_next_new)
     order by stalest asc nulls first, page_number asc
     limit v_revision_cap
  ) sub;

  return query select v_new_pages, v_rev_pages;
end;
$$;

revoke execute on function _compute_session_plan(uuid) from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- today_session(uuid)
-- ---------------------------------------------------------------------------
-- The read RPC the Today view calls. Returns the latest daily_session row
-- for current_date, auto-creating session_index = 1 if none exists, and
-- joining page-typed completed-test ranges to attach attempted flags.

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

  select * into v_row from daily_session
   where student_id = p_student_id
     and session_date = current_date
   order by session_index desc
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
    returning * into v_row;
  end if;

  -- Pages attempted today: any page-typed range on a completed test today
  -- that includes the page. Surah/juz/ayah-typed ranges are ignored here for
  -- MVP (TestCreationModal currently only emits page ranges).
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

-- ---------------------------------------------------------------------------
-- load_next_session(uuid)
-- ---------------------------------------------------------------------------
-- Explicit "Load next session early" CTA — DESIGN.md §7.7. Computes a fresh
-- plan and inserts it at session_index = max(today) + 1. UI should only
-- expose this when all_attempted=true; we don't enforce it server-side (a
-- second session for the same date is a valid pedagogical choice).

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

  select coalesce(max(session_index), 0) into v_latest_index
    from daily_session
   where student_id = p_student_id
     and session_date = current_date;

  select c.new_lesson_pages, c.revision_pages
    into v_new_plan, v_rev_plan
    from _compute_session_plan(p_student_id) c;

  insert into daily_session
    (student_id, session_date, session_index, new_lesson_pages, revision_pages)
  values
    (p_student_id, current_date, v_latest_index + 1,
     coalesce(v_new_plan, '{}'::int[]),
     coalesce(v_rev_plan, '{}'::int[]))
  returning * into v_row;

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

revoke execute on function load_next_session(uuid) from anon, public;
grant  execute on function load_next_session(uuid) to authenticated;
