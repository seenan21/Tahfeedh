-- 0026_submit_test_memorization_verse.sql
-- ADR 0038 — Closes the deferred gap from ADR 0037.
--
-- After 0025, `submit_test` UPSERTs `memorization_page` on any pass, but does
-- not write `memorization_verse` rows. The revision queue's Queue 2 join
-- (memorization_page → memorization_verse → ayah_review_state) therefore
-- never finds the page's ayahs, and the page falls into Queue 2b's flat-
-- priority fallback instead of the stage machine.
--
-- Fix: `submit_test` now UPSERTs `memorization_verse` from a new payload field
-- `coveredPageAyahs: Array<{page, surah, ayah}>`. The Express resolver
-- (apps/server/src/pipelines/post-test/resolve.ts) emits this for every
-- fully-covered page. The insert is `ON CONFLICT DO NOTHING` because an ayah's
-- canonical page in the QPC layout is fixed — existing rows from onboarding
-- (the inProgress page) are preserved untouched.
--
-- Runs regardless of test_type or pass/fail. A failed `newly_memorized` test
-- will still write the rows; the page just won't be promoted to `memorized`
-- (status stays `in_progress`), and Queue 2's status filter keeps it out of
-- the revision queue until a later pass promotes it. Harmless.

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

  v_is_pass := v_rating in (
    'strong_pass'::test_rating,
    'excellent'::test_rating,
    'good'::test_rating,
    'pass_needs_practice'::test_rating
  );

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

  update test
     set status     = 'completed',
         rating     = v_rating,
         notes      = v_notes,
         ended_at   = v_now,
         updated_at = v_now
   where id = p_test_id;

  -- 3. Touch ayah_review_state + run the Queue 2 stage machine.
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
    case
      when v_test.test_type = 'newly_memorized' and v_is_pass then 1
      when v_test.test_type <> 'revision' then aws.prev_stage
      when v_rating = 'fail' then 1
      when aws.prev_graduated_at is not null then aws.prev_stage
      when aws.prev_stage is null then 1
      when v_rating in ('strong_pass', 'excellent') then
        case when aws.prev_stage + 1 > 3 then null else aws.prev_stage + 1 end
      when v_rating = 'good' then aws.prev_stage
      when v_rating = 'pass_needs_practice' then aws.prev_stage
      when v_rating = 'needs_work' then greatest(1, aws.prev_stage - 1)
      else aws.prev_stage
    end,
    case
      when v_test.test_type = 'newly_memorized' and v_is_pass then v_now + interval '1 day'
      when v_test.test_type <> 'revision' then aws.prev_ready_at
      when v_rating = 'fail' then v_now + interval '1 day'
      when aws.prev_graduated_at is not null then aws.prev_ready_at
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
    case
      when v_test.test_type = 'newly_memorized' and v_is_pass then null
      when v_test.test_type <> 'revision' then aws.prev_graduated_at
      when v_rating = 'fail' then null
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

  -- 3b. Backfill memorization_verse for every (page, surah, ayah) of every
  --     fully-covered page so the revision-queue join can find them. ON
  --     CONFLICT DO NOTHING — onboarding-seeded rows (memorized_at = stale
  --     timestamp) are preserved; new pages get memorized_at = v_now. New in
  --     migration 0026 / ADR 0038.
  insert into memorization_verse (student_id, surah_number, ayah_number, page_number, memorized_at)
  select v_test.student_id,
         (v ->> 'surah')::int,
         (v ->> 'ayah')::int,
         (v ->> 'page')::int,
         v_now
  from jsonb_array_elements(v_covered_page_ayahs) as v
  on conflict (student_id, surah_number, ayah_number) do nothing;

  -- 4. error_location_stats upsert.
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

  -- 5. error decay.
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

  -- 6a. Page promotion: newly_memorized + any pass → memorized (UPSERT).
  if v_test.test_type = 'newly_memorized' and v_is_pass
     and array_length(v_covered_pages, 1) is not null then
    insert into memorization_page as mp (student_id, page_number, status, memorized_at)
    select v_test.student_id, pn, 'memorized'::memorization_status, v_now
      from unnest(v_covered_pages) as pn
    on conflict (student_id, page_number) do update
      set status       = case
                           when mp.status = 'mastered'::memorization_status
                             then 'mastered'::memorization_status
                           else 'memorized'::memorization_status
                         end,
          memorized_at = case
                           when mp.status = 'mastered'::memorization_status
                             then mp.memorized_at
                           else coalesce(mp.memorized_at, v_now)
                         end,
          updated_at   = v_now;
  end if;

  -- 6b. Mastery promotion: revision + strong_pass + every ayah on page has
  --     consecutive_clean_tests >= 5 → memorized → mastered.
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

  -- 7. Build new/recurring lists.
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

  update test set summary = v_summary where id = p_test_id;

  return v_summary;
end;
$$;

revoke execute on function submit_test(uuid, jsonb) from anon, public, authenticated;
grant  execute on function submit_test(uuid, jsonb) to service_role;
