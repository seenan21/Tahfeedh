-- 0014_marking_and_next_lesson.sql
-- Phase C (M2/M3): in-app memorization marking + Queue 1 (next new lesson).
--
-- 1. mark_memorization(p_student_id, p_payload)
--    Service-role write across memorization_page + memorization_verse +
--    ayah_review_state. ayah_review_state RLS is SELECT-only for clients,
--    so Express invokes this with the service role (ADR 0012).
--
-- 2. next_new_lesson(p_student_id)
--    Queue 1 (DESIGN.md §7.2): the lowest page past the student's contiguous
--    memorized frontier, plus a kind hint ('continue' | 'begin'). Callable
--    by the authenticated client for their own student_id (ADR 0013).

-- ---------------------------------------------------------------------------
-- 1. Memorization marking
-- ---------------------------------------------------------------------------
--
-- Payload shape (jsonb):
-- {
--   "pageNumber":   int,
--   "status":       "memorized" | "in_progress" | "untouched",
--   "ayahsOnPage":  [{"surah":int,"ayah":int}, ...],
--   "verses":       [{"surah":int,"ayah":int}, ...]    -- in_progress only
-- }
--
-- Express expands `pageNumber` -> `ayahsOnPage` against quran-index.json
-- (same data source as commit_onboarding) so the SQL stays index-free.

create or replace function mark_memorization(
  p_student_id uuid,
  p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_page_number int;
  v_status      text;
  v_ayahs       jsonb;
  v_verses      jsonb;
begin
  if p_payload is null then
    raise exception 'mark_memorization: payload is required';
  end if;

  v_page_number := (p_payload ->> 'pageNumber')::int;
  v_status      := p_payload ->> 'status';
  v_ayahs       := coalesce(p_payload -> 'ayahsOnPage', '[]'::jsonb);
  v_verses      := coalesce(p_payload -> 'verses',      '[]'::jsonb);

  if v_page_number is null or v_page_number < 1 or v_page_number > 604 then
    raise exception 'mark_memorization: pageNumber must be 1..604, got %', v_page_number;
  end if;

  if v_status not in ('memorized', 'in_progress', 'untouched') then
    raise exception 'mark_memorization: unknown status %', v_status;
  end if;

  if v_status = 'untouched' then
    delete from memorization_verse
      where student_id = p_student_id and page_number = v_page_number;
    delete from memorization_page
      where student_id = p_student_id and page_number = v_page_number;
    return;
  end if;

  if v_status = 'memorized' then
    -- Page row → memorized; clear any partial-verse rows from a prior in_progress state.
    insert into memorization_page (student_id, page_number, status, memorized_at)
    values (p_student_id, v_page_number, 'memorized'::memorization_status, now())
    on conflict (student_id, page_number) do update
      set status       = excluded.status,
          memorized_at = coalesce(memorization_page.memorized_at, excluded.memorized_at),
          updated_at   = now();

    delete from memorization_verse
      where student_id = p_student_id and page_number = v_page_number;

    -- ayah_review_state: every ayah on the page (algorithm input).
    insert into ayah_review_state (
      student_id, surah_number, ayah_number,
      last_reviewed_at, consecutive_clean_tests, recent_stage
    )
    select p_student_id,
           (v ->> 'surah')::int,
           (v ->> 'ayah')::int,
           null, 0, null
    from jsonb_array_elements(v_ayahs) as v
    on conflict (student_id, surah_number, ayah_number) do nothing;

    return;
  end if;

  -- v_status = 'in_progress'
  insert into memorization_page (student_id, page_number, status)
  values (p_student_id, v_page_number, 'in_progress'::memorization_status)
  on conflict (student_id, page_number) do update
    set status       = excluded.status,
        memorized_at = null,
        updated_at   = now();

  -- Replace partial-verse set: client sends the new authoritative list.
  delete from memorization_verse
    where student_id = p_student_id and page_number = v_page_number;

  insert into memorization_verse (student_id, surah_number, ayah_number, page_number, memorized_at)
  select p_student_id,
         (v ->> 'surah')::int,
         (v ->> 'ayah')::int,
         v_page_number,
         now()
  from jsonb_array_elements(v_verses) as v;

  insert into ayah_review_state (
    student_id, surah_number, ayah_number,
    last_reviewed_at, consecutive_clean_tests, recent_stage
  )
  select p_student_id,
         (v ->> 'surah')::int,
         (v ->> 'ayah')::int,
         null, 0, null
  from jsonb_array_elements(v_verses) as v
  on conflict (student_id, surah_number, ayah_number) do nothing;
end;
$$;

revoke execute on function mark_memorization(uuid, jsonb) from anon, public, authenticated;
grant  execute on function mark_memorization(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Queue 1: next new lesson
-- ---------------------------------------------------------------------------
--
-- Returns one row (page_number, kind) or zero rows when the student is done.
-- kind ∈ ('continue', 'begin'):
--   - 'continue' when the next page already has an in_progress row
--   - 'begin'    when the next page has no memorization_page row yet

create or replace function next_new_lesson(p_student_id uuid)
returns table(page_number int, kind text)
language plpgsql
security definer
set search_path = public as $$
declare
  v_has_completed boolean;
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

  -- Smallest page (1..604) that is NOT memorized/mastered for this student.
  select gs into v_next_page
    from generate_series(1, 604) gs
   where not exists (
     select 1 from memorization_page mp
      where mp.student_id = p_student_id
        and mp.page_number = gs
        and mp.status in ('memorized'::memorization_status, 'mastered'::memorization_status)
   )
   order by gs
   limit 1;

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
