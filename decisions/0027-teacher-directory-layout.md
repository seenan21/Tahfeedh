# 0027 — Teacher Directory: Groups as Folders, Inline CRUD

**Date:** 2026-05-19
**Status:** Implemented (invite-code mechanics superseded by ADR 0028 same day)
**Milestone:** M6

> **Note:** the "Enroll via code" bullet below described the teacher entering the student's auto-generated `student_code`. That direction was flipped the same afternoon — see **ADR 0028**. The directory layout, group CRUD, drill-in, and Move-to-group menu in this ADR remain in force; only the invite-code semantics changed.

## Context

DESIGN.md §14.3 originally listed two teacher routes: `Students` (card-based list) and `Groups` (separate CRUD route). The Students route would link out to Groups for organizational work. By M6 implementation time, both routes are EmptyState stubs, and the question reopened: do groups deserve a dedicated route, or are they organizational chrome around the students list?

User direction (during M6 planning interrogation): "Groups should feel like a directory structure with files in it — the files being the students. E.g., 5 in Evening Class, 2 in Morning Class, 1 ungrouped."

## Decision

**Drop the separate `_authed.groups.tsx` route.** Fold all group CRUD into `_authed.students.tsx`. The Students page becomes the directory view:

```
┌─ [+ New group]  [Enroll via code]                         ┐
│  📁 Evening Class (5)        ⋮ (rename / delete)           │
│     Ali Mohammed     🔥 12  ✓ today  · last test 5h · strong│
│     Bilal Karim      🔥  3  partial   · last test 1d · good │
│     …                                                       │
│  📁 Morning Class (2)        ⋮                              │
│  📁 Ungrouped (1)            (no kebab)                     │
│     Random student   …                                      │
└─────────────────────────────────────────────────────────────┘
```

**Group mechanics (all direct Supabase JS under existing RLS — no migration, no Express endpoint):**

- **New group** — `+ New group` button → modal → `INSERT INTO student_group(teacher_id, name)`. Unique-per-teacher constraint on `(teacher_id, name)` surfaces as a friendly "name exists" error.
- **Rename** — kebab on group header → `UPDATE student_group SET name=$1 WHERE id=$2`.
- **Delete** — kebab on group header → `confirm()` then `DELETE FROM student_group WHERE id=$1`. The `enrollment.group_id` foreign key uses `ON DELETE SET NULL` (migration 0002), so the students automatically reappear under Ungrouped.
- **Move student** — Move icon on each row → small Menu listing all groups + "Remove from group". `UPDATE enrollment SET group_id=$1 WHERE id=$2`. Existing `en_teacher_all` RLS policy lets the teacher update their own enrollment rows directly — no service-role write needed.
- **Enroll via code** — `Enroll via code` button → modal → `SELECT enroll_via_code('123456')` RPC (preserves student-only RLS on `student_code` via the function's `SECURITY DEFINER`). New students land in Ungrouped — teacher moves them manually. No `student_code` schema changes.

**Sorting:** Within each group, students sort alphabetically by `display_name` (case-insensitive, null-named last). Groups sort alphabetically by name; Ungrouped is always the last section.

**Drill-in:** Clicking a student row navigates to `_authed.students.$studentId.tsx` — a teacher-specific dashboard mirroring the student's actual progress without rebuilding visuals. The drill-in reuses M7's `<ForecastCard>`, `<ActivityStatsCard>`, and `<RevisionHealthGrid>` with the `studentId` prop (ADR 0025's design intent). A "Start test for this student" button opens the existing `TestCreationModal` in a new `mode="enrolled_teacher"` flow.

**`TestCreationModal` extended** with `mode?: 'guest_teacher' | 'enrolled_teacher'` (default `'guest_teacher'`) and `subjectLabel?: string`. When `mode === 'enrolled_teacher'`: the witness field is hidden, the next-new-lesson pre-fill is disabled (the RPC reads `auth.uid()`, which is the teacher — meaningless here), and the request body switches to `{ test_mode: 'enrolled_teacher', student_id }`.

**Server: `POST /api/tests/create`** previously returned 501 for `enrolled_teacher` (the stub from Phase D). Now branches: when `enrolled_teacher`, looks up an active `enrollment` for `(teacher_id = caller, student_id)`, inserts with `student_id` from the payload and `teacher_id = caller`. Shared schema `testCreateSchema` gains an optional `student_id` UUID with a refine: required when `test_mode === 'enrolled_teacher'`.

## Consequences

- ✅ Mental model matches the user's metaphor — groups are folders, students are files, one screen owns both.
- ✅ Zero new SQL: every M6 write succeeds under existing RLS (`sg_owner` for `student_group`, `en_teacher_all` for `enrollment`).
- ✅ Drill-in is essentially free — three M7 cards reused via their `studentId` prop. No parallel teacher-side analytics implementation.
- ✅ Teacher-witnessed tests reach the live-test flow with `teacher_id` populated for the first time, unlocking proper "Tests" history attribution per DESIGN.md §14.5.
- ⚠️ Email isn't surfaced in the directory (the auth.users table isn't directly queryable client-side; only `display_name` from `app_user` is). Acceptable for MVP — student names suffice. Add an Express endpoint to expose emails if it matters later.
- ⚠️ Per-student rows fire `daily_streak` + `session_status_today` + last-test queries individually. Demo cohorts (3–5 students) fan out fine; a single batched RPC would be the perf knob if we ever see 50+ students per teacher.
- ⚠️ Drag-and-drop reassignment isn't built (cut per M6 plan). The Move-to-group menu covers the same ground with fewer surprises.
