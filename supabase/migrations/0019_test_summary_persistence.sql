-- 0019_test_summary_persistence.sql
-- ADR 0022 — persist the post-test summary on the test row so the read-only
-- recap route (`/tests/:id/recap`) can render the NEW/RECURRING/CLEARED
-- classification for historical tests. error_location_stats is global
-- mutable state and gets decayed/overwritten by subsequent tests, so the
-- classification is only correct at submission time — we store it then.
--
-- Extends ADR 0017 (one fat SQL fn). Behavior of the returned jsonb is
-- unchanged; we just also UPDATE the test row with the same payload.

alter table test
  add column if not exists summary jsonb;

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

  -- 3. Touch ayah_review_state for every covered ayah.
  insert into ayah_review_state (
    student_id, surah_number, ayah_number, last_reviewed_at,
    consecutive_clean_tests, recent_stage
  )
  select v_test.student_id,
         (v ->> 'surah')::int,
         (v ->> 'ayah')::int,
         v_now,
         0,
         null
  from jsonb_array_elements(v_covered_ayahs) as v
  on conflict (student_id, surah_number, ayah_number) do update
    set last_reviewed_at = excluded.last_reviewed_at,
        updated_at       = v_now;

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

  -- 6. Page promotion: newly_memorized + strong_pass → in_progress→memorized.
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
