# apps/web/src/routes/

TanStack file-based routes. **Convention:** files starting with `_authed.` live behind the auth + onboarding gate and render inside the AppShell. Top-level files (no `_authed.` prefix) render their own layouts (auth pages have the SilkBackground; `/onboarding` is shell-free). Adding a protected route without `_authed.` prefix **silently bypasses the gate** — see ADR 0005.

## Index

| File | What | When to read |
|---|---|---|
| `__root.tsx` | Bare provider root: query client + Mantine provider, just renders `<Outlet />` | Adding a router-wide provider |
| `_authed.tsx` | Pathless layout: auth + onboarding gate (`beforeLoad`), test-lock guard that redirects to `/tests/$testId` whenever an in-progress test exists, AppShell with 64px icon-rail navbar + glassy header, "Self-test in session" header banner, logout auto-abandons any in-progress test (ADRs 0004, 0005, 0010) | Changing auth gating, the test lock, the self-test banner, or shell config |
| `_authed.today.tsx` | Student Today view: hero strip, 30-cell juz progress, `<SessionPlanCard>` plan (frozen `daily_session`, ADR 0020) | Touching the Today layout (DESIGN.md §14.4) |
| `_authed.tests.index.tsx` | Tests landing — Begin-Test/Resume CTA, 30-day activity sparkline (inline SVG), last 15 completed tests as Card rows linking to `/tests/$testId/recap` (ADR 0021) | Building the test landing UX or the recent-history surface |
| `_authed.tests.$testId.tsx` | Live-test route — renders `<LiveTestRoute>` from `features/live-test/`. Completed tests redirect to `recap` from inside `LiveTestRoute` | Touching live-test routing |
| `_authed.tests.$testId.recap.tsx` | Read-only recap route (ADR 0022) — renders `<TestRecapView>` for completed/abandoned tests. Linked from the history list and from the live-test redirect | Touching the recap routing |
| `_authed.progress.tsx` | Forward-looking student dashboard (M7, ADR 0025): ForecastCard + ActivityStatsCard + RevisionHealthGrid. Replaces the old Timeline placeholder | Touching the progress surface or wiring more student-facing analytics |
| `_authed.mushaf.tsx` | My Mushaf — reader-first: SegmentedControl toggle (Reader / Tracker), reader-mode toolbar (prev / next / jump-to-page / "Show errors" Switch), inline two-column layout (MushafPage + sticky PageDetailsPanel), Tracker view uses collapsible `MushafGrid`. Fetches `error_location_stats` and passes as overlays (heatmap on/off, persisted in localStorage). Last-selected page also in localStorage; initial page comes from cached `next_new_lesson` (ADRs 0011, 0015, 0019) | Touching the mushaf surface, overlay rendering, the reader/tracker toggle, or the side panel |
| `_authed.classroom.tsx` | Student Classroom tab (ADR 0028): active-teachers list, "Join via code" modal, "Leave class" per teacher. Calls `enroll_via_code(code)` (student-side now) and `leave_teacher(teacher_id)` RPCs | Touching the student's teacher list, join flow, or leave-teacher mechanics |
| `_authed.goals.tsx` | Goals empty state (M8 placeholder) | Building goals UI / QF Goals API integration |
| `_authed.settings.tsx` | Settings empty state | Building the settings page (Edit Memorization lives here) |
| `_authed.students.tsx` | Teacher directory (M6, ADRs 0027 + 0028): groups as collapsible folders + Ungrouped section, inline `+ New group` + **`Invite a student`** modal (mints/rotates the teacher's 8-char invite code via `get_or_create_teacher_invite_code` / `rotate_teacher_invite_code` RPCs), Move-to-group menu per row, rename/delete on group kebab. Direct Supabase writes under existing RLS — no Express endpoints | Touching the teacher directory, group CRUD, or the invite-code surface |
| `_authed.students.$studentId.tsx` | Teacher drill-in (M6, ADR 0027): header + 3 reused M7 cards via `studentId` prop + recent tests list + "Start test for this student" → `TestCreationModal` in `mode="enrolled_teacher"` | Touching the teacher's per-student dashboard |
| `index.tsx` | Root `/` — redirects to login or landing route based on session | Changing where logged-in users land |
| `login.tsx` | Login page with SilkBackground + IntroHadith + bilingual hero | Modifying login UX |
| `signup.tsx` | Signup page (with role radio, success modal, duplicate-email handling) | Modifying signup UX |
| `onboarding.tsx` | Onboarding stepper container (`useReducer` driving Step 1 / 2 / 3) | Wiring a new step, changing the flow shape |
