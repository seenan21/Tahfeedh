# 0043 — Today Tab Renamed to Home (Label-Only)

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M8

## Context
The student landing tab was labelled "Today / اليوم" since M3. The user felt
"Today" sold the page short — it surfaces the streak badge and the full juz
progress bar in addition to the day's session plan. The tab is really the
student's home screen.

## Decision
Rename the visible label **only**. The route path stays `/today`.

- `AppSidebar.tsx` nav item: `'Today' / 'اليوم'` → `'Home' / 'الرئيسية'`.
  Icon stays `Sun` (greeting-aware).
- `_authed.today.tsx` hero H1/H2: `اليوم` → `الرئيسية`, `Today` → `Home`.
- `homeRouteForRole('student')` continues to return `/today`. Every
  `navigate({ to: '/today' })` callsite (`qfAuth.ts` callback redirect,
  `ConnectQuranComBanner`, the OAuth round-trip toast, etc.) stays as-is.

The greeting line (`Good morning, …`) already provides day-of-time framing,
so the H2 "Home" doesn't lose the time-of-day feel.

Following the precedent set by ADR 0025 (Timeline route's label was
changed to Progress without moving the file), we keep the URL stable so
external links, browser history, and the redirect surface area don't
churn.

## Consequences
- ✅ The tab now signals "your landing screen" rather than "daily plan,"
  matching what the page actually shows.
- ✅ Zero risk of breaking deep links or in-app navigation.
- ⚠️ The file is still named `_authed.today.tsx`. New contributors may
  briefly wonder why "Home" lives in `today.tsx` — documented here.

## Reverses
(none — extends DESIGN.md §14.4)
