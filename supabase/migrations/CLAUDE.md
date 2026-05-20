# supabase/migrations/

Numbered SQL migrations applied in order. Each file is idempotent within itself; the migrations table tracks applied versions. **Never rewrite a shipped migration** — add a new one that supersedes it.

## Index

| File | What | When to read |
|---|---|---|
| `0001_enums.sql` | All enum types: roles, statuses, ratings, error types, severities | Adding a new enum value, debugging an enum cast |
| `0002_identity.sql` | `app_user`, `student_settings`, `student_code`, `student_group`, `enrollment` | Touching identity, settings, enrollment, or invite codes |
| `0003_memorization.sql` | `memorization_page`, `memorization_verse`, `ayah_review_state` | Touching memorization tracking or the algorithm's input tables |
| `0004_tests_errors.sql` | `test`, `error_log`, `error_location_stats` | Building the test flow or post-test pipeline |
| `0005_goals_tokens.sql` | `goal`, `qf_token` | Building the goals UI or QF User API OAuth flow |
| `0006_functions.sql` | `touch_updated_at`, `generate_invite_code`, `is_my_student`, `current_session_number`, `session_status_today`, `daily_streak`, `enroll_via_code` | Calling or modifying a helper function — also check 0009 for `search_path` pinning |
| `0007_triggers.sql` | `updated_at` triggers, `ensure_student_settings`, `ensure_student_code` | Debugging "row missing after signup" or trigger fires |
| `0008_rls.sql` | Row-level security policies for every table | Adding a new table, debugging "permission denied", or changing who can read/write what |
| `0009_hardening.sql` | Pins `search_path` on functions, locks `SECURITY DEFINER` grants | Adding a new function — match this pattern |
| `0010_fix_signup_triggers.sql` | Repairs the trigger ordering bug introduced in 0007 | Investigating a signup failure |
| `0011_guest_witnessed_tests.sql` | Implements ADR 0004: `test_mode` enum, nullable `teacher_id`, guest student-write RLS | Building the test creation flow |
| `0012_onboarding_complete.sql` | `student_settings.onboarding_complete` boolean for the gate | Touching the `_authed` gate or signup → onboarding flow |
| `0013_session_size_and_onboarding_writes.sql` | NUMERIC(3,1) on `pages_per_session_new`; `commit_onboarding(uuid, jsonb)` SQL function | Touching session size or the onboarding finish bulk-write |
| `0014_marking_and_next_lesson.sql` | `mark_memorization(uuid, jsonb)` SECURITY DEFINER fn for service role + `next_new_lesson(uuid)` SECURITY DEFINER fn for authenticated callers (ADRs 0012, 0013) | Touching the marking SQL or Queue 1 frontier walk |
| `0015_hifz_direction.sql` | `hifz_direction` enum + column on `student_settings`; `next_new_lesson` rewritten to honor direction; `commit_onboarding` accepts `hifzDirection` in payload (ADR 0014) | Touching direction-aware Queue 1 logic or the onboarding payload |
| `0016_post_test_pipeline.sql` | `submit_test(uuid, jsonb)` SECURITY DEFINER fn — closes test, touches review state, upserts/decays error stats, promotes on `strong_pass`, returns NEW/RECURRING/CLEARED summary (ADR 0017). Mastery + fail-downgrade left as `-- TODO M5+` | Touching the post-test pipeline |
| `0017_daily_session.sql` | `daily_session` table + `today_session(uuid)` / `load_next_session(uuid)` SECURITY DEFINER RPCs + internal `_compute_session_plan` helper (ADR 0020). The frozen Today's-session machine + simple revision queue | Touching the session machine or the revision ordering |
| `0018_fix_session_rpc_ambiguity.sql` | Bugfix: qualifies column references in `today_session`, `load_next_session`, and `session_status_today` so OUT parameter names don't shadow table columns | Touching these RPCs — keep all column references table-qualified |
| `0019_test_summary_persistence.sql` | Adds `test.summary jsonb`; rewrites `submit_test` to UPDATE the test row with the returned summary before returning. Powers the read-only recap (ADR 0022) | Touching the post-test pipeline or the recap-summary column |
| `0020_m5_algorithm.sql` | Closes the M5 algorithm: `submit_test` now rolls per-ayah `consecutive_clean_tests`, runs the Queue 2 stage machine + interval scheduling, fail-resets stage 1 (+ drops graduation), and promotes `memorized → mastered` after 5 consecutive clean strong-pass revisions. `_compute_session_plan` now does Queue 2 (recent revision by stage + ready_at) then Queue 3 (graduated pages by DESIGN.md §7.2 priority formula minus mutashabihat). ADR 0024 | Touching the algorithm, mastery rule, or revision-queue ordering |
| `0021_invite_code_flip.sql` | Flips enrollment direction (ADR 0028). Drops `student_code` + `ensure_student_code` trigger + `generate_invite_code`. New `teacher_invite_code` table (8-char Crockford codes, 24h TTL, reusable). New RPCs `get_or_create_teacher_invite_code`, `rotate_teacher_invite_code`, `leave_teacher`. `enroll_via_code` rewritten — caller is now the student | Touching invite codes, the join flow, or the leave-teacher RPC |
| `0022_realtime_enrollment.sql` | First realtime surface (ADR 0029): `alter publication supabase_realtime add table enrollment`. Lets the teacher directory subscribe to `postgres_changes` on `enrollment` for live join/leave updates. RLS still gates payload visibility | Adding another realtime surface — follow this one-liner pattern per table |
| `0023_student_reads_teacher_app_user.sql` | Adds `app_user_select_my_teacher` policy (ADR 0030) — students can SELECT the `app_user` row of any teacher they have an active enrollment with. Mirror of the existing `is_my_student()` direction. Fixes "Unnamed teacher" in the Classroom tab | Touching `app_user` RLS or adding cross-role visibility |
| `0024_teacher_session_and_test_reads.sql` | ADR 0033: adds `test_teacher_select_student` SELECT policy (teacher reads all tests of enrolled students, not just self-administered); relaxes `today_session(p_student_id)` guard to allow teacher-of-student so the drill-in's read-only SessionPlanCard works. `load_next_session` + `next_new_lesson` deliberately unchanged | Touching test RLS, the session-machine guards, or other student-data RPCs that need teacher access |
