-- 0031_onboarding_memorization_verse.sql
--
-- Onboarding now populates `memorization_verse` for every memorized page.
-- Why this matters:
--   The 0029 algorithm rewrite (ADR 0050) replaced the layered Q2 → Q2b → Q3
--   revision-queue with a unified score that JOINs `memorization_page` ↔
--   `memorization_verse` ↔ `ayah_review_state`. Onboarded students who had
--   memorized pages but no memorization_verse rows (the old `commit_onboarding`
--   only wrote them for the in-progress page) ended up with an empty revision
--   queue — the page rows existed but no verses bridged them to the ayah-level
--   review state. The new payload field `memorizedVerses` (emitted by
--   `apps/server/src/onboarding/expand.ts`) bulk-inserts the rows so the
--   queue sees the pages immediately after onboarding completes.
--
-- Payload contract (new field marked):
--   {
--     "newPerDay": numeric,
--     "revisionPerDay": numeric,
--     "hifzDirection": "forward" | "backward",
--     "hasCompletedQuran": boolean,
--     "memorizedPages": int[],
--     "memorizedVerses": [{ surah, ayah, page }],   ← NEW
--     "inProgress": { page, verses: [{surah, ayah}] } | null,
--     "ayahReviewStates": [{ surah, ayah }]
--   }
--
-- Idempotent: re-running over the same student is safe (ON CONFLICT DO
-- NOTHING). Edit-Memorization (ADR 0039) re-calls `commit_onboarding` so
-- the existing rows survive.

create or replace function commit_onboarding(p_student_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_memorized_pages    int[];
  v_memorized_verses   jsonb;
  v_in_progress_page   int;
  v_in_progress_verses jsonb;
  v_ayah_states        jsonb;
  v_new_per_day        numeric;
  v_revision_per_day   numeric;
  v_has_completed_quran boolean;
  v_hifz_direction     hifz_direction;
  v_stale_ts           timestamptz := now() - interval '30 days';
begin
  if p_payload is null then
    raise exception 'commit_onboarding: payload is required';
  end if;

  v_new_per_day         := (p_payload ->> 'newPerDay')::numeric;
  v_revision_per_day    := (p_payload ->> 'revisionPerDay')::numeric;
  v_has_completed_quran := coalesce((p_payload ->> 'hasCompletedQuran')::boolean, false);

  if v_new_per_day is null or v_revision_per_day is null then
    raise exception 'commit_onboarding: newPerDay and revisionPerDay are required';
  end if;

  if p_payload ? 'hifzDirection' then
    begin
      v_hifz_direction := (p_payload ->> 'hifzDirection')::hifz_direction;
    exception when invalid_text_representation then
      raise exception 'commit_onboarding: hifzDirection must be forward or backward';
    end;
  end if;

  select coalesce(array_agg((value)::int), array[]::int[])
    into v_memorized_pages
  from jsonb_array_elements_text(coalesce(p_payload -> 'memorizedPages', '[]'::jsonb));

  v_memorized_verses := coalesce(p_payload -> 'memorizedVerses', '[]'::jsonb);
  v_ayah_states      := coalesce(p_payload -> 'ayahReviewStates', '[]'::jsonb);

  if (p_payload ? 'inProgress') and (p_payload -> 'inProgress') is not null then
    v_in_progress_page   := (p_payload -> 'inProgress' ->> 'page')::int;
    v_in_progress_verses := coalesce(p_payload -> 'inProgress' -> 'verses', '[]'::jsonb);
  end if;

  if array_length(v_memorized_pages, 1) is not null then
    insert into memorization_page (student_id, page_number, status, memorized_at)
    select p_student_id, pn, 'memorized'::memorization_status, v_stale_ts
    from unnest(v_memorized_pages) as pn
    on conflict (student_id, page_number) do nothing;
  end if;

  -- NEW (ADR 0052): bulk-insert the per-ayah rows for every memorized page so
  -- the revision-queue JOIN through `memorization_verse` finds them.
  insert into memorization_verse (student_id, surah_number, ayah_number, page_number, memorized_at)
  select p_student_id,
         (v ->> 'surah')::int,
         (v ->> 'ayah')::int,
         (v ->> 'page')::int,
         v_stale_ts
  from jsonb_array_elements(v_memorized_verses) as v
  on conflict (student_id, surah_number, ayah_number) do nothing;

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

  update student_settings
     set pages_per_session_new      = v_new_per_day,
         pages_per_session_revision = v_revision_per_day,
         onboarding_complete        = true,
         hifz_direction             = coalesce(v_hifz_direction, hifz_direction)
   where student_id = p_student_id;

  if not found then
    raise exception 'commit_onboarding: no student_settings row for %', p_student_id;
  end if;

  update app_user
     set has_completed_quran = v_has_completed_quran
   where id = p_student_id;
end;
$$;

revoke execute on function commit_onboarding(uuid, jsonb) from anon, public;
grant  execute on function commit_onboarding(uuid, jsonb) to authenticated, service_role;
