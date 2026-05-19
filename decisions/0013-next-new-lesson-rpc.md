# 0013 — Queue 1 ("Next New Lesson") Lives in Postgres

**Date:** 2026-05-18
**Status:** Implemented
**Milestone:** M3 / M5 (Phase C bootstraps it; M5 expands the full algorithm)

## Context
PLAN.md task 10 wires Today's "new lesson" empty slot to a real value: the next un-memorized page on the student's memorization frontier (DESIGN.md §7.2 Queue 1).

Three places this could live:
1. **Postgres function (SECURITY DEFINER)** — `next_new_lesson(p_student_id)` invoked via `supabase.rpc` from Today.
2. **Client-side** — Today already fetches `memorization_page` rows for `JuzProgressBar`; we could derive the frontier in TS in the same query result.
3. **Express endpoint** — `GET /api/today/next-lesson` doing the read + walk.

Queue 1 is also one of the inputs the post-test pipeline (Phase D) needs server-side: after a `strong_pass`, the next new lesson recomputes and is what tomorrow's plan card displays. Both callers want the same answer; only one of the three options puts it in a place both can reach without duplicating logic.

## Decision
Add `next_new_lesson(p_student_id uuid) returns table(page_number int, kind text)` as a SECURITY DEFINER function in migration 0014. Pinned `search_path = public`. Granted to `authenticated` (it reads only the caller's own state, gated on `p_student_id = auth.uid()` inside the body — same defensive check used elsewhere when the body trusts a UUID argument).

Body (frontier walk):

1. If `app_user.has_completed_quran = true` → return empty (M5 will swap in a revision-only plan; for now Today simply shows the "whole-Quran" empty state).
2. Find the lowest page where `memorization_page.status = 'in_progress'` for this student. If one exists and there is no fully-memorized page after it (continuation case), return `(page, 'continue')`.
3. Otherwise return `(min(page_number) over 1..604 where no memorization_page row exists, 'begin')`.
4. If all 604 pages have a row and none is `in_progress` → empty (covers a student who memorized everything ayah-by-ayah).

Return shape carries a `kind` so the UI can render "Continue page 50" vs "Begin page 51" without re-deriving from the page row.

## Consequences
- ✅ Single source of truth for "what's next" usable by Today (now), Phase D's post-test pipeline, and M5's full algorithm without duplication.
- ✅ Frontier walk is a single index-backed query, faster on the server than shipping every row to the browser and walking in JS.
- ✅ Forward-compatible: M5's algorithm function (`compute_session_plan`) can call this internally for the new-lesson slot.
- ⚠️ Adds another RPC the client must know about. Tracked in `supabase/migrations/CLAUDE.md` index entry for 0014.
- ⚠️ `kind` is a free text return, not an enum, because adding a Postgres enum just for an RPC return value is over-engineered. Documented as `'continue' | 'begin'` in the shared types instead.
