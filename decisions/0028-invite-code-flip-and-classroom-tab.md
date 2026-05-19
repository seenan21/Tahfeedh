# 0028 — Invite-Code Direction Flip + Student Classroom Tab

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M6 (revision)

## Context

The M6 enrollment model had the teacher entering the student's 6-digit `student_code` — auto-generated at signup, never expiring, never rotating, retrievable from a `student_code` table the teacher reached through a SECURITY DEFINER RPC. Three problems surfaced once the directory UX shipped:

1. **Trust direction is backwards.** Anyone with a teacher account could brute-force the 6-digit search space (1M combinations) and silently enroll students. Real classroom tools (Google Classroom, Canvas, Quizlet) invert this — the *teacher* publishes a code, the *student* opts in.
2. **No way for students to see their teachers.** The student side had no "who's watching my data?" view, no way to leave a teacher, no concept of classroom membership.
3. **`student_code` was permanent and silent.** No TTL, no rotation, no expiry. A leaked code stayed dangerous forever.

## Decision

**Flip the enrollment direction.** The teacher generates a code; the student enters it.

### Schema (migration `0021_invite_code_flip.sql`)

- **Drop `student_code`** (table, trigger `ensure_student_code_trg`, helper fn `generate_invite_code()`). All artifacts removed in the same migration.
- **New table `teacher_invite_code`** (`code text PK`, `teacher_id`, `expires_at`, `revoked_at`, `created_at`). Codes are 8 characters from the Crockford-ish alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32^8 ≈ 1.1T combinations, no 0/O/1/I/L confusables). Reusable, **24-hour TTL**.
- **RLS policy `tic_owner`** — teacher CRUDs their own codes; students never read this table directly.
- **New RPC `get_or_create_teacher_invite_code()`** — returns the teacher's current live code (non-expired, non-revoked), mints one if none exists. Idempotent — calling repeatedly returns the same code until expiry.
- **New RPC `rotate_teacher_invite_code()`** — `revoked_at = now()` on the active row, mints a fresh code, returns it.
- **`enroll_via_code(p_code text)` rewritten** — caller is now the *student*. Resolves code → teacher; rejects if expired/revoked/self; INSERT-or-UPDATE on `(teacher_id, student_id)` so a re-join after `'paused'` flips the row back to `'active'` (preserves original enrollment row + history). New students land in **Ungrouped** (`group_id = NULL`) — the teacher organizes them later.
- **New RPC `leave_teacher(p_teacher_id)`** — student flips their enrollment to `'paused'`. Existing `is_my_student()` RLS gates on `status='active'`, so paused teachers immediately lose read access to all the student's tables. Soft removal preserves audit history.

### Frontend

- **`_authed.students.tsx` (teacher):** "Enroll via code" button replaced with **"Invite a student"**. Modal shows the teacher's current 8-character code in a monospace block with a Copy button + "Rotate code" action (confirm prompt). Expiry displayed in the modal.
- **`_authed.classroom.tsx` (student, new):** lists active teachers (display name, joined-date, optional group badge), "Join via code" CTA, "Leave class" per row via a kebab menu. Empty state nudges the student to ask a teacher for an invite code.
- **Sidebar:** new Classroom entry (`/classroom`, icon `School`, Arabic `الحلقة`) in the student nav between My Mushaf and Goals.

### Rejected alternatives

- **Pending → accepted enrollment state.** Considered as a second-factor confirmation but redundant once the direction is student-initiated — the student entering the code *is* the confirmation. Adding pending on top adds friction without a clear safety win.
- **Single-use codes.** More secure per-event but high friction for class onboarding (teacher regenerates per student). Reusable + 24h TTL is the typical Classroom/Canvas pattern and matches the user's mental model.
- **Per-group code binding.** Codes routing to a specific group on acceptance would push group_id into the table — premature complexity. Teacher moves students between groups manually post-join.

## Consequences

- ✅ Trust direction matches real-world classroom tools. Students explicitly opt in by entering a code, just like joining a Google Meet.
- ✅ Codes expire in 24 hours — leaked codes have a bounded blast radius without any rate-limiting infrastructure.
- ✅ 32^8 search space (~1.1 trillion) defeats casual brute-forcing even without rate-limit.
- ✅ Students gain a real surface to inspect "who's watching my hifz" and revoke access.
- ✅ Re-join flow (same code unpauses) preserves enrollment history without breaking the UNIQUE constraint.
- ⚠️ **Destructive change.** `student_code` is gone. Any external system that referenced student codes (none today) would break. Confirmed dev-only data before the migration.
- ⚠️ No rate-limit on `enroll_via_code()` itself. Worst case: someone could try to guess active codes. Combined search space × short TTL × small number of active codes makes this practically infeasible, but a token-bucket per IP would harden it further — defer.
- ⚠️ The "leave class" UX is one-click destructive (confirm prompt only). If undo matters later, switch to a 24h grace window.
