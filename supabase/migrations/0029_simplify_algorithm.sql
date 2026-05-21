-- 0029_simplify_algorithm.sql
-- The big simplification (ADRs 0047–0051). Collapses:
--   * memorization_status from 3 values to 2 (drops `mastered` from app code)  — ADR 0047
--   * test_rating from 6 values to 2 (`pass` | `repeat`)                       — ADR 0048
--   * recent revision from 3 stages to 2 (stage 3 normalizes to graduated)     — ADR 0049
--   * Q2 → Q2b → Q3 layered revision queue → unified priority scoring          — ADR 0050
--   * pages_per_session_revision default from 5 → 3                            — ADR 0051
--
-- Supersedes ADR 0024 (M5 algorithm rules), parts of ADR 0037 (any-pass
-- advances — semantics absorbed into pass/repeat collapse). ADR 0038 still
-- applies (memorization_verse upsert step is preserved).
--
-- The old enum values stay defined in pg_type (Postgres doesn't support DROP
-- VALUE) — unused but harmless. The companion migration 0028 added the new
-- values; this migration does the data + function rewrites in one transaction.
--
-- ---------------------------------------------------------------------------
-- 1. Historical data migration
-- ---------------------------------------------------------------------------

-- 1a. Collapse historical test ratings into pass/repeat.
--     strong_pass | excellent | good | pass_needs_practice → pass
--     needs_work  | fail                                   → repeat
--     NULL (in-progress tests) → untouched.
update test
   set rating = case rating
     when 'strong_pass'::test_rating         then 'pass'::test_rating
     when 'excellent'::test_rating           then 'pass'::test_rating
     when 'good'::test_rating                then 'pass'::test_rating
     when 'pass_needs_practice'::test_rating then 'pass'::test_rating
     when 'needs_work'::test_rating          then 'repeat'::test_rating
     when 'fail'::test_rating                then 'repeat'::test_rating
     else rating
   end
 where rating in (
   'strong_pass'::test_rating, 'excellent'::test_rating, 'good'::test_rating,
   'pass_needs_practice'::test_rating, 'needs_work'::test_rating, 'fail'::test_rating
 );

-- 1b. Collapse mastered pages back to memorized.
update memorization_page
   set status = 'memorized'::memorization_status
 where status = 'mastered'::memorization_status;

-- 1c. Stage-3 ayahs become graduated (they finished the recent ladder, which
--     under the 2-stage model is exactly graduation).
update ayah_review_state
   set recent_stage = null,
       ready_at     = null,
       graduated_at = coalesce(graduated_at, now())
 where recent_stage = 3;

-- ---------------------------------------------------------------------------
-- 2. Schema changes
-- ---------------------------------------------------------------------------

-- The mastered_at column is no longer written or read. Drop for cleanliness.
alter table memorization_page drop column if exists mastered_at;

-- New signups default to 3 revision pages (was 5). Existing rows untouched.
alter table student_settings
  alter column pages_per_session_revision set default 3;

-- Pre-existing daily_session rows have no revision_kinds info. New rows
-- populate it at insert. Default '{}' so old rows survive without rewrite.
alter table daily_session
  add column if not exists revision_kinds text[] not null default '{}';

-- Constraint added LAST, after the UPDATE in 1c, so it doesn't fail on
-- stage=3 rows in flight.
alter table ayah_review_state
  drop constraint if exists ayah_review_state_recent_stage_chk;

alter table ayah_review_state
  add constraint ayah_review_state_recent_stage_chk
  check (recent_stage is null or recent_stage in (1, 2));

-- ---------------------------------------------------------------------------
-- 3. next_new_lesson — drop 'mastered' from status filter
-- ---------------------------------------------------------------------------

create or replace function next_new_lesson(p_student_id uuid)
returns table(page_number int, kind text)
language plpgsql
security definer
set search_path = public as $$
declare
  v_has_completed boolean;
  v_direction     hifz_direction;
  v_next_page     int;
  v_status        memorization_status;
