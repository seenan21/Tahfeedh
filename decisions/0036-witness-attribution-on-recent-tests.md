# 0036 — Witness Attribution on Drill-in Recent Tests

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M6 (revision)

## Context

ADR 0033 deliberately kept `error_log` RLS narrow — a teacher can only read the per-occurrence errors for tests they personally administered, even though they can now SELECT every `test` row for an enrolled student. That leaves a UX gap on the drill-in's "Recent tests" list: the list shows all the student's tests (good — they want the full picture), but clicking a row navigates to `/tests/$testId/recap` which silently shows an empty error log for tests they didn't witness. Confusing.

The teacher needs to (a) visually distinguish which tests they witnessed vs which were self-tests / other-teacher tests, and (b) not be able to navigate into recaps they can't actually read.

## Decision

Per-row attribution + click gating on the drill-in's recent-tests list (`_authed.students.$studentId.tsx`).

### Row attribution

Each row carries a small leading badge with a lucide icon:

- `teacher_id === user.id` → `Eye` icon, sage filled, "Witnessed by you" — clickable.
- `test_mode === 'guest_teacher'` → `Lock` icon, gray light, "Self-test" — not clickable.
- `teacher_id` is some other UUID → `Lock` icon, gray light, "Another teacher" — not clickable.
- Fallback (test_mode not guest_teacher but `teacher_id` null) → gray "Other witness" — not clickable.

Derived inline via a `deriveWitnessLabel(row, isYours)` helper kept next to `ratingColor`.

### Click gating

Non-yours rows render with `cursor: 'default'`, reduced opacity (`0.75`), no `onClick`, and are wrapped in a Mantine `Tooltip` with the text "Recap details are only available to the witnessing teacher." Yours rows render unchanged — pointer cursor, full opacity, `onClick` → recap route.

### `fetchRecentTests` shape change

Query now selects `teacher_id` + `test_mode` in addition to the existing fields. `RecentTestRow` interface updated. No RLS change; this is purely client-side classification of rows already returned by the ADR 0033 widening.

### Rejected alternatives

- **Hide non-yours tests from the list entirely.** Removes confusion but also removes context — teacher loses sight of "this student has been testing without me." Worse for the teacher's situational awareness.
- **Open `error_log` RLS too, so recap works for any test.** Considered (per ADR 0033 alternatives) but rejected to avoid cross-teacher leakage of `error_log.teacher_note`.

## Consequences

- ✅ Teacher sees the full picture of the student's testing activity at a glance, with clear attribution.
- ✅ Dead-end navigation is prevented — teachers can't click into recaps that would render empty.
- ✅ The decision to keep `error_log` narrowly gated (ADR 0033) is preserved.
- ⚠️ The teacher's `/tests` history (`_authed.tests.index.tsx` teacher branch) doesn't need this attribution because it's already filtered to `teacher_id = self.id` — every row is theirs by construction. Keep that filter in place; don't accidentally relax it and require this UI here too.
