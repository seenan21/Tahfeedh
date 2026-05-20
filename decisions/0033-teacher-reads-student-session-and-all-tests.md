# 0033 — Teacher Reads Student's Session + All Student Tests

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M6 (revision)

## Context

After ADR 0032 expanded the teacher drill-in with reused today/progress components, two parts failed for the teacher viewer:

1. **`SessionPlanCard` showed "Couldn't load today's session — RPC isn't reachable."** `today_session(p_student_id)` guards on `p_student_id <> auth.uid()` (migration 0018) and raises `forbidden`. The teacher passing the student's UUID gets rejected outright.
2. **"Recent tests" was empty for some students.** The `test_teacher_all` RLS policy (migration 0008) restricts teacher access to rows where `teacher_id = auth.uid()` — so self-tests and tests with other teachers are invisible. A teacher who hasn't yet personally witnessed a test for that student sees nothing, even when the student has tests.

ADR 0028 + 0030 already established the principle that teacher-of-student is a first-class read context for that student's data (mirror of `is_my_student`). The two reads above just hadn't been opened up to match.

## Decision

### 1. Allow teacher SELECT on all tests of their enrolled students

**Migration `0024_teacher_session_and_test_reads.sql`** adds a separate SELECT policy on `test`:

```sql
create policy test_teacher_select_student
  on test for select
  using (is_my_student(student_id));
```

This is additive — the existing `test_teacher_all` (for INSERT/UPDATE/DELETE + the narrower SELECT it incidentally provided) stays. Now both policies OR for SELECT: teacher reads any test for an actively enrolled student regardless of who administered it. Writes still require `teacher_id = auth.uid() AND is_my_student(student_id)` — teachers can't fabricate or mutate tests they didn't administer.

Knock-on effect: `daily_streak(p_student_id)` (which scans the student's `test` rows under the caller's RLS) will now compute correctly when called by a teacher. Same goes for the recent-tests fetch in the drill-in and the ActivityStats's review/test counts.

### 2. Relax `today_session` to allow teacher-of-student

Same migration redefines `today_session(p_student_id)` with a broader guard:

```sql
if p_student_id is null then
  raise exception 'today_session: forbidden';
end if;
if p_student_id <> auth.uid() and not is_my_student(p_student_id) then
  raise exception 'today_session: forbidden';
end if;
```

The body is unchanged from migration 0018 (the column-ambiguity-safe version) — read-or-create idempotent semantics. If the teacher opens the drill-in before the student opens `/today`, today's `daily_session` row gets materialized at view-time; the plan computed is the same one the student would have seen on their own visit. Minor ownership oddity, acceptable simplicity.

### Rejected alternatives

- **Split `today_session` into read-only `peek_today_session` for teachers.** Cleaner semantics, but two RPCs to keep in sync. Single function with relaxed guard is enough.
- **Open all RPCs (`load_next_session`, `next_new_lesson`) to teachers.** Out of scope. `load_next_session` is a real write (creates a *new* `daily_session` row beyond today's first), only the student should trigger it. `next_new_lesson` isn't on the drill-in surface — leave alone until needed.
- **Widen `test_teacher_all` in place with an OR.** Would require dropping + recreating the policy. Adding a sibling SELECT policy is additive and lower-risk.

## Consequences

- ✅ Drill-in's read-only `SessionPlanCard` works — teacher sees today's session plan for the student.
- ✅ Drill-in's "Recent tests" list populates with all the student's completed tests (self-tests + other-teacher + this-teacher all show up).
- ✅ `daily_streak` for teacher-viewed students now reflects the student's actual streak, not just streak-of-tests-with-this-teacher.
- ✅ ActivityStatsCard's tests metric (with `viewerTeacherId` set, per ADR 0032) still correctly filters to teacher-administered — the underlying RLS opening doesn't break the filter, it just removes the RLS-as-implicit-filter side effect.
- ⚠️ Teacher first-view materializes today's `daily_session` row if missing. Idempotent and identical-to-what-student-would-see; flag if this ever interacts with notifications or scheduling logic.
- ⚠️ A teacher can now read tests they didn't witness — including any `note`/`witness_name` field. Today the test row carries only `rating`, `ranges`, `test_mode`, `teacher_id`/`student_id` and pipeline metadata; no PII. Reconsider if a private "test note" column lands.
