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
| **Teacher** | `hassan@tahfeedh.app` | Ustaadh Hassan Jameel. Both demo students enrolled in "Halaqa A". Use this account to demo the directory, drill-in, "View mushaf" + "Start test" CTAs, and `/tests` history with witness attribution. |
| **Focal student** | `ahmad@tahfeedh.app` | Ahmad Saleh. Memorized **only Juz 30** (pages 582–604, 23 pages). 69 tests over ~25 days, every page tested at least three times. Every page has **≥5 distinct error markers** drawn from all 8 error types across word + verse scope, with mixed intensities (some words hit in all 3 tests → bright heatmap + count badge; others single-occurrence → faint). This is the account to use when demoing the mushaf overlay, `VerseDetailModal`, the activity sparkline, and the revision queue. |
| **Contrast student** | `yusuf@tahfeedh.app` | Yusuf Bashir. Memorized Juz 1 + Juz 30 (~44 pages). 12 tests over 22 days, all `pass` with sparse errors — shows what a clean record looks like in the same UI and gives the teacher's directory a second row. |

To (re-)seed the demo state, set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`, then run:

```
npm run seed
```

The script wipes the three demo accounts before re-creating, so it's idempotent.

---

## The product

Most hifz apps are either solo trackers (no teacher integration) or teacher tools (no student-facing tracking). Tahfeedh treats both sides as first-class:

- **Students** see a daily session plan computed by a single unified-scoring revision queue (ADR 0050: recent-revision pages + older pages + never-tested pages compete on one score), a per-juz progress grid, a forward-looking forecast at their configured pace, and a 30-juz revision-health heat map.
- **Teachers** see a directory of their enrolled students grouped into halaqas, drill into any student's full progress dashboard, view the student's own mushaf with the historical-error heatmap (ADR 0052), and run witnessed tests directly against the student's record. During a live test, they can opt-in to overlay the student's historical errors on the mushaf for diagnostic context (ADR 0053).
- **Tests** are the *only* way memorization status changes. A teacher (or a guest witness if the student is testing solo) taps the exact words a student stumbles on, picks an error type (8 types across word-scope and verse-scope), and an optional teacher note. Errors stream to the database per tap (ADR 0018).
- **Error overlay**: every word a student has erred on shows up as a tinted marker directly on the mushaf — heat intensity is `occurrence_count / (1 + tests_since_last_occurrence)`. Tap any verse to open `VerseDetailModal` (ADR 0045): per-verse mushaf render, Ḥusary verse audio, explicit-bookmark slot, and the full per-occurrence error history grouped by type with a ghost-errors reveal.
- **Wrong-verse differentiator**: when a student says a different verse than expected, the witness picks the intended ayah via inline Quran Foundation Search inside `ErrorLogModal`.
- **Quran.com sync**: optional Quran.com account connection (ADR 0040). Explicit bookmarks go through a per-user "Tahfeedh" QF collection (ADR 0045); goals sync to QF Goals API; the Today streak swaps to the QF QURAN streak when connected.

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

Per ADR 0044, the empirical scope set granted by this `client_id` is `bookmark`, `goal`, `streak.read` (plus OIDC `openid` + `offline_access`). Three originally-requested scopes (`note.create`, `reading_session.create`, `profile`) are **not** granted by the app config.

| Scope | Use case | Where |
|---|---|---|
| `bookmark` | Explicit add-bookmark button inside `VerseDetailModal` writes to a lazy-created per-user `Tahfeedh` QF collection (ADR 0045). Auto-pushes on onboarding finish + test finish were removed in the same ADR — bookmarks are now user-explicit. | `apps/server/src/qf/bookmarks.ts` |
| `goal` | The `/goals` page creates / edits / deletes goals; local `goal` table is source of truth, QF Goals API receives a write-through. Local row's `qf_goal_id` is patched on success. | `apps/server/src/routes/qfUser.ts` |
| `streak.read` | When a student connects Quran.com, the Today `StreakBadge` swaps from the local `daily_streak()` value to the QF QURAN streak with a "via Quran.com" sublabel. | `apps/server/src/routes/qfUser.ts` |

All token storage is server-side; tokens never touch the browser. See ADR 0040 (`decisions/0040-qf-user-api-oauth-pkce.md`) for the full design and ADR 0044 (`decisions/0044-qf-scope-empirical-set.md`) for the empirical scope discovery.

---

## Tech stack

- **Frontend** — Vite + React + TypeScript + Mantine v7 + TanStack Router + TanStack Query. Mushaf renderer uses 604 page-scoped QPC Hafs V2 fonts (ADR 0003). Cloudflare Pages deploy.
- **Backend** — Express + TypeScript on Node 22 (native WebSocket for Supabase Realtime). Railway deploy.
- **Database** — Supabase (Postgres). 29 numbered migrations covering schema + 19 SECURITY DEFINER functions (`commit_onboarding`, `submit_test`, `_compute_session_plan`, `next_new_lesson`, `today_session`, `load_next_session`, `daily_streak`, `is_my_student`, `enroll_via_code`, `get_or_create_teacher_invite_code`, `leave_teacher`, …). RLS-locked client access on every table.
- **Static data** — Quranic Universal Library V2 layout (604 per-page JSON files, 30 juz metadata, 114 surah metadata) generated at build time via `scripts/build-quran-data.ts`.

---

## Local setup

```bash
# 1. install
npm install

