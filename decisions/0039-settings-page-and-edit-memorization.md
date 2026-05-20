# 0039 — Settings Page and Edit Memorization

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M7.5

## Context
The `_authed.settings.tsx` route has been an `EmptyState` stub since Phase A.
M7.5 bundles enough surface area (capacity, completed-Qur'an flag, hifz
direction, profile, Edit Memorization, and the M8 "Connect Quran.com" slot)
to be its own milestone. We need a settings page that touches three tables
under existing RLS (no new endpoints, no migration) and a non-trivial
Edit Memorization flow that lets a student recalibrate juz/surah claims.

## Decision

**Settings layout** (student):
1. Profile — read-only `display_name` + `email` + `role`.
2. Connect Quran.com — placeholder card; replaced in Phase 3.6 by the
   `ConnectQuranCom` component (ADR 0040).
3. Daily capacity — two `NumberInput`s wired to a single Save button.
   Direct `UPDATE student_settings` via Supabase JS under existing
   `student_settings_self_rw` RLS. Mirrors `Step3Sessions.tsx` bounds:
   `pages_per_session_new` ∈ [0.5, 20] step 0.5; `pages_per_session_revision`
   ∈ [0, 20] integer.
4. Hifz direction — two-card picker copied from `Step1Path.tsx`'s
   `DIRECTION_OPTIONS`. Each click direct-UPDATEs `student_settings.hifz_direction`
   and invalidates `next_new_lesson` + `today_session` so the queue picks
   up the new direction immediately.
5. Memorization status — `Switch` for `app_user.has_completed_quran` + an
   **Edit Memorization** button that navigates to `/onboarding?edit=1`.

**Teacher Settings** — Profile card only (per M7.5 spec).

**Edit Memorization** — recommended path from `notes-for-future.md`:
- `/onboarding` route now accepts `?edit=1` via TanStack `validateSearch`.
- `beforeLoad` gate relaxed: `user.onboardingComplete === true` is allowed
  when `search.edit === 1`. The fresh-onboarding redirect to `/today` only
  fires for the standard first-time path.
- Reducer gains a single new action `HYDRATE` that shallow-merges a
  `Partial<OnboardingState>` into the current state — the simplest
  mechanism to pre-populate from an async DB query.
- `apps/web/src/onboarding/hydrate.ts` derives the patch from
  `student_settings` + `memorization_page` rows joined to
  `quran-index.json`:
  - A juz is "selected" iff every page in its range is in the memorized
    set (status `memorized` or `mastered`).
  - A surah is "selected" iff every page covering it is memorized.
  - Partial surahs (some-but-not-all pages memorized) are **not**
    reconstructed with an `upToAyah` value — the student re-ticks them
    via the surah list. This is a deliberate scope cut (see Tradeoffs).
  - `inProgress` marker is left undefined. The underlying
    `memorization_verse` rows survive untouched, and `commit_onboarding`
    is idempotent.
- The reducer is force-pushed to `step: 2, path: 'partial'` so Step 2
  renders directly with the picker pre-filled. Step 3 still runs after
  Continue.
- On finish, edit mode navigates back to `/settings` (vs. `/today` for
  fresh) and shows a "Memorization updated" toast.

## Consequences
- ✅ Zero new SQL — direct UPDATEs under existing RLS for the three toggles;
  Edit Memorization reuses `commit_onboarding` (idempotent via
  `ON CONFLICT DO NOTHING`, migration 0013).
- ✅ Pre-fill UX preserves the user's existing juz/surah selections, so
  Edit Memorization is "add more" or "remove all" rather than "start from
  scratch."
- ✅ Direction change immediately retunes the Today queue via cache
  invalidation — no page reload required.
- ⚠️ Partial-surah `upToAyah` is lost on re-edit. A student who memorized
  surah 2 ayahs 1-100 and uses Edit Memorization will see surah 2 unticked.
  Re-ticking *without* an upToAyah would NOT regress data because the
  existing `memorization_verse` rows survive `commit_onboarding`'s
  `ON CONFLICT DO NOTHING`. But it does require the student to remember
  what they had. Acceptable for hackathon scope; documented for v2.
- ⚠️ Capacity sliders fire two separate query invalidations
  (`student_settings` + `today_session`). Cheap, but worth noting if the
  Today plan derivation ever moves to a heavier RPC.

## Files touched
- `apps/web/src/routes/_authed.settings.tsx` (full rewrite)
- `apps/web/src/routes/onboarding.tsx` (`validateSearch` + gate relax + hydration query + navigate-back)
- `apps/web/src/onboarding/state.ts` (`HYDRATE` action + reducer case)
- `apps/web/src/onboarding/hydrate.ts` (NEW — derivation helper)
- `apps/web/src/components/SkeletonRow.tsx` (referenced — see ADR pending)
- `apps/web/src/lib/toast.ts` (referenced)

## Reverses
(none — extends 0015 and notes-for-future.md's "Edit Memorization" entry)
