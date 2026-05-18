# 0005 — Pathless `_authed` Route for Auth + Onboarding Gate

**Date:** 2026-05-18
**Status:** Implemented
**Milestone:** M1

## Context
Six protected routes (`/today`, `/tests`, `/timeline`, `/mushaf`, `/goals`, `/settings`) plus `/students` and `/groups` all need the same two gates: redirect unauth users to `/login`, and redirect students with `onboarding_complete = false` to `/onboarding`. Repeating the `beforeLoad` block on each route invites drift; putting it in `__root.tsx` bleeds auth concerns into the public routes (login, signup, landing) which then need to opt out.

The protected pages also share visual chrome (AppShell with header + role-aware sidebar) that the public pages should not render.

## Decision
Use a TanStack Router pathless layout route at `apps/web/src/routes/_authed.tsx`. Its `beforeLoad` runs the auth + onboarding gate, returns `{ user }` into the route context, and its component renders the AppShell with `<AppSidebar role={user.role}/>` plus `<Outlet/>`. All protected pages live under `_authed.*` (e.g. `_authed.today.tsx`).

Onboarding stays at top-level `/onboarding` because it deliberately renders without the shell — it's a moment-of-arrival screen per DESIGN-SYSTEM §5.

`__root.tsx` strips back to a query/theme provider plus `<Outlet/>`. Public routes (`/login`, `/signup`, `/`) render their own centered card layouts.

## Consequences
- ✅ One gate, one shell, one place to evolve auth rules.
- ✅ Child routes read `user` from `Route.useRouteContext()` instead of refetching.
- ✅ Public routes stay shell-free without opt-out logic.
- ⚠️ Convention discipline required: every new protected route must be named `_authed.<name>.tsx`. A route accidentally placed at `<name>.tsx` will silently skip the gate.