# 2. build derived shared types + quran data (once)
npm run build:shared
npm run build:quran-index   # fast: rebuilds quran-index.json from local page JSONs
# (or: npm run build:assets for the full per-page-JSON + font refetch)

# 3. configure env — create .env at repo root with:
#    SUPABASE_URL=https://<project>.supabase.co
#    SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
#    VITE_SUPABASE_URL=https://<project>.supabase.co
#    VITE_SUPABASE_ANON_KEY=<anon-key>
#    QF_CLIENT_ID=<quran foundation client id>
#    QF_CLIENT_SECRET=<quran foundation client secret>
#    QF_STATE_SECRET=<32+ char random string for HMAC-signing OAuth state>

# 4. seed demo data
npm run seed

# 5. run web + server concurrently
npm run dev
# web on :5173, server on :3001
```

---

## Repository layout

```
apps/
  web/           Vite + React frontend
  server/        Express backend (service-role writes + QF proxy)
packages/
  shared/        Shared types + Zod schemas (@tahfeedh/shared)
supabase/migrations/   Numbered SQL migrations 0001–0029
scripts/         Build + seed scripts
decisions/       53 Architecture Decision Records (ADRs)
DESIGN.md        Master design doc
DESIGN-SYSTEM.md Visual design tokens, color/typography palette
Plan.Md          Build snapshot
```

See `CLAUDE.md` files at each level for per-directory navigation. The root `CLAUDE.md` documents the ADR ritual + session conventions; each subdirectory's `CLAUDE.md` indexes its files with task-oriented "when to read" triggers.

---

## Roadmap

Shipped in the hackathon window (May 16–20, 2026):
- **M1–M4** — foundation → live tests + errors end-to-end (the headline flow).
- **M5** — full revision algorithm. Originally three queues; collapsed to a single unified-scoring queue per ADR 0050.
- **M6** — teacher side: directory + drill-in + invite-code enrollment + Supabase Realtime live updates. ADR 0052 added a teacher mushaf-of-student view; ADR 0053 added a witness-opt-in historical overlay on the live test.
- **M7** — Progress dashboard (forecast + activity stats + revision health) + the verse-detail modal (ADR 0045).
- **M7.5** — Settings page + Edit Memorization re-entry into `/onboarding?edit=1`.
- **M8** — QF User APIs across the three granted scopes (bookmark + goal + streak.read).

Deferred (`notes-for-future.md`):
- Dual-role accounts (student + teacher on one user).
- Mutashabihat — tricky-ayah indicators on the mushaf, pre-suggestions in the wrong-verse modal.
- Streak per-row coverage validation against `daily_session.attempted`.
- PWA service worker (manifest + icon ship today; offline mode does not).
- `note.create` + `reading_session.create` + `profile` QF scopes — requested but not granted on this `client_id` (ADR 0044). Code paths intact, write-throughs reactivate when scopes are granted.

---

## License & credits

- Quranic text & mushaf layout — [Quran Foundation](https://api-docs.quran.foundation) (QUL Madani V2).
- Recitation audio — Khalil al-Ḥusary, served via the EveryAyah CDN (ADR 0042).
- Fonts — KFGQPC Hafs Uthmanic + Playfair Display + Cairo + Scheherazade New.
- Built solo, AI-augmented, in the hackathon window.
