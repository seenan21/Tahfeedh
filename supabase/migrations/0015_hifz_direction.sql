-- 0015_hifz_direction.sql
-- ADR 0014: per-student hifz direction preference.
--
-- 1. New enum `hifz_direction` ('forward' | 'backward').
-- 2. New column `student_settings.hifz_direction` (default 'forward').
-- 3. `next_new_lesson(uuid)` rewritten to honor the direction.
-- 4. `commit_onboarding(uuid, jsonb)` rewritten to accept an optional
--    `hifzDirection` field in the payload and write it through.

-- ---------------------------------------------------------------------------
-- Enum + column
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'hifz_direction') then
    create type hifz_direction as enum ('forward', 'backward');
  end if;
end $$;

alter table student_settings
  add column if not exists hifz_direction hifz_direction not null default 'forward';

-- ---------------------------------------------------------------------------
-- next_new_lesson(uuid) — direction-aware
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

  -- Defensive default — a brand-new student with no settings row would not
  -- normally get this far (auth bootstrap creates one), but stay safe.
  if v_direction is null then
    v_direction := 'forward'::hifz_direction;
  end if;

  if v_direction = 'forward'::hifz_direction then
    select gs into v_next_page
      from generate_series(1, 604) gs
     where not exists (
       select 1 from memorization_page mp
        where mp.student_id = p_student_id
          and mp.page_number = gs
          and mp.status in ('memorized'::memorization_status, 'mastered'::memorization_status)
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
          and mp.status in ('memorized'::memorization_status, 'mastered'::memorization_status)
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
-- commit_onboarding(uuid, jsonb) — accept hifzDirection in payload
-- ---------------------------------------------------------------------------
--
-- Payload addition:
--   "hifzDirection": "forward" | "backward"   -- optional, defaults to current row value

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

  v_ayah_states := coalesce(p_payload -> 'ayahReviewStates', '[]'::jsonb);

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

revoke execute on function commit_onboarding(uuid, jsonb) from anon, public, authenticated;
grant  execute on function commit_onboarding(uuid, jsonb) to service_role;
