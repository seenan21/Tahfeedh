-- 0027_fix_compute_session_plan_q2b.sql
-- Bugfix on 0025_session_advancement_fix.sql.
--
-- Queue 2b in _compute_session_plan was written without wrapping the
-- filter+order+limit in a subquery, the way Queue 2 and Queue 3 are.
-- The result was an implicit whole-table aggregate (because of array_agg)
-- with `order by mp.page_number` at the query level — illegal, because
-- mp.page_number isn't in any GROUP BY at that point. Postgres rejected
-- every call to load_next_session with:
--
--   42803: column "mp.page_number" must appear in the GROUP BY clause
--          or be used in an aggregate function
--
-- Fix: wrap the candidate rows in a subquery (filter + order + limit),
-- then array_agg the result. Mirrors the shape of Queue 2 and Queue 3
-- in the same function. Function body otherwise unchanged.

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
  v_q2b_pages      int[];
  v_q3_pages       int[];
  v_q2_remaining   int;
  v_q2b_remaining  int;
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

  -- Queue 2b — Memorized pages with no review progression yet. Catches the
  -- onboarding-marked memorized pages (ars rows exist with recent_stage = NULL
  -- and graduated_at = NULL) so they aren't stranded outside the revision
  -- pipeline. Ordered by page_number asc (stable, predictable).
  if v_q2_remaining > 0 then
    select coalesce(array_agg(page_number order by page_number asc), '{}'::int[])
      into v_q2b_pages
    from (
      select mp.page_number
      from memorization_page mp
      where mp.student_id = p_student_id
        and mp.status in ('memorized'::memorization_status,
                          'mastered'::memorization_status)
        and (v_next_new is null or mp.page_number <> v_next_new)
        and not (mp.page_number = any(coalesce(v_q2_pages, '{}'::int[])))
        and not exists (
          select 1
            from memorization_verse mv2
            join ayah_review_state ars2
              on ars2.student_id   = mv2.student_id
             and ars2.surah_number = mv2.surah_number
             and ars2.ayah_number  = mv2.ayah_number
           where mv2.student_id = mp.student_id
             and mv2.page_number = mp.page_number
             and (ars2.recent_stage is not null or ars2.graduated_at is not null)
        )
      order by mp.page_number asc
      limit v_q2_remaining
    ) q2b;
  end if;

  v_q2b_remaining := greatest(v_q2_remaining - coalesce(array_length(v_q2b_pages, 1), 0), 0);

  -- Queue 3 — Old Revision. Graduated pages scored by priority formula.
  -- TODO M9: + mutashabihat_penalty term.
  if v_q2b_remaining > 0 then
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
          and not (mp.page_number = any(coalesce(v_q2b_pages, '{}'::int[])))
        group by mp.page_number
      )
      select
        pa.page_number,
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
      where pa.all_graduated
      order by score desc, pa.page_number asc
      limit v_q2b_remaining
    ) q3;
  end if;

  v_rev_pages := coalesce(v_q2_pages,  '{}'::int[])
              || coalesce(v_q2b_pages, '{}'::int[])
              || coalesce(v_q3_pages,  '{}'::int[]);

  return query select v_new_pages, v_rev_pages;
end;
$$;

revoke execute on function _compute_session_plan(uuid) from anon, public, authenticated;
