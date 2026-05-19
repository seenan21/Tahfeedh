# 0015 — Memorization Status Is Test-Driven (No Manual Marking Post-Onboarding)

**Date:** 2026-05-18
**Status:** Implemented
**Milestone:** M2 / M3 (Phase C course-correction)

## Context
Phase C shipped a `MarkPageModal` and `POST /api/memorization/mark` endpoint on the `/mushaf` route that let a student directly set any page's `memorization_page.status` to `memorized`, `in_progress`, or `untouched`. This contradicts the design philosophy in two places:

- **DESIGN.md §13.5** (Post-Test Processing Pipeline, "Memorization status promotion") makes test passes the only mechanism that promotes a page through `in_progress → memorized → mastered`. The whole point of a witnessed test (ADR 0004) is that status changes are *earned*, not declared.
- **DESIGN.md §3.1** ("Hifz is human-witnessed"): the trust model requires a witness — teacher or guest — to validate a passage. Self-marking circumvents that.

Onboarding is the one legitimate exception: a one-time capture of the student's starting state via `commit_onboarding`. The Settings page (DESIGN.md §14.2) was meant to expose "Edit Memorization" — but per design, that "reopens onboarding Step 2 with current state pre-populated" — it is the same bulk-write flow, not a per-page marking surface.

## Decision
Post-onboarding, `memorization_page.status` is changed only by:

1. **The post-test pipeline** (Phase D, M4) — the canonical path. `strong_pass` on a `newly_memorized` test promotes `in_progress → memorized`. Continued clean revision tests promote `memorized → mastered`. Failures may downgrade.
2. **The "Edit Memorization" settings flow** (M7) — re-runs onboarding's capture step with current state pre-populated. Reuses `commit_onboarding`; not a per-page UI.

What was removed this session:

- `apps/server/src/routes/memorization.ts` — the `POST /api/memorization/mark` endpoint.
- `apps/server/src/index.ts` — the `/api/memorization` mount.
- `apps/web/src/mushaf/MarkPageModal.tsx` — the per-page marking modal.
- All references in `_authed.mushaf.tsx`.

What was kept:

- `apps/server/src/memorization/pageAyahs.ts` — still useful for the future "Edit Memorization" flow and for the Phase D post-test pipeline's page-coverage math.
- `supabase` function `mark_memorization(uuid, jsonb)` from migration 0014 — left in the DB but unreachable (no client RLS path, no service-role caller). When the recalibrate-via-settings flow lands (post-M8 per the user), the function can either be wired up or dropped at that time.

## Consequences
- ✅ Aligns the product with its stated philosophy: status is *earned* through witnessed tests.
- ✅ Removes a temptation to game streaks/progress by self-marking. The pedagogy survives the UI.
- ✅ The `/mushaf` route is freed to become what DESIGN.md §10.6 / §14.2 always intended: a reader-first surface with the page deep-dive (history, errors, tests, full mushaf rendering).
- ⚠️ ADR 0012 ("Memorization Marking via Express + SQL Function") is effectively reserved — the endpoint exists in spirit only. Its status is updated to reflect that.
- ⚠️ Until the post-test pipeline ships in Phase D, a student cannot move a page out of the onboarding-captured set at all. This is correct, not a gap: tests are the only path.
- ⚠️ A "force recalibrate" exit-hatch is acknowledged for post-M8 in `notes-for-future.md` — for instance, a student who realizes they over-claimed at onboarding. That flow either reopens onboarding's capture step or wires up `mark_memorization` behind a settings-only surface.

## Reverses
0012 (effectively — that ADR's endpoint shape is reserved, not actively used)