begin
  if p_student_id is null or p_student_id <> auth.uid() then
    raise exception 'next_new_lesson: forbidden';
  end if;

  select has_completed_quran into v_has_completed
    from app_user where id = p_student_id;

  if v_has_completed then
    return;
  end if;

  select hifz_direction into v_direction
    from student_settings where student_id = p_student_id;

  v_direction := coalesce(v_direction, 'forward'::hifz_direction);

  if v_direction = 'forward'::hifz_direction then
    select gs into v_next_page
      from generate_series(1, 604) gs
     where not exists (
       select 1 from memorization_page mp
        where mp.student_id = p_student_id
          and mp.page_number = gs
          and mp.status = 'memorized'::memorization_status
     )
     order by gs asc
     limit 1;
  else
    select gs into v_next_page
      from generate_series(604, 1, -1) gs
     where not exists (
       select 1 from memorization_page mp
        where mp.student_id = p_student_id
          and mp.page_number = gs
          and mp.status = 'memorized'::memorization_status
     )
     order by gs desc
     limit 1;
  end if;

  if v_next_page is null then
    return;
  end if;

  select mp.status into v_status
    from memorization_page mp
   where mp.student_id = p_student_id and mp.page_number = v_next_page;

  return query select
    v_next_page,
    case when v_status = 'in_progress'::memorization_status then 'continue' else 'begin' end;
end;
$$;

