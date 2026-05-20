# Tahfeedh تحفيظ

> A hifz CRM — for memorizers, their teachers, and the journey between them.

Quran Foundation Hackathon 2026 submission. A web app that treats Quran memorization as the **relationship** it actually is — between a student, a teacher, and the Quran — and builds the data model around teacher-witnessed testing as the source of truth for memorization quality.

---

## Demo

| | |
|---|---|
| **Live URL** | _(deployed via Cloudflare Pages + Railway — paste link)_ |
| **Demo video** | _(2–3 min walkthrough — paste link)_ |

### Demo credentials

All three accounts use password **`password123`**.

| Role | Email | Notes |
|---|---|---|
| **Teacher** | `hassan@tahfeedh.app` | Ustaadh Hassan Jameel. Has both demo students enrolled in "Halaqa A". |
| **Junior student** | `ahmad@tahfeedh.app` | Memorized surahs 105–114 (last 10 of the mushaf). 12 tests over the last 14 days with lots of errors — perfect for showing the revision queue, error overlay, and test recap. |
| **Senior student** | `yusuf@tahfeedh.app` | Memorized juz 1, 28, 29, 30 (~84 pages). 10 tests over 21 days, mostly clean. Shows the progress dashboard at scale + pages already promoted to `mastered`. |

To re-seed the demo state, run `npm run seed` from the repo root with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set in `.env`.

---

## The product

Most hifz apps are either solo trackers (no teacher integration) or teacher tools (no student-facing tracking). Tahfeedh treats both sides as first-class:

- **Students** see a daily session plan computed by a three-queue algorithm (new lesson · recent revision · old revision), a per-juz progress grid, a forward-looking forecast at their configured pace, and a 30-juz revision-health heat map.
- **Teachers** see a directory of their enrolled students grouped into halaqas, drill into any student's full progress dashboard, and run witnessed tests directly against the student's record.
- **Tests** are the *only* way memorization status changes. A teacher (or a guest witness if the student is testing solo) taps the exact words a student stumbles on, picks an error type (8 types across word-scope and verse-scope), severity, and an optional note. Errors stream to the database per tap.
- **Error overlay**: every word a student has erred on shows up as a colored marker directly on the mushaf — heatmap or per-error-type tinting. Tap a marker to see the per-occurrence history including cleared (ghost) errors.
- **Wrong-verse**: when a student says a different verse than expected, the witness picks the intended ayah via inline Quran Foundation Search.
- **Quran.com sync**: optional Quran.com account connection. Bookmarks fire-and-forget on memorization milestones; goals sync to QF Goals API; the Today streak swaps to the QF QURAN streak when connected.

---

## API usage

Tahfeedh integrates with **two distinct Quran Foundation API surfaces**:

### Content APIs (`client_credentials` grant, `scope=content`)

| Endpoint | Use case | Where |
|---|---|---|
| `GET /content/api/v4/chapters` | Surah metadata (names + ayah counts) for the surah picker and references | `apps/server/src/qf/content.ts` |
| `GET /content/api/v4/search?q=…&size=…` | Find the intended ayah by Arabic fragment when logging a `wrong_verse` error | `apps/web/src/features/live-test/ErrorLogModal.tsx` via `apps/server/src/routes/qf.ts` |

### User APIs (Authorization Code + PKCE, multi-scope)

OAuth2 flow with **stateless HMAC-signed state** so the verifier survives the dev cross-origin HTTP round-trip (no cookies needed). Tokens upserted into `qf_user_token` table; automatic refresh via the `refresh_token` grant 60s before expiry.

| Scope | Use case | Where |
|---|---|---|
| `bookmark` | Fire-and-forget POST after a student commits onboarding (the in-progress ayah) and after each completed test (the furthest covered ayah). Never blocks the response. | `apps/server/src/qf/bookmarks.ts` |
| `goal` | The `/goals` page creates / edits / deletes goals; local `goal` table is source of truth, QF Goals API receives a write-through. Local row's `qf_goal_id` is set on success. | `apps/server/src/routes/qfUser.ts` |
| `streak.read` | When a student connects Quran.com, the Today `StreakBadge` swaps from the local `daily_streak()` value to the QF QURAN streak with a "via Quran.com" sublabel. | `apps/server/src/routes/qfUser.ts` |
| `reading_session.create` | Requested at /authorize time for future activity-day write-through (reserved). | _(scope granted, write-through TBD)_ |

All token storage is server-side; tokens never touch the browser. See ADR 0040 (`decisions/0040-qf-user-api-oauth-pkce.md`) for the full design.

---

## Tech stack

- **Frontend** — Vite + React + TypeScript + Mantine v7 + TanStack Router + TanStack Query. Mushaf renderer uses QPC Hafs V2 fonts loaded per page. Cloudflare Pages deploy.
- **Backend** — Express + TypeScript on Node 22 (native WebSocket for Supabase Realtime). Railway deploy.
- **Database** — Supabase (Postgres). 28 numbered migrations covering schema + 18 SECURITY DEFINER functions (`commit_onboarding`, `submit_test`, `_compute_session_plan`, `next_new_lesson`, `today_session`, `load_next_session`, `daily_streak`, `is_my_student`, `enroll_via_code`, …). RLS-locked client access on every table.
- **Static data** — Quran Universal Library V2 layout (604 per-page JSON files, 30 juz metadata, 114 surah metadata) generated at build time via `scripts/build-quran-data.ts`.

---

## Repository layout

```
apps/
  web/           Vite + React frontend
  server/        Express backend (service-role writes + QF proxy)
packages/
  shared/        Shared types + Zod schemas
supabase/migrations/   Numbered SQL migrations 0001–0028
scripts/         Build + seed scripts
decisions/       40 Architecture Decision Records (ADRs)
DESIGN.md        Master design doc
DESIGN-SYSTEM.md Visual design tokens
Plan.Md          Build snapshot
```

See `CLAUDE.md` files at each level for per-directory navigation.

---

## Roadmap

Shipped in the hackathon window (May 16–20, 2026):
- M1–M4 (foundation → live tests + errors)
- M5 (full algorithm: 3 queues, mastery promotion, stage machine)
- M6 (teacher side: directory + drill-in + invite-code enrollment + realtime updates)
- M7 (progress dashboard + error detail modal)
- M7.5 (Settings page + Edit Memorization)
- M8 (QF User APIs across 4 scopes)

Deferred (`notes-for-future.md`):
- Dual-role accounts (student + teacher on one user)
- Mutashabihat — tricky-ayah indicators on the mushaf, pre-suggestions in the wrong-verse modal
- Streak per-row coverage validation
- Mobile-first PWA with offline mode
- Per-occurrence sort key choice in the error detail modal

---

## License & credits

- Quranic text & mushaf layout — [Quran Foundation](https://api-docs.quran.foundation) (QUL Madani V2)
- Fonts — KFGQPC Hafs Uthmanic Hafs Naskh
- Built solo, AI-augmented, in the hackathon window
