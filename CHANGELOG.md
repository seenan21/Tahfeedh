# Changelog

## [Unreleased]

### Added
- Migration `0011_guest_witnessed_tests` — implements ADR 0004: `test_mode` enum, nullable `test.teacher_id`, `guest_tester_name` column, witness check constraint, and student-write RLS policies for guest-witnessed tests and their `error_log` rows.
- Migration `0012_onboarding_complete` — adds `student_settings.onboarding_complete` boolean used by the `_authed` route gate.
- Pathless `_authed` layout route enforcing the auth + onboarding gate and rendering the AppShell with role-aware sidebar (ADR 0005).
- `AppSidebar` component with three-state selection pattern per DESIGN-SYSTEM §6.
- Stub routes for every sidebar item: `tests`, `timeline`, `mushaf`, `goals`, `settings`, `groups`. Student-only and teacher-only routes redirect cross-role visitors to their landing page.
- Onboarding stub at `/onboarding` — a "Mark complete" CTA that flips `student_settings.onboarding_complete`. Real Step 1/2/3 flow ships in Phase B.

### Changed
- `getCurrentUser` now returns `onboardingComplete`. Teachers always `true`; students read from `student_settings`.
- Login, signup, and root index routes redirect via new `landingRouteForUser` helper so students with incomplete onboarding land on `/onboarding`.
- `__root.tsx` stripped to a bare provider — AppShell now lives inside `_authed.tsx`.

### Fixed
- (nothing yet)
