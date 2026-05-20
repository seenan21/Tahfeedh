# Notes for Future

Deferred decisions and scope cuts made during the hackathon MVP build. Each entry: what was cut, why, and how to restore it later.

---

## Dual-role accounts (Student + Teacher on one user)

**Status:** Deferred. MVP uses a single `role` column on `app_user`.

**Original design:** `DESIGN.md` §2 originally specified `roles user_role[]` so one account could be both student and teacher, with a role switcher in the header and a "Add second role" action in Settings.

**Why cut for MVP:**
- Saves UI work: no role switcher, no "Add role" settings flow, no role-perspective toggle on shared screens.
- Simpler RLS: policies key off `role = 'teacher'` or `role = 'student'` rather than `'teacher' = ANY(roles)`.
- Demo accounts in §17 are each single-role anyway, so no demo regression.
- Removes a class of edge cases (Today view perspective when a user is both).

**How to restore:**
1. Migration:
   ```sql
   ALTER TABLE app_user
     ALTER COLUMN role TYPE user_role[]
     USING ARRAY[role];
   ALTER TABLE app_user RENAME COLUMN role TO roles;
   ```
2. Update RLS policies that compare `role = '...'` → `'...' = ANY(roles)`.
3. Add Settings UI: "Add teacher role" / "Add student role" button.
4. Header: render role switcher only when `roles.length > 1`.
5. Today view / Students list: read `activeRole` from local state, default to first role.

**Cost estimate:** ~half a day. The schema change is one migration; the UI work is the bulk of it.

---

## Edit Memorization / Recalibrate (M7.5)

**Status:** Scheduled for M7.5 (the Settings page milestone — see DESIGN.md §19). ADR 0015 establishes that post-onboarding, `memorization_page.status` only changes via the post-test pipeline. No per-page "mark memorized" UI is exposed.

**Why deferred:** preserves the philosophy that hifz status is earned through witnessed tests (DESIGN.md §3.1 + §13.5). A self-marking UI is a temptation to game streaks and bypasses the algorithm's evidence model. The "Edit Memorization" Settings entry mentioned in DESIGN.md §14.2 is the only acceptable escape hatch — and even that should reuse onboarding's bulk-write, not be a per-page toggle.

**Why the door is left open:** real students will over-claim at onboarding or want to wipe a juz they realize they don't actually know. The system needs a recalibration path eventually.

**What's already in place:**
- `mark_memorization(uuid, jsonb)` SQL function (from migration 0014) — still in the DB, unreachable. Service-role only.
- `apps/server/src/memorization/pageAyahs.ts` — page → ayah expansion helper, retained.

**How to restore (when the time comes):**
1. **Recommended path — reopen onboarding.** Add a "Edit Memorization" button in Settings that routes to `/onboarding?edit=1`. Pre-populate the reducer state from current DB rows. Submitting calls the existing `/api/onboarding/finish` endpoint, which already idempotently writes via `commit_onboarding`. **This is the design's stated intent (§14.2) and adds zero new SQL.**
2. **Alternative — per-page surface.** If a finer-grained UX is needed (mark one page wrong, not redo the whole capture), re-add the Phase C marking endpoint:
   - `POST /api/memorization/mark` — copy from git history at the Phase C commit (`apps/server/src/routes/memorization.ts`).
   - Re-add `markMemorizationSchema`, `MarkMemorizationInput`, `MemorizationMarkStatus` to `@tahfeedh/shared` (also in git history).
   - Build a Settings-only UI (not the main mushaf route) that surfaces it, gated behind a "are you sure?" confirm.
3. Either way: log every recalibration to an `app_user_audit` table so we can spot streak-gaming attempts.

**Cost estimate:** option (1) is ~half a day (mostly populating the reducer state from server data). Option (2) is ~a day if both pieces are needed.
