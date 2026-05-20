# 0029 — Teacher Directory Polish: Realtime, Whole-Row Click, Drop Today Badge

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M6 (revision)

## Context

Three frictions surfaced in the teacher directory (`_authed.students.tsx`) after ADR 0028 shipped:

1. **Misleading "pending" badge.** The row's right-side status chip rendered `session_status_today` — `pending` meant "no session done today", but in classroom-app vocabulary it reads as "enrollment pending". For brand-new joiners every row looked unconfirmed.
2. **No live updates when a student joins.** `useTeacherStudents` is React-Query-only (30s stale time). Teachers had to refresh the page after sharing the invite code to see the new student appear — the trust-direction flip from ADR 0028 made this much more visible because the join now happens *while the teacher is watching*.
3. **Row click hit area was unreliable.** The outer `<Mantine.Group>` wrapping the row had the `onClick`, but in practice clicking the name area didn't navigate — likely the flex parent's whitespace not capturing bubbled events. The `Move` icon (lucide's 4-arrow) also read as a drag handle, suggesting drag-and-drop reordering that doesn't exist.

## Decision

### Drop the today badge from the row

Remove `fetchTodayStatus`, `TodayStatusRow`, `todayStatusBadge`, and the badge JSX entirely. Per-student today/partial/complete signal isn't useful at the directory level (the teacher can see it on the drill-in's ActivityStats / RevisionHealth cards). Keeps the row tighter.

### Supabase Realtime subscription on `enrollment`

`useTeacherStudents` opens a channel `teacher-enrollment-<teacherId>` listening for `postgres_changes` on `public.enrollment` filtered by `teacher_id=eq.<teacherId>` (INSERT + UPDATE). On any event it invalidates `teacher_enrollments` and `teacher_student_users` so the directory rehydrates. Channel torn down on unmount.

- **Migration `0022_realtime_enrollment.sql`**: `alter publication supabase_realtime add table enrollment;` — required for the channel to receive events. No other table is in the publication today; this is the first realtime surface in the app.
- RLS still gates payload visibility: the teacher only sees rows where `is_my_student()` would have let them read, i.e. enrollments where `teacher_id = auth.uid()`.

### Native `<div role="button">` for the row, not Mantine `<Group>`

Refactor `StudentRow`'s outer wrapper to a native `<div>` with `role="button"`, `tabIndex={0}`, explicit `onClick` + `onKeyDown` (Enter/Space). All flex layout inline-styled. The kebab-menu wrapper keeps `e.stopPropagation()` so the menu doesn't navigate.

This makes the entire row a single hit-target and adds keyboard navigability. Avoid `UnstyledButton` because the kebab `ActionIcon` (a `<button>`) inside it would be a button-in-button accessibility violation.

### Icon swap: `Move` → `FolderInput`

Replace lucide's `Move` (4-arrow) with `FolderInput` (folder with arrow going in) on the per-row kebab trigger. Reads as "send into a group", not "drag to reorder".

## Consequences

- ✅ "Pending" confusion gone — directory shows the student's group, name, streak, and last-test summary only.
- ✅ Students appear in the directory live, without the teacher refreshing. Closes the obvious UX gap from the ADR 0028 flow.
- ✅ Whole row is clickable + keyboard-navigable. Predictable hit area.
- ✅ Icon intent matches the menu it triggers.
- ⚠️ First realtime surface in the app. Future tables that want similar live updates need to be added to the `supabase_realtime` publication explicitly — established the precedent (one-line migration per table).
- ⚠️ Channel name uses `teacher-enrollment-<uuid>`; if two browser tabs of the same teacher are open they both subscribe (fine — independent channels). Connection count grows by 1 per open teacher tab.
