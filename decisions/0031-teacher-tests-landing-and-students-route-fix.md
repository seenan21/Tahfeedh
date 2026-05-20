# 0031 — Teacher `/tests` History + Students Route Nesting Fix

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M6 (revision)

## Context

Two issues surfaced testing the teacher flow after ADR 0029/0030 shipped:

1. **Clicking a student row in the teacher directory updated the URL but the page didn't change.** TanStack file-based routing treats `_authed.students.tsx` as a **layout parent** of `_authed.students.$studentId.tsx` because of the `.` segment naming. The directory file didn't render `<Outlet />`, so the drill-in had nowhere to mount — the URL changed, the child route matched, nothing rendered. Same shape as `_authed.tests.tsx` (which doesn't exist — `_authed.tests.index.tsx` is used as the leaf), but the students area accidentally used the layout pattern.

2. **Teacher's `/tests` landing showed student-shaped UI.** "Begin a self-test" CTA, activity sparkline, recent tests with no student names. M6 (ADR 0027) added the drill-in's "Start test for this student" entry point but never updated the global Tests route — a teacher visiting `/tests` saw the same self-test surface a student sees, with their administered tests in the "Recent tests" list but framed as if they ran them themselves.

## Decision

### Route nesting fix

Rename `apps/web/src/routes/_authed.students.tsx` → `_authed.students.index.tsx`. Now both `students.index` and `students.$studentId` are siblings under `_authed`, with no implicit layout parent — same shape as the tests routes. The directory page works at `/students/`, the drill-in at `/students/$studentId`. Route tree regenerated.

### Teacher branch in `/tests`

`_authed.tests.index.tsx` `TestsPage` now branches on `user.role`:

- **Student** (default) — unchanged: "Begin a self-test" card + 30-day activity sparkline + recent tests list.
- **Teacher** — new `TeacherTestsHistory` component:
  - **No CTAs** — no self-test entry, no "start from Students" hint. The drill-in already owns test creation (per ADR 0027); putting another CTA here would duplicate it.
  - **No sparkline** — a teacher administering across many students doesn't get useful information from a single aggregated count.
  - **Just a history list.** 30 most-recent completed tests where `teacher_id = self.id`, each row shows: student display name (resolved via a second query into `app_user.display_name`, gated by the teacher → student `is_my_student` RLS direction), New-lesson / Revision badge, range, relative time, rating badge. Whole row clickable → `/tests/$testId/recap`.

### Why a separate fetch for student names

The Supabase JS embedded FK join (`app_user!test_student_id_fkey(display_name)`) is brittle when multiple FKs land on the same target table — keep it simple: one `test` query + one `app_user` query keyed by collected `student_id`s. Pattern matches what the Classroom tab already does (`fetchTeachersFallback` in `_authed.classroom.tsx`).

## Consequences

- ✅ Clicking a student row now actually navigates to the drill-in.
- ✅ Teacher's `/tests` shows the right thing — administered tests with names, no false self-test affordance.
- ✅ Drill-in's "Start test for this student" remains the single canonical entry for teacher-administered tests; no entry-point duplication.
- ⚠️ `_authed.students.index.tsx` is the new directory file path — any future internal `<Link to="/students" />` already works (TanStack resolves `/students` → `students.index`); but anything importing the old file path will break. None today.
- ⚠️ Teacher history limited to the 30 most recent — no paging. Acceptable for hackathon; add infinite-scroll if a teacher's volume warrants it.
- ⚠️ Student-name fetch uses `is_my_student()` RLS. If an enrollment is paused before the teacher reloads the page, the student's name will fall back to "Unnamed student" on previously-administered tests. Acceptable — the test history is still readable, the name just goes silent.