revoke execute on function next_new_lesson(uuid) from anon, public;
grant  execute on function next_new_lesson(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. submit_test — 2-rating, 2-stage, no mastery
-- ---------------------------------------------------------------------------
-- ADR 0048 (pass/repeat), ADR 0049 (2-stage), ADR 0047 (no mastered).
--
-- newly_memorized + pass  → page promoted to memorized; ayah stage=1, ready=+1d
-- newly_memorized + repeat → page stays in_progress; review state untouched
--                             (except consec_clean reset if errors)
-- revision + pass + stage 1 → stage=2, ready=+3d
-- revision + pass + stage 2 → graduates (stage=NULL, graduated_at=now)
-- revision + pass + graduated → stays graduated
-- revision + repeat         → stage=1, ready=+1d (regression from anywhere)
-- consecutive_clean_tests still tracked (input to old-revision mastery dampener)

create or replace function submit_test(
  p_test_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_test               test%rowtype;
  v_rating             test_rating := (p_payload ->> 'rating')::test_rating;
  v_notes              text        := p_payload ->> 'notes';
  v_covered_ayahs      jsonb       := coalesce(p_payload -> 'coveredAyahs', '[]'::jsonb);
  v_covered_page_ayahs jsonb       := coalesce(p_payload -> 'coveredPageAyahs', '[]'::jsonb);
  v_covered_pages      int[];
  v_now                timestamptz := now();
  v_summary_new        jsonb;
  v_summary_recurring  jsonb;
  v_summary_cleared    jsonb;
  v_summary            jsonb;
  v_is_pass            boolean;
begin
  if p_payload is null then
    raise exception 'submit_test: payload is required';
  end if;
  if v_rating is null then
    raise exception 'submit_test: rating is required';
  end if;
  if v_rating not in ('pass'::test_rating, 'repeat'::test_rating) then
    raise exception 'submit_test: rating must be pass or repeat (got %)', v_rating;
  end if;

  v_is_pass := (v_rating = 'pass'::test_rating);

  -- 1. Lock the test row and validate state.
  select * into v_test from test where id = p_test_id for update;
  if v_test.id is null then
    raise exception 'submit_test: test % not found', p_test_id;
  end if;
  if v_test.status <> 'in_progress' then
    raise exception 'submit_test: test % is not in_progress (status=%)', p_test_id, v_test.status;
  end if;

  select coalesce(array_agg((value)::int), array[]::int[])
    into v_covered_pages
  from jsonb_array_elements_text(coalesce(p_payload -> 'coveredPages', '[]'::jsonb));

  -- 2. Close the test.
  update test
     set status     = 'completed',
         rating     = v_rating,
         notes      = v_notes,
         ended_at   = v_now,
         updated_at = v_now
   where id = p_test_id;

  -- 3. Touch ayah_review_state for every covered ayah + advance the 2-stage
  --    machine. consecutive_clean_tests incremented on clean ayahs, reset on
  --    errors (still useful: feeds the old-revision mastery dampener).
  with covered_ayahs as (
    select (v ->> 'surah')::int as surah, (v ->> 'ayah')::int as ayah
    from jsonb_array_elements(v_covered_ayahs) as v
  ),
  ayah_with_status as (
    select
      ca.surah,
      ca.ayah,
      not exists(
        select 1 from error_log el
         where el.test_id = p_test_id
           and el.surah_number = ca.surah
           and el.ayah_number  = ca.ayah
      ) as is_clean,
      coalesce(ars.consecutive_clean_tests, 0) as prev_clean,
      ars.recent_stage   as prev_stage,
      ars.graduated_at   as prev_graduated_at,
      ars.ready_at       as prev_ready_at
    from covered_ayahs ca
    left join ayah_review_state ars
      on ars.student_id   = v_test.student_id
     and ars.surah_number = ca.surah
     and ars.ayah_number  = ca.ayah
  )
  insert into ayah_review_state as t (
    student_id, surah_number, ayah_number,
    last_reviewed_at, consecutive_clean_tests, recent_stage,
    ready_at, graduated_at, updated_at
  )
  select
    v_test.student_id,
    aws.surah,
    aws.ayah,
    v_now,
    case when aws.is_clean then aws.prev_clean + 1 else 0 end,
    -- recent_stage transition
    case
      when v_test.test_type = 'newly_memorized' and v_is_pass         then 1
      when v_test.test_type = 'newly_memorized'                       then aws.prev_stage
      when aws.prev_graduated_at is not null                          then aws.prev_stage
      when v_rating = 'repeat'                                        then 1
      when aws.prev_stage is null                                     then 1
      when aws.prev_stage = 1                                         then 2     -- stage 1 pass → stage 2
      when aws.prev_stage = 2                                         then null  -- stage 2 pass → graduate
      else aws.prev_stage
    end,
    -- ready_at transition
    case
      when v_test.test_type = 'newly_memorized' and v_is_pass         then v_now + interval '1 day'
      when v_test.test_type = 'newly_memorized'                       then aws.prev_ready_at
      when aws.prev_graduated_at is not null                          then aws.prev_ready_at
      when v_rating = 'repeat'                                        then v_now + interval '1 day'
      when aws.prev_stage is null                                     then v_now + interval '1 day'
      when aws.prev_stage = 1                                         then v_now + interval '3 days'
      when aws.prev_stage = 2                                         then null  -- graduated → no ready_at
      else v_now + interval '1 day'
    end,
    -- graduated_at: set only on the stage 2 → null transition
    case
      when v_test.test_type = 'revision' and v_is_pass
           and aws.prev_stage = 2 and aws.prev_graduated_at is null   then v_now
      else aws.prev_graduated_at
    end,
    v_now
  from ayah_with_status aws
  on conflict (student_id, surah_number, ayah_number) do update
    set last_reviewed_at         = excluded.last_reviewed_at,
        consecutive_clean_tests  = excluded.consecutive_clean_tests,
        recent_stage             = excluded.recent_stage,
        ready_at                 = excluded.ready_at,
        graduated_at             = excluded.graduated_at,
        updated_at               = v_now;

  -- 4. Upsert error_location_stats from this test's streamed error_log rows.
  insert into error_location_stats (
    student_id, signature, surah_number, ayah_number, word_position, error_type,
    occurrence_count, first_seen_at, last_seen_at,
    tests_since_last_occurrence, cleared, updated_at
  )
  select distinct on (el.signature)
         v_test.student_id, el.signature, el.surah_number, el.ayah_number,
         el.word_position, el.error_type,
         1, v_now, v_now, 0, false, v_now
  from error_log el
  where el.test_id = p_test_id
  on conflict (student_id, signature) do update
    set occurrence_count            = error_location_stats.occurrence_count + 1,
        last_seen_at                = v_now,
        tests_since_last_occurrence = 0,
        cleared                     = false,
        updated_at                  = v_now;

  -- 5. Decay: stats whose ayah was tested but had no matching error this run
  --    get their counter incremented. Clear when counter reaches 3.
  with covered as (
    select (v ->> 'surah')::int as s, (v ->> 'ayah')::int as a
    from jsonb_array_elements(v_covered_ayahs) as v
  ),
  decayed as (
    update error_location_stats s
       set tests_since_last_occurrence = s.tests_since_last_occurrence + 1,
           cleared    = (s.tests_since_last_occurrence + 1 >= 3),
           updated_at = v_now
     where s.student_id = v_test.student_id
       and not s.cleared
       and exists (
         select 1 from covered c
          where c.s = s.surah_number and c.a = s.ayah_number)
       and not exists (
         select 1 from error_log el
          where el.test_id = p_test_id
            and el.signature = s.signature)
     returning s.signature, s.surah_number, s.ayah_number, s.word_position,
               s.error_type, s.occurrence_count, s.cleared
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'signature',       signature,
           'surah',           surah_number,
           'ayah',            ayah_number,
           'wordPosition',    word_position,
           'errorType',       error_type,
           'occurrenceCount', occurrence_count
         )) filter (where cleared), '[]'::jsonb)
    into v_summary_cleared
  from decayed;

  -- 6a. Page promotion on any pass (newly_memorized).
  if v_test.test_type = 'newly_memorized' and v_is_pass
     and array_length(v_covered_pages, 1) is not null then
    insert into memorization_page as mp (student_id, page_number, status, memorized_at)
    select v_test.student_id, pn, 'memorized'::memorization_status, v_now
      from unnest(v_covered_pages) as pn
    on conflict (student_id, page_number) do update
      set status       = 'memorized'::memorization_status,
          memorized_at = coalesce(mp.memorized_at, v_now),
          updated_at   = v_now;
  end if;

  -- 6b. memorization_verse upsert (ADR 0038) — populate for every fully-
  --     covered page so the revision queue's join finds them.
  if jsonb_array_length(v_covered_page_ayahs) > 0 then
    insert into memorization_verse (student_id, surah_number, ayah_number, page_number, memorized_at)
    select v_test.student_id,
           (v ->> 'surah')::int,
           (v ->> 'ayah')::int,
           (v ->> 'page')::int,
           v_now
    from jsonb_array_elements(v_covered_page_ayahs) as v
    on conflict (student_id, surah_number, ayah_number) do nothing;
  end if;

  -- 7. Build new/recurring lists from this test's stats rows.
  with this_test as (
    select s.signature, s.surah_number, s.ayah_number, s.word_position,
           s.error_type, s.occurrence_count
    from error_location_stats s
    where s.student_id = v_test.student_id
      and exists (
        select 1 from error_log el
         where el.test_id = p_test_id
           and el.signature = s.signature)
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'signature',       signature,
      'surah',           surah_number,
      'ayah',            ayah_number,
      'wordPosition',    word_position,
      'errorType',       error_type,
      'occurrenceCount', occurrence_count
    )) filter (where occurrence_count = 1), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'signature',       signature,
      'surah',           surah_number,
      'ayah',            ayah_number,
      'wordPosition',    word_position,
      'errorType',       error_type,
      'occurrenceCount', occurrence_count
    )) filter (where occurrence_count > 1), '[]'::jsonb)
    into v_summary_new, v_summary_recurring
  from this_test;

  v_summary := jsonb_build_object(
    'testId',    p_test_id,
    'new',       v_summary_new,
    'recurring', v_summary_recurring,
    'cleared',   v_summary_cleared
  );

  -- 8. Persist the summary on the test row so the recap view can read it.
  update test set summary = v_summary where id = p_test_id;

  return v_summary;
