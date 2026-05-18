-- 0013_session_size_and_onboarding_writes.sql
-- Phase B (M3): half-page session size support + transactional onboarding bulk-write.
--
-- 1. pages_per_session_new becomes NUMERIC(3,1) so the algorithm can split a page
--    into two halves (DESIGN.md §6.3, half-page support). Both per-session counters
--    get a 20-page upper bound; juz-count alternative input is deferred to M5.
-- 2. commit_onboarding(p_student_id, p_payload) writes memorization_page,
--    memorization_verse, ayah_review_state, student_settings, and app_user atomically.
--    ayah_review_state RLS is SELECT-only for clients, so the Express server invokes
--    this function with the service role.

-- ---------------------------------------------------------------------------
-- Column type + check constraints
-- ---------------------------------------------------------------------------

alter table student_settings
  drop constraint if exists student_settings_pages_per_session_new_check;

alter table student_settings
  drop constraint if exists student_settings_pages_per_session_revision_check;

alter table student_settings
  alter column pages_per_session_new type numeric(3,1)
  using pages_per_session_new::numeric(3,1);

alter table student_settings
  add constraint student_settings_pages_per_session_new_chk
  check (pages_per_session_new between 0.5 and 20);

alter table student_settings
  add constraint student_settings_pages_per_session_revision_chk
  check (pages_per_session_revision between 0 and 20);

-- ---------------------------------------------------------------------------
-- Transactional onboarding-finish writer
-- ---------------------------------------------------------------------------
--
-- Payload shape (jsonb):
-- {
--   "memorizedPages":     [int, ...],                       -- pages fully memorized
--   "inProgress":         { "page": int,
--                           "verses": [{"surah":int, "ayah":int}, ...] }   -- optional
--   "ayahReviewStates":   [{"surah":int, "ayah":int}, ...], -- every covered ayah
--   "newPerDay":          numeric,
--   "revisionPerDay":     numeric,
--   "hasCompletedQuran":  boolean
-- }
--
-- All inserts use ON CONFLICT DO NOTHING so the function is safe to call twice
-- (e.g. if the client retries after a transient network error).

create or replace function commit_onboarding(
  p_student_id uuid,
  p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_memorized_pages    int[];
  v_in_progress_page   int;
  v_in_progress_verses jsonb;
  v_ayah_states        jsonb;
  v_new_per_day        numeric;
  v_revision_per_day   numeric;
  v_has_completed_quran boolean;
  v_stale_ts           timestamptz := now() - interval '30 days';
begin
  if p_payload is null then
    raise exception 'commit_onboarding: payload is required';
  end if;

  -- Required scalar fields
  v_new_per_day         := (p_payload ->> 'newPerDay')::numeric;
  v_revision_per_day    := (p_payload ->> 'revisionPerDay')::numeric;
  v_has_completed_quran := coalesce((p_payload ->> 'hasCompletedQuran')::boolean, false);

  if v_new_per_day is null or v_revision_per_day is null then
    raise exception 'commit_onboarding: newPerDay and revisionPerDay are required';
  end if;

  -- Array fields (default to empty arrays so coalesce/array_length work)
  select coalesce(array_agg((value)::int), array[]::int[])
    into v_memorized_pages
  from jsonb_array_elements_text(coalesce(p_payload -> 'memorizedPages', '[]'::jsonb));

  v_ayah_states := coalesce(p_payload -> 'ayahReviewStates', '[]'::jsonb);

  -- Optional in-progress block
  if (p_payload ? 'inProgress') and (p_payload -> 'inProgress') is not null then
    v_in_progress_page   := (p_payload -> 'inProgress' ->> 'page')::int;
    v_in_progress_verses := coalesce(p_payload -> 'inProgress' -> 'verses', '[]'::jsonb);
  end if;

  -- 1. memorized pages
  if array_length(v_memorized_pages, 1) is not null then
    insert into memorization_page (student_id, page_number, status, memorized_at)
    select p_student_id, pn, 'memorized'::memorization_status, v_stale_ts
    from unnest(v_memorized_pages) as pn
    on conflict (student_id, page_number) do nothing;
  end if;

  -- 2. in-progress page + per-ayah memorization rows
  if v_in_progress_page is not null then
    insert into memorization_page (student_id, page_number, status)
    values (p_student_id, v_in_progress_page, 'in_progress'::memorization_status)
    on conflict (student_id, page_number) do nothing;

    insert into memorization_verse (student_id, surah_number, ayah_number, page_number, memorized_at)
    select p_student_id,
           (v ->> 'surah')::int,
           (v ->> 'ayah')::int,
           v_in_progress_page,
           v_stale_ts
    from jsonb_array_elements(v_in_progress_verses) as v
    on conflict (student_id, surah_number, ayah_number) do nothing;
  end if;

  -- 3. ayah review state (bypasses Queue 2: recent_stage = null, see §6.3)
  insert into ayah_review_state (
    student_id, surah_number, ayah_number,
    last_reviewed_at, consecutive_clean_tests, recent_stage
  )
  select p_student_id,
         (v ->> 'surah')::int,
         (v ->> 'ayah')::int,
         v_stale_ts,
         0,
         null
  from jsonb_array_elements(v_ayah_states) as v
  on conflict (student_id, surah_number, ayah_number) do nothing;

  -- 4. session size + onboarding flag
  update student_settings
     set pages_per_session_new      = v_new_per_day,
         pages_per_session_revision = v_revision_per_day,
         onboarding_complete        = true
   where student_id = p_student_id;

  if not found then
    raise exception 'commit_onboarding: no student_settings row for %', p_student_id;
  end if;

  -- 5. completed-Quran flag lives on app_user (not student_settings, despite an
  --    earlier DESIGN.md draft — see ADR 0008).
  update app_user
     set has_completed_quran = v_has_completed_quran
   where id = p_student_id;
end;
$$;

revoke execute on function commit_onboarding(uuid, jsonb) from anon, public, authenticated;
grant execute on function commit_onboarding(uuid, jsonb) to service_role;
