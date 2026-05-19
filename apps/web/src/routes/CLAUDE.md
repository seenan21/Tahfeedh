# apps/web/src/routes/

TanStack file-based routes. **Convention:** files starting with `_authed.` live behind the auth + onboarding gate and render inside the AppShell. Top-level files (no `_authed.` prefix) render their own layouts (auth pages have the SilkBackground; `/onboarding` is shell-free). Adding a protected route without `_authed.` prefix **silently bypasses the gate** — see ADR 0005.

## Index

| File | What | When to read |
|---|---|---|
| `__root.tsx` | Bare provider root: query client + Mantine provider, just renders `<Outlet />` | Adding a router-wide provider |
| `_authed.tsx` | Pathless layout: auth + onboarding gate (`beforeLoad`), AppShell + sidebar + glassy header user menu (ADR 0005, ADR 0010) | Changing auth gating, header chrome, or shell config |
| `_authed.today.tsx` | Student Today view: hero strip, 30-cell juz progress, plan card with empty slots | Touching the Today layout (DESIGN.md §14.4) |
| `_authed.tests.tsx` | Tests empty state (Phase D placeholder) | Building the test creation/history flow |
| `_authed.timeline.tsx` | Timeline empty state (M7 placeholder) | Building the timeline view |
| `_authed.mushaf.tsx` | My Mushaf grid: hero strip + legend + 604-cell grid grouped by juz + `MarkPageModal` + reader `<Drawer>` driven by `MushafPage` | Touching the mushaf grid, marking flow, or page-reader drawer |
| `_authed.goals.tsx` | Goals empty state (M8 placeholder) | Building goals UI / QF Goals API integration |
| `_authed.settings.tsx` | Settings empty state | Building the settings page (Edit Memorization lives here) |
| `_authed.students.tsx` | Teacher Students empty state (M6 placeholder) | Building the teacher's students list |
| `_authed.groups.tsx` | Teacher Groups empty state (M6 placeholder) | Building the groups management UI |
| `index.tsx` | Root `/` — redirects to login or landing route based on session | Changing where logged-in users land |
| `login.tsx` | Login page with SilkBackground + IntroHadith + bilingual hero | Modifying login UX |
| `signup.tsx` | Signup page (with role radio, success modal, duplicate-email handling) | Modifying signup UX |
| `onboarding.tsx` | Onboarding stepper container (`useReducer` driving Step 1 / 2 / 3) | Wiring a new step, changing the flow shape |