end;
$$;

revoke execute on function submit_test(uuid, jsonb) from anon, public, authenticated;
grant  execute on function submit_test(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 5. _compute_session_plan — unified revision priority scoring
-- ---------------------------------------------------------------------------
-- ADR 0050. Single UNION ALL of:
--   A. RECENT: pages with any ayah in stages 1-2, ready_at <= now()
--      score = 60 - (stage - 1) * 25 + sessions_overdue * 15
--      (stage 1 fresh = 60; stage 2 fresh = 35; stage 2 + 2d overdue = 65)
--   B. OLD: pages where every ayah graduated_at IS NOT NULL
--   C. NEVER-TESTED: memorized pages with no stage/graduation progression yet
--      Folded into the OLD formula path with natural defaults; the onboarding
--      30-day backdate puts them around score 30, and they climb naturally
--      via the +(days - 60)*10 overdue safety net.
--
-- Returns a third parallel column `revision_kinds text[]` so the UI can
-- render Recent/Older sub-headers without re-deriving from ars state.

create or replace function _compute_session_plan(p_student_id uuid)
returns table(new_lesson_pages int[], revision_pages int[], revision_kinds text[])
language plpgsql
security definer
set search_path = public as $$
declare
  v_direction      hifz_direction;
  v_has_completed  boolean;
  v_revision_cap   int;
  v_new_pages      int[] := '{}';
  v_rev_pages      int[] := '{}';
  v_rev_kinds      text[] := '{}';
  v_next_new       int;
begin
  select has_completed_quran into v_has_completed
    from app_user where id = p_student_id;

  select hifz_direction,
         coalesce(pages_per_session_revision, 3)::int
    into v_direction, v_revision_cap
    from student_settings where student_id = p_student_id;

  v_direction    := coalesce(v_direction, 'forward'::hifz_direction);
  v_revision_cap := greatest(coalesce(v_revision_cap, 3), 0);

  -- Queue 1 — direction-aware frontier walk.
  if not coalesce(v_has_completed, false) then
    if v_direction = 'forward'::hifz_direction then
      select gs into v_next_new
        from generate_series(1, 604) gs
       where not exists (
         select 1 from memorization_page mp
          where mp.student_id  = p_student_id
            and mp.page_number = gs
            and mp.status      = 'memorized'::memorization_status
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
            and mp.status      = 'memorized'::memorization_status
       )
       order by gs desc
       limit 1;
    end if;
    if v_next_new is not null then
      v_new_pages := array[v_next_new];
    end if;
  end if;

  -- Unified revision queue.
  with
  recent_pages as (
    select mp.page_number,
           min(ars.recent_stage) as min_stage,
           min(ars.ready_at)     as min_ready
    from memorization_page mp
    join memorization_verse mv
      on mv.student_id  = mp.student_id
     and mv.page_number = mp.page_number
    join ayah_review_state ars
      on ars.student_id   = mp.student_id
     and ars.surah_number = mv.surah_number
     and ars.ayah_number  = mv.ayah_number
    where mp.student_id = p_student_id
      and mp.status     = 'memorized'::memorization_status
      and ars.recent_stage is not null
      and ars.ready_at is not null
      and ars.ready_at <= now()
      and (v_next_new is null or mp.page_number <> v_next_new)
    group by mp.page_number
  ),
  recent_scored as (
    select rp.page_number,
           'recent'::text as kind,
           60.0
           - (rp.min_stage - 1) * 25.0
           + greatest(0, floor(extract(epoch from (now() - rp.min_ready)) / 86400.0)) * 15.0
             as score
    from recent_pages rp
  ),
  page_aggregates as (
    -- Pages eligible for the OLD pool: fully graduated OR never-tested-yet.
    -- Pages already in recent_pages are excluded.
    select
      mp.page_number,
      extract(epoch from (now() - coalesce(min(ars.last_reviewed_at), '1970-01-01'::timestamptz)))
        / 86400.0 as days_since_review,
      min(coalesce(ars.consecutive_clean_tests, 0)) as min_clean,
      bool_and(ars.graduated_at is not null)
        or bool_and(ars.recent_stage is null and ars.graduated_at is null)
        as eligible
    from memorization_page mp
    join memorization_verse mv
      on mv.student_id  = mp.student_id
     and mv.page_number = mp.page_number
    left join ayah_review_state ars
      on ars.student_id   = mp.student_id
     and ars.surah_number = mv.surah_number
     and ars.ayah_number  = mv.ayah_number
    where mp.student_id = p_student_id
      and mp.status     = 'memorized'::memorization_status
      and (v_next_new is null or mp.page_number <> v_next_new)
      and not exists (select 1 from recent_pages rp where rp.page_number = mp.page_number)
    group by mp.page_number
  ),
  older_scored as (
    select
      pa.page_number,
      'older'::text as kind,
      (pa.days_since_review * 1.0)
      + (coalesce((
          select count(*)::float
            from error_location_stats els
            join memorization_verse mv2
              on mv2.student_id  = els.student_id
             and mv2.surah_number = els.surah_number
             and mv2.ayah_number  = els.ayah_number
           where els.student_id  = p_student_id
             and not els.cleared
             and mv2.page_number = pa.page_number
        ), 0) / 3.0) * 20.0
      - (least(pa.min_clean, 5)::float / 5.0 * 3.0)
      + (case
          when exists (
            select 1
              from memorization_verse mv3
              join ayah_review_state ars3
                on ars3.student_id   = mv3.student_id
               and ars3.surah_number = mv3.surah_number
               and ars3.ayah_number  = mv3.ayah_number
             where mv3.student_id = p_student_id
               and mv3.page_number in (pa.page_number - 2, pa.page_number - 1,
                                       pa.page_number + 1, pa.page_number + 2)
               and ars3.last_reviewed_at >= now() - interval '3 days')
          then 1.0 else 0.0
        end)
      + greatest(0, pa.days_since_review - 60) * 10.0
      as score
    from page_aggregates pa
    where pa.eligible
  ),
  all_candidates as (
    select page_number, kind, score from recent_scored
    union all
    select page_number, kind, score from older_scored
  ),
  ranked as (
    select page_number, kind, score
    from all_candidates
    order by score desc, page_number asc
    limit v_revision_cap
  )
  select
    coalesce(array_agg(page_number order by score desc, page_number asc), '{}'::int[]),
    coalesce(array_agg(kind        order by score desc, page_number asc), '{}'::text[])
    into v_rev_pages, v_rev_kinds
  from ranked;

  return query select v_new_pages, v_rev_pages, v_rev_kinds;
end;
$$;

revoke execute on function _compute_session_plan(uuid) from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 6. today_session — thread revision_kinds through to JSONB rows
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
  v_rev_kinds        text[];
  v_attempted_pages  int[];
  v_total            int;
  v_attempted_count  int;
begin
  if p_student_id is null or (p_student_id <> auth.uid() and not is_my_student(p_student_id)) then
    raise exception 'today_session: forbidden';
  end if;

  select * into v_row from daily_session
   where student_id = p_student_id
     and session_date = current_date
   order by session_index desc
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
    returning * into v_row;
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

-- ---------------------------------------------------------------------------
-- 7. load_next_session — same return-shape change as today_session
-- ---------------------------------------------------------------------------

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

  select coalesce(max(session_index), 0) into v_latest_index
    from daily_session
   where student_id = p_student_id
     and session_date = current_date;

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
