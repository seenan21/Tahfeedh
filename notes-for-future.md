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

## Today's Session machine (M5)

**Status:** Not yet built. Phase D ships only Queue 1 (`next_new_lesson` RPC) and the new-lesson card on Today; the rest of the session model is M5.

**Bug observed in Phase D:** After a `strong_pass` on the only in-progress page, `NewLessonCard` falls back to "No new lesson — every page is in your mushaf, the full Quran is memorized." That message is wrong when the student has only memorized a handful of pages. Today's view should instead show:
- The new-lesson row for today **with a check mark** once it's been tested today (pass or fail — both count as "attempted today").
- The revision rows for today, each with the same checkmark behavior once attempted.
- A "Today's session complete" state once every row is attempted.
- A "Load next session" button (or auto-load on next login / new day) that pulls the *next* session: next unmemorized page for new-lesson + next priority pages from the revision queue per the algorithm (DESIGN.md §7).

**What "today's session" means** (per the user's pedagogy):
- A session is a discrete unit, NOT a live stream of "what's next right now". Once loaded, the session's contents are frozen for the day.
- Rows complete when **attempted** — a `fail` rating still marks the row complete because the student tried; the page stays `in_progress`, and the *next* session re-includes that same new-lesson page until they pass.
- The next session is computed from the algorithm at session load time, not at test completion.

**What's needed (M5 scope):**
- New table: `daily_session` (student_id, date, status, new_lesson_pages[], revision_pages[], …) — the frozen session for that day.
- Compute function: `compute_next_session(uuid) returns daily_session_row` — runs the full algorithm (Queues 1/2/3, frontier walk + revision priority math) and inserts a new `daily_session` row.
- New Today RPC: `today_session(uuid) returns { session, completed_pages[] }` — returns today's session + which pages have been tested today (joined with `test`).
- UI: replace `NewLessonCard`'s "every page" fallback with the real session/completion view. Add checkmarks on each row that has at least one `test.ended_at >= today_start` for the page.
- "Load next session" CTA when today's session is fully attempted AND it's still today (otherwise auto-load on next visit).

**Cost estimate:** 1–2 days. The algorithm and the session table are the bulk; UI follows the existing slot-card patterns on Today.

**Anti-pattern to avoid:** Do NOT recompute `next_new_lesson` on every Today render. The session is frozen for the day; recomputing would let a student game it by completing/refreshing.

---

## Edit Memorization / Recalibrate (post-M8)

**Status:** Deferred. ADR 0015 establishes that post-onboarding, `memorization_page.status` only changes via the post-test pipeline. No per-page "mark memorized" UI is exposed.

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
