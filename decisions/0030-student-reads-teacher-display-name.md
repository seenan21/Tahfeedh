# 0030 — Students Read Their Teachers' Display Names via RLS

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M6 (revision)

## Context

ADR 0028 added the student-side Classroom tab (`_authed.classroom.tsx`) which lists a student's active teachers. The query joins `enrollment` → `app_user` to surface `display_name`, but the embedded teacher row always came back null — every teacher rendered as "Unnamed teacher" in the UI.

Root cause: `app_user_select` (migration `0008_rls.sql:31-33`) only allows:

```sql
using (id = auth.uid() or is_my_student(id))
```

That covers the teacher → student direction (`is_my_student`) and self-reads. The mirror — student → teacher — was never added because before ADR 0028 students had no reason to read teacher rows. The flip introduced that need but didn't update RLS.

## Decision

Add a second `SELECT` policy on `app_user` that lets a student read any `app_user` row corresponding to a teacher they have an **active** enrollment with. PostgreSQL OR's multiple policies for the same operation, so the existing teacher→student policy stays untouched.

**Migration `0023_student_reads_teacher_app_user.sql`:**

```sql
create policy app_user_select_my_teacher
  on app_user for select
  using (
    exists (
      select 1 from enrollment e
       where e.teacher_id = app_user.id
         and e.student_id = auth.uid()
         and e.status = 'active'
    )
  );
```

Status gate (`= 'active'`) means leaving a teacher (via `leave_teacher`, which flips the row to `'paused'`) immediately revokes the student's read access to that teacher's profile — symmetric with how `is_my_student()` works the other way.

### Rejected alternatives

- **Define an `is_my_teacher(uuid)` helper.** Symmetric naming, but used in only one policy today — premature abstraction. Inline the `exists` clause; lift to a helper if a second caller appears.
- **Extend `app_user_select` in place with an OR.** Would require dropping + recreating the existing policy. Adding a second policy is additive, lower-blast-radius, and idempotent.
- **Bake the lookup into a SECURITY DEFINER RPC.** Heavier — would need new RPC + frontend rewrite, just to read a single column. Direct PostgREST + the new policy is cheaper.

## Consequences

- ✅ Students see real teacher names in the Classroom tab; no other code change needed.
- ✅ Symmetric to the teacher's `is_my_student` read access — both sides of an active enrollment can see each other's `display_name` / role / completed-quran flag (the only columns on `app_user`).
- ⚠️ The policy exposes *all* columns of the teacher's `app_user` row to the student, not just `display_name`. Today `app_user` only carries `id`, `role`, `display_name`, `completed_quran_at`, and timestamps — nothing sensitive. Revisit if PII-bearing columns are ever added; at that point switch to a column-restricted view.
