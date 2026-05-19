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
