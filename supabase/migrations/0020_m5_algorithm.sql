-- 0020_m5_algorithm.sql
-- M5: complete the algorithm. Closes -- TODO M5+ markers in 0016 and 0017.
--
-- ADR 0024 — captures the chosen rules:
--   * Mastery: page promotes to 'mastered' when every ayah on the page has
--     consecutive_clean_tests >= 5 after a 'strong_pass' revision test.
--   * Fail: resets Queue 2 stage to 1 only. Page status unchanged.
--     ready_at = now + 1 day. Graduated pages drop back into Queue 2 stage 1.
--   * Queue 2 stage machine engages on the newly_memorized+strong_pass test
--     that promotes the page (per DESIGN.md §7.2: "Pages enter at stage 1 when
--     first marked memorized via strong_pass on a newly_memorized test").
--   * Queue 3: full priority formula minus mutashabihat_penalty (TODO M9).
--
-- "1 session" = "1 calendar day" for MVP scheduling intervals.
-- Stage 1 → ready_at = +1d; Stage 2 → +3d; Stage 3 → +7d; Graduated → NULL.

-- ---------------------------------------------------------------------------
-- submit_test rewrite
-- ---------------------------------------------------------------------------

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
  v_covered_pages      int[];
  v_now                timestamptz := now();
  v_summary_new        jsonb;
  v_summary_recurring  jsonb;
  v_summary_cleared    jsonb;
  v_summary            jsonb;
begin
  if p_payload is null then
    raise exception 'submit_test: payload is required';
  end if;
  if v_rating is null then
    raise exception 'submit_test: rating is required';
  end if;

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

  -- 2. Close the test (the table CHECK requires rating + ended_at on completed).
  update test
     set status     = 'completed',
         rating     = v_rating,
         notes      = v_notes,
         ended_at   = v_now,
         updated_at = v_now
   where id = p_test_id;

  -- 3. Touch ayah_review_state for every covered ayah AND advance the Queue 2
  --    stage machine. Per-ayah consecutive_clean_tests is incremented when the
  --    ayah had no error in this test, reset to 0 otherwise.
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
      when v_test.test_type = 'newly_memorized' and v_rating = 'strong_pass' then 1
      when v_test.test_type <> 'revision' then aws.prev_stage  -- preserve for other (fail on newly_memorized)
      when v_rating = 'fail' then 1
      when aws.prev_graduated_at is not null then aws.prev_stage  -- graduated stays graduated on non-fail
      when aws.prev_stage is null then 1
      when v_rating in ('strong_pass', 'excellent') then
        case when aws.prev_stage + 1 > 3 then null else aws.prev_stage + 1 end
      when v_rating = 'good' then aws.prev_stage
      when v_rating = 'pass_needs_practice' then aws.prev_stage  -- treated like 'good'
      when v_rating = 'needs_work' then greatest(1, aws.prev_stage - 1)
      else aws.prev_stage
    end,
    -- ready_at transition
    case
      when v_test.test_type = 'newly_memorized' and v_rating = 'strong_pass' then v_now + interval '1 day'
      when v_test.test_type <> 'revision' then aws.prev_ready_at
      when v_rating = 'fail' then v_now + interval '1 day'
      when aws.prev_graduated_at is not null then aws.prev_ready_at  -- graduated, leave NULL
      when aws.prev_stage is null then v_now + interval '1 day'
      when v_rating in ('strong_pass', 'excellent') then
        case
          when aws.prev_stage + 1 > 3 then null
          when aws.prev_stage + 1 = 2 then v_now + interval '3 days'
          when aws.prev_stage + 1 = 3 then v_now + interval '7 days'
          else v_now + interval '1 day'
        end
      when v_rating in ('good', 'pass_needs_practice') then
        case
          when aws.prev_stage = 1 then v_now + interval '1 day'
          when aws.prev_stage = 2 then v_now + interval '3 days'
          when aws.prev_stage = 3 then v_now + interval '7 days'
          else v_now + interval '1 day'
        end
      when v_rating = 'needs_work' then v_now + interval '1 day'
      else v_now + interval '1 day'
    end,
    -- graduated_at: set on transition past stage 3; cleared on fail (regression)
    case
      when v_test.test_type = 'newly_memorized' and v_rating = 'strong_pass' then null
      when v_test.test_type <> 'revision' then aws.prev_graduated_at
      when v_rating = 'fail' then null  -- regression: graduated pages drop back to Queue 2
      when aws.prev_stage is not null and v_rating in ('strong_pass', 'excellent')
           and aws.prev_stage + 1 > 3 then v_now
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

  -- 6a. Page promotion: newly_memorized + strong_pass → in_progress → memorized.
  if v_test.test_type = 'newly_memorized' and v_rating = 'strong_pass'
     and array_length(v_covered_pages, 1) is not null then
    update memorization_page
       set status       = 'memorized'::memorization_status,
           memorized_at = v_now,
           updated_at   = v_now
     where student_id  = v_test.student_id
       and page_number = any(v_covered_pages)
       and status      = 'in_progress'::memorization_status;
  end if;

  -- 6b. Mastery promotion: revision + strong_pass + every ayah on the page has
  --     consecutive_clean_tests >= 5 → memorized → mastered.
  --     The min across the page's ayahs is the gate (any weak ayah blocks it).
  if v_test.test_type = 'revision' and v_rating = 'strong_pass'
     and array_length(v_covered_pages, 1) is not null then
    update memorization_page mp
       set status      = 'mastered'::memorization_status,
           mastered_at = v_now,
           updated_at  = v_now
     where mp.student_id  = v_test.student_id
       and mp.page_number = any(v_covered_pages)
       and mp.status      = 'memorized'::memorization_status
       and not exists (
         select 1
         from memorization_verse mv
         left join ayah_review_state ars
           on ars.student_id   = mv.student_id
          and ars.surah_number = mv.surah_number
          and ars.ayah_number  = mv.ayah_number
         where mv.student_id  = mp.student_id
           and mv.page_number = mp.page_number
           and coalesce(ars.consecutive_clean_tests, 0) < 5
       );
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
-- _compute_session_plan rewrite
-- ---------------------------------------------------------------------------
-- Queue 2 (Recent Revision): pages with any ayah where recent_stage IS NOT NULL
--   AND ready_at <= now(). Ordered by min(recent_stage) asc, then min(ready_at) asc
--   (per DESIGN.md §7.3 — lower stages need it more).
-- Queue 3 (Old Revision): graduated pages (every ayah has graduated_at NOT NULL),
--   scored by the DESIGN.md §7.2 priority formula minus mutashabihat_penalty (M9).

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
  v_q2_pages       int[];
  v_q3_pages       int[];
  v_q2_remaining   int;
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

  -- Queue 2 — Recent Revision. Pages with any ayah in stages 1-3 whose ready_at
  -- has passed. Sort by min(stage) asc, then min(ready_at) asc.
  select coalesce(array_agg(page_number order by min_stage asc, min_ready asc, page_number asc), '{}'::int[])
    into v_q2_pages
  from (
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
      and mp.status in ('memorized'::memorization_status,
                        'mastered'::memorization_status)
      and ars.recent_stage is not null
      and ars.ready_at is not null
      and ars.ready_at <= now()
      and (v_next_new is null or mp.page_number <> v_next_new)
    group by mp.page_number
    order by min(ars.recent_stage) asc, min(ars.ready_at) asc, mp.page_number asc
    limit v_revision_cap
  ) q2;

  v_q2_remaining := greatest(v_revision_cap - coalesce(array_length(v_q2_pages, 1), 0), 0);

  -- Queue 3 — Old Revision. Graduated pages scored by priority formula.
  -- TODO M9: + mutashabihat_penalty term.
  if v_q2_remaining > 0 then
    select coalesce(array_agg(page_number order by score desc, page_number asc), '{}'::int[])
      into v_q3_pages
    from (
      with page_aggregates as (
        select
          mp.page_number,
          extract(epoch from (now() - min(coalesce(ars.last_reviewed_at, '1970-01-01'::timestamptz))))
            / 86400.0 as days_since_review,
          min(coalesce(ars.consecutive_clean_tests, 0)) as min_clean,
          bool_and(ars.graduated_at is not null)        as all_graduated
        from memorization_page mp
        join memorization_verse mv
          on mv.student_id  = mp.student_id
         and mv.page_number = mp.page_number
        left join ayah_review_state ars
          on ars.student_id   = mp.student_id
         and ars.surah_number = mv.surah_number
         and ars.ayah_number  = mv.ayah_number
        where mp.student_id = p_student_id
          and mp.status in ('memorized'::memorization_status,
                            'mastered'::memorization_status)
          and (v_next_new is null or mp.page_number <> v_next_new)
          and not (mp.page_number = any(coalesce(v_q2_pages, '{}'::int[])))
        group by mp.page_number
      )
      select
        pa.page_number,
        -- DESIGN.md §7.2 weights:
        --   recency*1.0 + errors*20.0 - mastery*3.0 + cohesion + overdue*10.0
        (pa.days_since_review * 1.0)
        + (coalesce((
            -- error_rate proxy: active (non-cleared) error signatures on this page
            -- normalized to /3 to approximate "fraction of last 3 tests with errors"
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
      where pa.all_graduated
      order by score desc, pa.page_number asc
      limit v_q2_remaining
    ) q3;

    v_rev_pages := coalesce(v_q2_pages, '{}'::int[]) || coalesce(v_q3_pages, '{}'::int[]);
  else
    v_rev_pages := coalesce(v_q2_pages, '{}'::int[]);
  end if;

  return query select v_new_pages, v_rev_pages;
end;
$$;

revoke execute on function _compute_session_plan(uuid) from anon, public, authenticated;
