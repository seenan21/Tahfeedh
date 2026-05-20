# Tahfeedh — Master Design Document

> A hifz CRM — for memorizers, their teachers, and the journey between them.

This is the single source of truth for the Tahfeedh build. Every product, data, algorithm, API, and UX decision lives here. If implementation deviates from this document, update the document.

**Companion files:**
- `tahfeedh-er-diagram.svg` — visual schema reference
- `supabase/migrations/*.sql` — actual schema DDL (referenced from §12 but kept separate)

---

## Table of Contents

1. [Hackathon Context](#1-hackathon-context)
2. [Product Overview](#2-product-overview)
3. [Design Principles](#3-design-principles)
4. [Tech Stack](#4-tech-stack)
5. [Data Architecture Overview](#5-data-architecture-overview)
6. [Feature Scope](#6-feature-scope)
7. [Session & Algorithm Model](#7-session--algorithm-model)
8. [Test Rules & Range Restrictions](#8-test-rules--range-restrictions)
9. [Error Model](#9-error-model)
10. [Mushaf Rendering](#10-mushaf-rendering)
11. [API Integrations](#11-api-integrations)
12. [Schema Overview](#12-schema-overview)
13. [Post-Test Processing Pipeline](#13-post-test-processing-pipeline)
14. [UI Structure](#14-ui-structure)
15. [Visual Design Tokens](#15-visual-design-tokens)
16. [Demo Video Plan](#16-demo-video-plan)
17. [Seed Data Plan](#17-seed-data-plan)
18. [Submission Writeup Draft](#18-submission-writeup-draft)
19. [Milestone Build Plan](#19-milestone-build-plan)
20. [Open Items & Ambiguities](#20-open-items--ambiguities)
21. [Glossary](#21-glossary)

---

## 1. Hackathon Context

| Field | Value |
|---|---|
| Event | Quran Foundation Hackathon |
| Deadline | Wednesday, May 20, 2026 |
| Team | Solo, AI-augmented |
| Required deliverables | Title, description, live demo URL, GitHub repo, 2–3 min demo video, API usage writeup |
| Mandatory API rule | At least one Content API + at least one User API from Quran Foundation |

### Judging Weights

| Criterion | Weight |
|---|---|
| Impact on Quran Engagement | **30** |
| Product Quality & UX | 20 |
| Technical Execution | 20 |
| Innovation | 15 |
| Effective Use of APIs | 15 |

**Strategic North Star:** Impact (30 pts) is the deciding criterion. A focused, polished MVP that demonstrably helps a hafiz/teacher stay on track outperforms a sprawling feature list. Every scope decision optimizes for Impact first, Product Quality second.

### API Access Status

- ✅ Production Content APIs working (`scope=content`)
- ✅ Production User APIs granted
- Authentication base URL: `https://oauth2.quran.foundation`
- API base URL: `https://apis.quran.foundation`
- Custom headers: `x-auth-token` + `x-client-id` (NOT `Authorization: Bearer`)

---

## 2. Product Overview

**Name:** Tahfeedh (تحفيظ)
**One-liner:** A hifz CRM — for memorizers, their teachers, and the journey between them.
**Form factor:** Web app, mobile-responsive, PWA-installable on Day 4
**Languages:** English UI; Arabic Quranic text only

### Roles

Two roles, **single role per account for MVP**:
- **Student** — memorizes the Quran; tracks progress; sees their Today plan; receives tests from teachers
- **Teacher** — manages students individually or in groups; administers tests; logs errors; reviews student history

Role is chosen at signup and stored as a single `role` column on `app_user`. Dual-role support (a user being both student and teacher on one account) is deferred — see `notes-for-future.md`. The schema change to re-enable it later is one migration: `ALTER COLUMN role TYPE user_role[] USING ARRAY[role]`.

### Core Differentiator

Most hifz apps are either solo trackers (no teacher integration) or teacher tools (no student-facing tracking). Tahfeedh treats hifz as the **relationship** it actually is — between a student, a teacher, and the Quran — and builds the data model around teacher-witnessed testing as the source of truth for memorization quality.

The error-tracking system (word-level with type, severity, recurrence detection) is the technical differentiator. The teacher-student session-based algorithm is the product differentiator.

---

## 3. Design Principles

These are the non-negotiable foundations. Every implementation decision should be checked against them.

### 3.1 Hifz is human-witnessed.
All tests require a human witness. There is no "self-test" mode — the student cannot tap a button alone and rate themselves. Two witness paths are supported (see ADR 0004):

- **Enrolled teacher:** authenticated teacher account runs the test on the student.
- **Guest teacher:** student hands their device to whoever's testing them (parent, sibling, visiting hafiz, study partner) — that person drives the test UI; an optional name is recorded.

Students can track their own memorization progress (mark pages memorized) and set goals, but the act of being *tested* — which generates authoritative error data — always involves another person.

**Rationale:** This is how hifz has been transmitted for 1400 years. Self-reported errors are unreliable because the student is the one who would have to notice the error in the first place. The whole tradition is built around someone else hearing and correcting. Restricting tests to enrolled-teacher accounts only would lock out the majority of real-world testing volume (which happens at home, in halaqahs, between peers) — guest mode captures that without weakening the witness principle.

### 3.2 Every session balances new with old.
A session is only complete when its required pages from both buckets (newly memorized + revision) have been covered by closed tests that day. Students cannot grind new memorization while neglecting revision, and cannot only review while never advancing.

**Exception:** Students who have completed memorizing the entire Quran (`has_completed_quran = true`) can complete a session with revision tests alone.

**Rationale:** Most hifz failures aren't from lack of memorization — they're from neglected revision. Enforcing balance is the core teaching the app embodies.

### 3.3 The queue ends.
Students always see a finite, achievable list — never a backlog of overdue work. Missed days don't accumulate. The algorithm naturally reprioritizes; if you skip three days, you don't return to triple the work — you return to the same daily allotment, drawn from updated priorities.

**Rationale:** Anki's failure mode is the pileup. Hiding the backlog and showing only "today's plan" maintains motivation and respects that hifz students live full lives.

### 3.4 Track at the smallest unit that's meaningful.
Memorization review tracking lives at the **ayah level**. Errors live at the **word level** (or verse/word-range when applicable). Pages exist as a display unit, but the underlying truth is finer-grained.

**Rationale:** Surahs span pages; pages contain partial surahs; partial-page memorization is common. Tracking at ayah-level eliminates entire classes of edge cases (coverage thresholds, mid-page boundaries) and makes the data model coherent end-to-end.

### 3.5 Static canonical data lives in the app; dynamic user data flows through APIs.
Quranic reference data (mushaf layout, fonts, word-by-word script, mutashabihat) is bundled at build time from open datasets. User-bound data (bookmarks, goals, search) flows through Quran Foundation APIs at runtime.

**Rationale:** Each tool used for what it does best. Static data shouldn't require a network call; dynamic user identity shouldn't be re-implemented when QF already owns it.

### 3.6 Sessions are plans, not data structures.
A "session" is a UI concept — the day's plan computed for the student. Tests are independent events that may or may not contribute to completing today's session. Session completeness is **computed on read**, not stored.

**Rationale:** Eliminates an entire class of bugs around session-state synchronization. Tests are atomic; the plan is a derived view.

### 3.7 Future-proof for migration.
Supabase is chosen for speed; the schema avoids Supabase-specific features beyond RLS. Reference data lives in the repo, not in Supabase storage. Foreign keys are minimal; CASCADE delete is intentional and documented.

**Rationale:** The hackathon timeline justifies Supabase. The product roadmap may justify migration later. Don't paint into a corner.

---

## 4. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend framework | Vite + React + TypeScript | Fast HMR, well-trodden path, type safety |
| Routing | TanStack Router | Type-safe, modern, integrates with TanStack Query |
| Data fetching | TanStack Query | Best-in-class client-side cache for orchestrating API calls |
| Component library | Mantine | Polished components; strong AppShell, modals, forms; responsive primitives |
| Backend | Express (Node.js + TypeScript) | Thin server for OAuth + API proxying; minimal surface area |
| OAuth client | `openid-client` | Canonical OIDC/OAuth2 library; handles PKCE, token refresh |
| Database | Postgres via Supabase | Postgres for portability; Supabase for auth + RLS + speed |
| Auth | Supabase Auth (email/password) | Free, instant, integrates with RLS |
| Frontend hosting | Cloudflare Pages | Free, fast CDN, custom domain, not-Vercel |
| Backend hosting | Railway | Express deployment, slick DX |

### Why a backend at all?
- OAuth2 + PKCE for QF User APIs needs a server to hold the refresh token securely
- API proxying keeps the QF `client_secret` server-side
- Algorithm computation (session plans) is cleaner in TypeScript than PL/pgSQL
- Post-test processing pipeline is transactional and complex — easier to test in app code

### Project structure

```
tahfeedh/
├── apps/
│   ├── web/                    # Vite + React frontend (Cloudflare Pages)
│   │   ├── src/
│   │   │   ├── data/           # QUL static data (JSON, fonts)
│   │   │   │   ├── pages/      # 604 per-page JSON files
│   │   │   │   ├── metadata.json
│   │   │   │   └── mutashabihat.json  (conditional)
│   │   │   ├── components/
│   │   │   ├── routes/         # TanStack Router routes
│   │   │   ├── api/            # API client wrappers
│   │   │   └── lib/
│   │   ├── public/
│   │   │   └── fonts/          # QPC Hafs woff2
│   │   └── vite.config.ts
│   │
│   └── server/                 # Express backend (Railway)
│       ├── src/
│       │   ├── routes/
│       │   ├── qf/             # Quran Foundation integration
│       │   │   ├── content.ts  # Content API client
│       │   │   ├── user.ts     # User API client (OAuth flow)
│       │   │   └── tokens.ts   # Token caching
│       │   ├── algorithm/      # Session plan computation
│       │   ├── pipelines/      # Post-test processing
│       │   └── supabase.ts
│       └── tsconfig.json
│
├── packages/
│   └── shared/                 # Shared types between web and server
│       ├── schema.ts           # Zod schemas
│       └── types.ts
│
├── scripts/
│   ├── build-quran-data.ts     # Convert QUL SQLite → static JSON
│   └── seed.ts                 # Demo data
│
├── supabase/
│   └── migrations/             # SQL migrations (1–8)
│
├── DESIGN.md                   # This document
├── README.md
└── package.json
```

Monorepo with npm/pnpm workspaces. Shared types between frontend and backend keep API contracts consistent.

---

## 5. Data Architecture Overview

Three layers of data:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Static reference data                              │
│  Source: Quranic Universal Library (Tarteel AI)              │
│  Lives in: apps/web/src/data/ + apps/web/public/fonts/       │
│                                                               │
│  - KFGQPC V2 Madani 15-line layout (604 pages)               │
│  - QPC V2 word-by-word script                                │
│  - QPC Hafs font (.woff2)                                    │
│  - Quran metadata (surahs, ayahs, juz/hizb)                  │
│  - Mutashabihat dataset (5,277 entries) [conditional]        │
│                                                               │
│  Build-time pipeline: scripts/build-quran-data.ts            │
│  Reads QUL SQLite → emits per-page JSON                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Layer 2: User-bound dynamic data                            │
│  Source: Quran Foundation APIs (Content + User)              │
│  Lives in: QF backend; we call via Express                   │
│                                                               │
│  Content APIs (client_credentials, scope=content):           │
│  - Search API → wrong-verse error flow                       │
│  - Chapters API → supplementary metadata                     │
│                                                               │
│  User APIs (Authorization Code + PKCE):                      │
│  - Bookmarks API → memorization sync to Quran.com            │
│  - Goals API → long-term targets sync                        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Layer 3: Tahfeedh-specific data                             │
│  Source: User actions in our app                             │
│  Lives in: Supabase (Postgres + RLS)                         │
│                                                               │
│  - Users, roles, teacher-student enrollments                 │
│  - Memorization state (pages + ayahs)                        │
│  - Ayah review state (algorithm input)                       │
│  - Tests, errors, error rollups                              │
│  - Goals (mirrored to QF), settings                          │
└──────────────────────────────────────────────────────────────┘
```

### Why this split

If everything were on QF APIs:
- App becomes useless without network
- Rate limits affect every page render
- Future portability impossible

If everything were in our own DB:
- Re-inventing Quranic reference data (waste)
- No cross-app continuity with Quran.com
- Lower API Use score for the hackathon

The split optimizes for **performance, portability, and judging score** simultaneously.

### Future portability path

Removing QF integration:
- Delete `apps/server/src/qf/` folder
- Ship a static search index for the wrong-verse search feature
- Drop bookmark/goal sync; data stays local

The static QUL data stays. The Tahfeedh DB stays. The integration is genuinely at the edges.

---

## 6. Feature Scope

### 6.1 IN (MVP)

**Student-facing:**
- Sign up → role selection → onboarding
- Today view: streak, "what to memorize next," "what to review today," per-item reasons
- Tests: "Begin test" entry point (guest-witnessed, see ADR 0004) + past tests history
- Timeline / Calendar view: past tests, errors over time, milestones
- My Mushaf view: all 604 pages, color-coded by status, with historical error overlays
- Memorization marking (per page, or per verse for in-progress pages)
- Goal creation (long-term targets)
- Settings: pages per session, completed-Quran flag
- Classroom tab — see active teachers, join via teacher's 8-char code, leave teacher (ADR 0028)
- Page deep-dive: tap any page → see all errors, all tests, full history

**Teacher-facing:**
- Sign up → role selection → generate an 8-char invite code (24h TTL, reusable, rotatable) for students to join with (ADR 0028)
- Student list, grouped by class (groups CRUD)
- Drill into any enrolled student → view their data + teacher controls
- Start test on a student: pick test_type, pick range, enter live test mode
- Live test mode: mushaf renders range with overlays, tap to log errors, error modal for type/severity/note
- Tests overview: flat list of all tests this teacher has run across all enrolled students
- Post-test summary: new errors / recurring errors / cleared errors
- Group management

**Shared / system:**
- Mushaf rendering with three overlay modes (simple highlights / heatmap / color-by-type)
- Tap any highlighted location → modal with full occurrence history, trend, teacher notes, "mark resolved"
- Session-based algorithm for generating Today's plan
- 3-stage recent-revision graduation state machine
- Daily streaks
- QF Bookmarks sync on memorization actions
- QF Search integration in wrong-verse error modal
- QF Goals sync when goal is created/updated (if time)

### 6.2 OUT (mention in demo as roadmap)

- Self-test mode
- Audio + word-level highlighting (post-test review)
- Cloze cards / flashcards / spaced-repetition card sets
- Realtime sync between teacher/student devices during tests
- Indo-Pak (16-line) mushaf support
- Student notes (only teacher notes on errors for MVP)
- Letter / harakat-level error precision (word-level is enough; teacher_note covers the rest)
- Freeze days (streak preservation)
- Goal templates
- Multi-language UI
- Mutashabihat features (CONDITIONAL — only if M1–M6 ship smoothly; see M9)

### 6.3 Onboarding Flow

All new users complete a mandatory post-login onboarding before reaching the Today view. The signup form itself stays minimal (email, password, role). Onboarding is the data-collection layer that makes Today meaningful on day one.

**Gate:** `student_settings.onboarding_complete = false` redirects all protected routes to `/onboarding`. Cannot be skipped — first session is worth the 60–120 seconds it takes.

#### Step 1 — Memorization state declaration

User picks one of three paths:
- **Just starting fresh** — no memorization yet; algorithm starts at page 1
- **I've memorized some already** — proceed to Step 2 to capture state
- **I've memorized the whole Qur'an** — all 604 pages marked memorized; `has_completed_quran = true`; skip to Step 3

#### Step 2 — Memorization capture (two modes)

Mode toggle at top: `[ Juz Mode | Surah Mode ]`. Both modes write to the same underlying tables; users can switch without losing selections.

**Juz Mode** (default for "some already" path):
- 30-cell grid, one cell per juz, tap to toggle
- Shortcut buttons: `[Juz 1–5]` `[Juz 26–30]` `[All 30]`
- Optional "Currently in the middle of one?" → pick juz, then surah within juz, then ayah position

**Surah Mode** (for cherry-picked or mixed memorization):
- Scrollable, searchable list of all 114 surahs
- Tap to toggle each surah as memorized
- For any selected surah, optional partial: "All of it" (default) or "ayahs 1 to ___"
- Search supports English transliteration, Arabic name, and surah number

Users can mix patterns by switching modes (e.g., select juz 1–2 + juz 28–30 in juz mode, then switch to surah mode to add scattered Surah Yaseen + Surah Al-Mulk). Selections persist across mode switches and visually reflect each other where they overlap.

#### Step 3 — Daily session size

Two questions, with traditional madrasa defaults preselected:

**New memorization per day:**
- Half a page (~7–8 lines)
- 1 page ← default
- 2 pages
- Custom...

**Revision per day:**
- 3 pages
- 5 pages ← default
- 10 pages
- Custom...

A note below: "You can change these anytime in Settings."

#### Database writes at onboarding finish

For each fully-memorized juz or surah from Step 2:
- Insert `memorization_page` rows for every page covered, `status = 'memorized'`, `memorized_at = signup_date - 30 days`
- Insert `ayah_review_state` rows for every ayah covered: `last_reviewed_at = signup_date - 30 days`, `consecutive_clean_tests = 0`, `recent_stage = NULL` (enters old revision pool directly, bypasses recent revision queue)

For partial-page in-progress memorization:
- Insert `memorization_verse` rows up to the marked ayah
- Insert one `memorization_page` row for that page with `status = 'in_progress'`

For "whole Qur'an" path:
- Same as full memorization for pages 1–604
- `app_user.has_completed_quran = true` (the flag lives on the identity row, not `student_settings` — see ADR 0008)

For Step 3:
- `student_settings.pages_per_session_new = [chosen value]` (NUMERIC, allows 0.5)
- `student_settings.pages_per_session_revision = [chosen value]`
- `student_settings.onboarding_complete = true`

#### Rationale for "stale" imported memorization

All imported memorization gets `last_reviewed_at = signup_date - 30 days` rather than the current date. This causes the algorithm to surface imported pages naturally across the first few sessions of revision, rather than treating them as freshly tested. The first test rating on each page corrects the model — pages rated `excellent` quickly accrue mastery; pages rated `needs_work` get bumped up in priority.

This avoids asking the user "when did you last review this?" — a question whose answer doesn't reliably change behavior and would slow onboarding.

#### Half-page support (`pages_per_session_new = 0.5`)

When the user picks "Half a page" in Step 3, the algorithm splits each in-progress page into two halves. The split point is computed at build time per page (see §10.2 update).

New-lesson queue behavior when `pages_per_session_new < 1`:
- If the in-progress page has unmemorized ayahs in its first half → today's new lesson covers the first half
- Otherwise → today's new lesson covers the second half (and the page graduates to `memorized` when the second half passes a `strong_pass` test)

For values > 1 (e.g., 2 pages): emit N full pages in queue order.

For values where the in-progress page is already half-done and the daily quota is 1: today's new lesson is the remaining half + the first half of the next page.

#### Editing memorization later

Settings → "Edit Memorization" reopens the Step 2 picker in the user's last-used mode, pre-populated with current state. Saving updates the underlying rows. Useful when a student returns after an absence and wants to mark additional memorization without re-onboarding.

---

## 7. Session & Algorithm Model

### 7.1 What a session is

A **session** is the day's plan for a student:
- N pages of new material to memorize (default: 1)
- M pages of revision (default: 5)

The plan is computed once per session and **persisted** in `daily_session` (ADR 0020). The first call to the `today_session` RPC on a new calendar day runs the queues, writes the row, and returns it; subsequent reads return the same row. Reloading Today never reshuffles the day's pages — anti-gaming. A new session loads automatically on the next calendar day; an explicit "Load next session" CTA can also insert an additional `session_index` for the same date (DESIGN.md §7.7).

Tests are still independent events; they may or may not contribute to completing today's session. A session is **complete** when every page in `new_lesson_pages ∪ revision_pages` has been attempted in a closed test today (pass or fail — both count as "attempted"). The completion flag (`all_attempted`) is **derived** at read time from the test/test_range tables; only the plan itself is stored.

**Critical:** Tests do not "belong to" sessions. A test that covers a page outside today's required set is still valid — its data updates state for future sessions.

### 7.2 The three queues

Internally, the algorithm maintains three logical queues:

**Queue 1: New Lesson (deterministic)**
- Walk the student's memorization frontier (highest contiguous block of memorized pages)
- Suggest the next un-memorized page (or continuation of current in-progress page)
- Output: 1 entry by default

**Queue 2: Recent Revision (state machine)**

Pages enter at **stage 1** when they are first marked memorized (via `strong_pass` on a newly_memorized test). They cycle through stages until they "graduate" to old revision.

After each test that covers a recent-revision page:

| Rating | Stage change | ready_at |
|---|---|---|
| `strong_pass` or `excellent` | stage += 1 | now + interval[new_stage] |
| `good` | stays | now + interval[stage] |
| `needs_work` | max(1, stage - 1) | now + 1 session |
| `fail` | reset to 1; may downgrade page status | now |

**Intervals (in sessions):**
- Stage 1 → 2: 1 session
- Stage 2 → 3: 3 sessions
- Stage 3 → graduate: 7 sessions

When a page passes at stage 3 → **graduates** to old revision pool. `recent_stage` becomes NULL, `graduated_at` is set.

**Queue 3: Old Revision (weighted priority)**

Pages that have graduated. Scored each time the session plan is computed.

```
priority_score(page) =
    (sessions_since_last_review × w_recency)
  + (error_rate_last_3_tests × w_errors)
  - (mastery_factor × w_mastery)
  + juz_cohesion_bonus
  + overdue_factor × w_overdue
  + mutashabihat_penalty
```

Where:
- `w_recency = 1.0`
- `w_errors = 20.0`
- `w_mastery = 3.0`
- `mastery_factor = min(consecutive_clean_tests, 5) / 5`
- `juz_cohesion_bonus = 1.0` if any adjacent (±2) page was reviewed in last 3 sessions, else 0
- `overdue_factor = max(0, sessions_since_last_review - max_review_interval_sessions)` where `max_review_interval_sessions` defaults to 60
- `w_overdue = 10.0`
- `mutashabihat_penalty = 0.5 × count_of_mutashabihat_ayahs_on_page` (only if M9 ships)

Weights are starting guesses based on traditional hifz pedagogy. Real-world tuning is part of the post-MVP roadmap. Be ready to acknowledge this if asked during demo.

### 7.3 Filling the revision bucket

`pages_per_session_revision` is split across recent + old, recent-first:

1. Pull all pages from Recent Revision where `ready_at <= now()` for this student
2. Sort by stage ascending (lower stages need it more), then by ready_at ascending
3. If recent count < bucket capacity, fill remainder from Old Revision top-N by priority_score
4. Total never exceeds `pages_per_session_revision`

### 7.4 Session lifecycle

```
1. Student opens Today view
2. Backend computes session plan (algorithm)
3. Frontend renders: 1 new page + 5 revision pages with reasons per item
4. Teacher (with student) starts a test
5. Tests close as teacher ends them; errors logged; post-test pipeline runs
6. Coverage check: do today's tests cover all required pages' ayahs?
7. If yes → session complete; daily streak ticks
8. Student can optionally "load tomorrow's session early"
```

### 7.5 Daily streak

Defined as: consecutive previous calendar days (in student's local time) where session_status was 'complete'.

Today's streak is computed by `daily_streak()` function in Postgres, which walks backward day-by-day.

### 7.6 Critical UX rules

- **No backlog displayed.** "Today's 6 items" is the visible truth. Pages that "should have been reviewed yesterday" appear in today's plan implicitly (higher priority), but the student never sees the count of missed pages.
- **Each item has a reason.** "You haven't reviewed page 5 in 11 sessions." "Recently memorized — keep fresh." "Recurring errors detected." Builds trust in the algorithm.
- **Completion celebration.** When the session completes, show an explicit closure moment. Then optionally offer "Continue with tomorrow's session early?" — same caps.
- **No new advancement without revision.** Session completion requires both buckets (unless `has_completed_quran = true`).
- **Settings reach into the algorithm.** Students set bucket sizes; algorithm respects them. Defaults: 1 new + 5 revision.

### 7.7 "Continue tomorrow's session early"

After today's session is complete, offer this option. Regenerates queues with current state (post today's updates), same bucket caps. Daily streak does NOT double — streak rewards consistency, not volume.

Soft cap: after 3 sessions in a day, UI message softens ("Rest is also worship") but doesn't block.

---

## 8. Test Rules & Range Restrictions

### 8.1 Test types

```typescript
test_type: 'newly_memorized' | 'revision'
```

Only two types. The recent/old distinction is a property of the page (via `ayah_review_state.recent_stage`), not the test. Post-test, the system inspects each page covered and updates the appropriate queue.

### 8.2 Test ratings

| Rating | Applies to | Effect |
|---|---|---|
| `strong_pass` | newly_memorized | Page graduates to `memorized`; enters recent revision queue at stage 1 |
| `pass_needs_practice` | newly_memorized | Page stays `in_progress`; algorithm prioritizes |
| `excellent` | revision | Advances recent stage (if applicable); increments mastery counter |
| `good` | revision | Stays at current state; mastery counter increments if no errors |
| `needs_work` | revision | Resets mastery counter; bumps priority; recent stage may regress |
| `fail` | both | Resets mastery counter; page status may downgrade |

One column on `test`, six possible values. UI shows the relevant 3 options based on `test_type`.

### 8.3 Range restrictions

**For `test_type = 'newly_memorized'`:**
- Exactly one range
- Range must be contiguous (no gaps in pages or ayahs)
- All pages in range must have `memorization_page.status IN ('in_progress', 'memorized')`
- Range must be at or before the student's frontier (cannot test pages not yet attempted)
- UI typically restricts to last 14 days of memorized material

**For `test_type = 'revision'`:**
- Exactly one range
- Range must be contiguous OR a whole surah / juz / hizb / rub
- All pages in range must have `memorization_page.status IN ('memorized', 'mastered')`
- Range cannot include `in_progress` pages

### 8.4 Range representation

Stored as JSONB array of range objects. Even though MVP supports one range per test, the array shape allows v2 multi-range tests without schema change.

```json
[{ "type": "page", "start": 50, "end": 55 }]

[{ "type": "surah", "surah": 36 }]

[{ "type": "ayah", "surah": 2, "start_ayah": 1, "end_ayah": 20 }]

[{ "type": "juz", "juz": 30 }]

[{ "type": "hizb", "hizb": 60 }]

[{ "type": "rub", "rub": 240 }]
```

UI lets the teacher pick **one mode per test**.

### 8.5 Range resolution

All ranges resolve internally to a **set of (surah, ayah) tuples** via the static QUL data. The mushaf renders the full containing pages, but the test "covers" only the resolved ayahs.

This means:
- Testing Surah Al-Kawthar (3 ayahs at bottom of page 602) updates only those 3 ayahs' `ayah_review_state`
- Page 602's overall "review freshness" reflects which of its 13 ayahs have been touched
- No coverage threshold needed — each ayah only gets credit for being *actually tested*

Resolution function (TypeScript, server-side):
```typescript
function resolveTestRanges(ranges: Range[]): { surah: number, ayah: number, pageNumber: number }[]
```

Reads from local static data; no network call.

### 8.6 Additional test constraints

| Constraint | Rule |
|---|---|
| Open test limit | Only one open test per student at a time (unique partial index on `test` where `status = 'in_progress'`) |
| Auto-abandonment | Open tests with no `ended_at` after 24h → status set to `abandoned` by periodic job |
| Minimum duration | `ended_at - started_at >= 30 seconds` required to count as `completed`; otherwise auto-set to `abandoned` |
| Rating required | `status = 'completed'` requires `rating IS NOT NULL` (enforced by CHECK constraint) |
| Witness required | Insert into `test` requires either `is_my_student(student_id)` (enrolled teacher) OR `auth.uid() = student_id AND test_mode = 'guest_teacher'` (student-initiated guest test). Pure self-rating is impossible — the UI requires the device be handed to another person, see ADR 0004 |
| Test type matches page status | New tests can't be created for already-mastered pages; revision tests can't be created for never-memorized pages |

### 8.7 What is "covered" by a test

A page is "covered" by today's tests when **all of its ayahs** have a `last_reviewed_at = today` from at least one closed test today.

The UI shows partial coverage state ("Page 30 — 12 of 15 ayahs reviewed today") so teachers know exactly what's left.

---

## 9. Error Model

### 9.1 Error scopes

An error attaches to one of:
- A whole verse (e.g., "forgotten verse," "wrong verse jumped to")
- A range of words within a verse (e.g., "stumbled across three words")
- A single word (e.g., tajweed error on this word)
- A cross-verse jump (`error_type = 'wrong_verse'` with `related_surah`, `related_ayah` populated)

Encoded via nullable fields:

| Scope | `word_position` | `word_position_end` | `related_surah/ayah` |
|---|---|---|---|
| Whole verse | NULL | NULL | NULL |
| Single word | int | NULL or same int | NULL |
| Word range | int | int | NULL |
| Wrong verse | NULL or int | NULL or int | populated |

### 9.2 Error types

```typescript
error_type:
  | 'tajweed'         // pronunciation rules violation
  | 'pronunciation'   // letter sound wrong (not a tajweed rule)
  | 'omission'        // skipped a word/portion
  | 'addition'        // added a word that isn't there
  | 'mismatch'        // wrong word substituted
  | 'wrong_verse'     // jumped to a different verse (mutashabihat slip)
  | 'forgotten_verse' // couldn't continue
  | 'hesitation'      // long pause, prompting needed
```

### 9.3 Severity

```typescript
severity: 'minor' | 'moderate' | 'major'
```

Teacher's call. Used in the algorithm as a weight on error_rate (major errors count more).

### 9.4 Error signature

Each error has a computed `signature` column (Postgres `GENERATED ALWAYS AS ... STORED`) that produces a string like `surah:ayah:word:error_type`:

Examples:
- `2:35:5:tajweed` — tajweed error on word 5 of Baqarah ayah 35
- `108:1::forgotten_verse` — forgotten ayah 1 of Surah Al-Kawthar
- `2:35::wrong_verse` — wrong-verse jump from Baqarah 35

This allows fast grouping for "how many times has this specific error at this location occurred?" — the basis for recurrence detection.

### 9.5 Intensity is derived

The "intensity decay over time" concept lives in `error_location_stats`:
- `occurrence_count`: total times this signature has fired
- `last_seen_at`: most recent
- `tests_since_last_occurrence`: bumps each test covering the location where the error didn't recur
- `cleared`: true after 3+ tests without recurrence at this location

Intensity in the UI = `occurrence_count / (1 + tests_since_last_occurrence)`. Always computed at read time from the stats table.

### 9.6 Error detail modal

When a user taps an error overlay:

1. **Location** — surah, ayah, word(s) involved (rendered with QPC Hafs font)
2. **Type + severity**
3. **Occurrence history** — every individual `error_log` row at the location, grouped visually by signature (see §9.7 for the layout). Not a summary — each occurrence is listed with its date, severity, and any note.
4. **Trend** — ↓ improving / ↑ recurring / ✓ cleared
5. **Quick action** — "Mark as resolved" (manual override, sets `cleared = true`)

**Ghost errors** (ADR 0023). Occurrences whose `error_location_stats` row has `cleared = true` are hidden by default and represented by a single muted line: `+ N ghost errors (cleared) [show]`. Tapping `[show]` reveals them inline, visually de-emphasized. Ghosts never contribute to the mushaf marker badge — they only exist inside the modal, on demand. If a cleared signature recurs later, `cleared` flips back to false in the post-test pipeline (§13.4) and those rows un-ghost automatically on the next open.

### 9.7 Overlay rendering & overlap handling

Errors render as visual overlays on the mushaf at the most precise scope they have, with merging happening at the click target and the modal — never at the storage level.

**Rendering rules per scope**

| Error scope | How `error_log` row looks | Visual rendering |
|---|---|---|
| Single word | `word_position` set, `word_position_end` NULL or equal | Small dot/underline beneath that word |
| Word range | `word_position` and `word_position_end` set (different values) | Continuous underline across all words in range |
| Whole verse | `word_position` and `word_position_end` both NULL | Small icon at the verse end (near the ۝ marker) or subtle background tint on the verse number |
| Cross-verse jump | `related_surah` / `related_ayah` populated | Rendered at the source verse like a verse-scope error; modal shows the related destination |

**Multiple errors at the same location**

Three overlap cases handled by one rule: one marker per visual location, modal consolidates the list.

- **Case 1 — Same word, multiple historical errors:** Word 5 of Baqarah 35 has a tajweed error from one test and an omission error from another. One marker beneath word 5. Heatmap intensity reflects the combined intensity (per §9.5). Badge shows the count.
- **Case 2 — Different scopes touching the same words:** A word-level error on word 5 and a verse-level error on the same ayah. Both render — word marker beneath word 5, verse marker at verse end — because they occupy different visual positions.
- **Case 3 — Multiple errors at the same location in one test:** Teacher logs both "tajweed on word 5" and "hesitation on word 5" in a single test. One marker, count of 2.

**Word ranges in overlap aggregation:** an error with `word_position=5, word_position_end=8` is associated with words 5, 6, 7, and 8 for marker-aggregation. Tapping any of those words opens a modal that includes this error.

**Count badges**

Markers with more than one associated error show a small numeric badge (e.g., "3"). The badge appears:

- Top-right corner of word markers (small, ~10px circle)
- Adjacent to verse-end markers

Active in all three overlay modes (`simple`, `heatmap`, `colored`). The badge improves at-a-glance density signal even when the marker itself is colored.

**Visual density guardrail**

If a single word has more than 5 associated errors, render one marker with badge "5+" rather than stacking visual indicators. Modal still shows all errors when tapped. Same rule applies at verse-marker positions.

**Tap behavior**

Tapping any marker opens the error detail modal (§9.6) scoped to that location:

- Word marker → modal shows all errors associated with that word position (including any word-range errors that overlap it)
- Verse-end marker → modal shows all verse-scope errors for that ayah (excludes word-scope errors)

Modal lists errors grouped by signature, then chronologically within each signature:

```
Word 5 of Al-Baqarah, ayah 35 — 3 historical errors

Tajweed (2 times)
  ↳ Test on Mar 15, 2026 — moderate, "ikhfa missed"
  ↳ Test on Feb 28, 2026 — minor

Omission (1 time)
  ↳ Test on Mar 8, 2026 — moderate, "skipped quickly"

[Mark all as resolved]
```

---

## 10. Mushaf Rendering

### 10.1 Source data

Mushaf word-layout (Madani 15-line) and chapters/juzs metadata are pulled from `api.quran.com/api/v4` at build time — the same canonical QUL upstream data, exposed publicly without auth. See ADR 0002.

QPC V2 fonts (604 page-scoped woff2 files) come from `static-cdn.tarteel.ai/qul/fonts/quran_fonts/v2/woff2/p{N}.woff2`. See ADR 0003.

### 10.2 Build-time pipeline

Two scripts at the repo root, run by `npm run build:assets` (which is chained into `npm run build:web` for deploys):

**`scripts/build-quran-data.ts`** — fetches each page from `api.quran.com/api/v4/verses/by_page/{N}?words=true&word_fields=code_v2,line_number,position,location,char_type_name`, parallelized at concurrency 10. For each page 1–604, emit `apps/web/src/data/pages/{page}.json`:
   ```typescript
   {
     page_number: number,
     lines: Array<{
       line_number: number,
       line_type: 'ayah' | 'surah_name' | 'basmallah',
       is_centered: boolean,
       surah_number?: number,        // for surah_name lines
       words: Array<{
         id: string,                  // qul word id
         surah: number,
         ayah: number,
         position: number,             // word position within ayah (1-based)
         text: string                  // arabic text
       }>
     }>,

     // For half-page memorization support (per §6.3)
     midpoint_ayah_break: {
       first_half_last_ayah: { surah: number, ayah: number },
       second_half_first_ayah: { surah: number, ayah: number },
       first_half_line_count: number,
       second_half_line_count: number
     }
   }
   ```

   **Midpoint algorithm:** walk lines in order, accumulate line counts, pick the ayah break whose split is closest to 7.5 lines. If a single ayah straddles that boundary, prefer ending the first half on the earlier complete ayah. This produces a natural reading break every time, using the QUL layout data we already ingest — no external API needed.
4. Also emit `apps/web/src/data/metadata.json` from `/chapters` and `/juzs` (the `/juzs` endpoint returns each juz twice; the script dedupes by `juz_number`). Mutashabihat layered in if/when M9 ships.

**`scripts/download-fonts.ts`** — parallel fetch of `p1.woff2 … p604.woff2` from the Tarteel CDN into `apps/web/public/fonts/v2/`. Skips already-downloaded files unless `--force`. After downloading, emits `apps/web/src/styles/quran-fonts.css` with 604 auto-generated `@font-face` rules of the form `font-family: 'QPC V2 P{N}'`.

The 95 MB of woff2 files and the generated CSS are git-ignored — regenerated at deploy time, never committed.

Per-page JSON is preferable to runtime SQLite — smaller bundle per page, no SQLite client needed in browser, can be code-split per page via dynamic import.

### 10.3 MushafPage component

```typescript
<MushafPage
  pageNumber={50}
  overlays={errorOverlays}       // ErrorOverlay[]
  overlayMode="heatmap"          // 'none' | 'simple' | 'heatmap' | 'colored'
  memorizationState={memState}   // ayah-level state for visual indicators
  mutashabihatHighlights={true}  // optional (M9)
  onWordTap={handleWordTap}
  onVerseTap={handleVerseTap}
/>
```

Internally:
- Lazy-load `apps/web/src/data/pages/{pageNumber}.json` via dynamic import
- Render each line with QPC Hafs font
- Wrap each word in a tappable `<span>` with `data-surah`, `data-ayah`, `data-word-position` attrs
- Apply overlay CSS classes based on overlays prop
- Mid-page surah boundaries rendered as surah_name lines (separator + centered name)

### 10.4 Overlay modes

| Mode | Visual |
|---|---|
| `none` | Clean mushaf, no overlays |
| `simple` | Red marker per error location (word/range/verse), with count badge when >1 |
| `heatmap` | Markers colored by intensity ramp: `yellow.3` → `orange.6` → `red.9` per §9.5 |
| `colored` | Markers colored by error type per §15.1; if multiple types share a location, the marker uses the type of the most-recent error and the modal shows the rest |

User toggles between modes with four buttons above the mushaf. Tapping a highlighted location opens the error detail modal per §9.6 + §9.7.

Markers and badges render via two parallel computation functions in the frontend:

```typescript
function getOverlayMarkers(pageNumber, stats, mode):
  word_markers: Array<{ surah, ayah, word_position, intensity, count, signatures, color }>,
  verse_markers: Array<{ surah, ayah, intensity, count, signatures, color }>

function getErrorsAtLocation(scope: 'word' | 'verse', surah, ayah, word_position?):
  ErrorLog[]
```

Both functions read from `error_location_stats` (for intensity / aggregation) joined with `error_log` (for individual occurrence details surfaced in the modal).

### 10.5 Font setup

604 page-scoped fonts (one per Madani 15-line page) — see ADR 0003. Auto-generated CSS lives at `apps/web/src/styles/quran-fonts.css` and contains rules of the form:

```css
@font-face { font-family: 'QPC V2 P50'; src: url('/fonts/v2/p50.woff2') format('woff2'); font-display: swap; }
```

`<MushafPage pageNumber={N}>` applies `style={{ fontFamily: 'QPC V2 P${N}' }}` to each `.mushaf-word` descendant so the right per-page font is picked up. The base `.mushaf-word` rule only sets size, line-height, and cursor — never a `font-family`. Scoped to mushaf elements only.

### 10.6 Memorization status overlay (My Mushaf view)

The 604-page grid view shows pages with status colors:
- Untouched (no row) — light gray
- `in_progress` — yellow tint, with progress bar if `memorization_verse` rows exist
- `memorized` — green tint
- `mastered` — dark green / star

Tapping a page opens the page deep-dive (history, errors, tests, full mushaf rendering).

---

## 11. API Integrations

### 11.1 Quran Foundation — Content APIs

**Authentication:** `client_credentials` grant with `scope=content`.

```bash
POST https://oauth2.quran.foundation/oauth2/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded
Body: grant_type=client_credentials&scope=content
```

Token cached server-side (~1hr lifetime), refreshed before expiry. Cache in memory for MVP.

**Headers for all data calls:**
```
x-auth-token: <access_token>
x-client-id: <client_id>
```

Not `Authorization: Bearer`. Easy to get wrong.

**Endpoints used:**

| Endpoint | Use case | Where in app |
|---|---|---|
| `GET /content/api/v4/chapters` | Supplementary surah metadata | Surah pickers |
| `GET /content/api/v4/search?q={query}&size=10` | Find ayah by Arabic fragment | Wrong-verse error modal |

### 11.2 Quran Foundation — User APIs

**Authentication:** Authorization Code + PKCE flow.

```
1. User clicks "Connect Quran.com"
2. Express GET /auth/qf/start
   → generates PKCE verifier + challenge, stores verifier in session
   → redirects to https://oauth2.quran.foundation/oauth2/auth
     with response_type=code, client_id, redirect_uri,
     scope=openid offline_access user goal bookmark,
     code_challenge, code_challenge_method=S256, state
3. User logs in at QF
4. Redirect to {our}/auth/qf/callback?code=...&state=...
5. Express validates state, exchanges code + verifier → access_token + refresh_token
6. Tokens stored in qf_user_token table keyed to app_user.id
7. Future calls use stored token; refresh on 401 or proactively
```

Library: `openid-client`.

**Endpoints used:**

| Endpoint | Use case | Where in app |
|---|---|---|
| Bookmarks API | Auto-bookmark in-progress ayahs | When student starts memorizing a new page → upsert bookmark for next ayah |
| Goals API | Sync long-term targets | When goal created/updated in Tahfeedh → POST/PUT to QF Goals; store returned ID in `goal.qf_goal_id` |

### 11.3 OAuth token storage

Tokens are stored in `qf_user_token` table, keyed to `app_user.id`. RLS denies all client access — only Express service role reads/writes. Tokens never sent to the browser. Frontend talks to Express via session cookie; Express talks to QF using stored tokens.

### 11.4 QUL — Static Data

Not an API; downloaded once at build time. No runtime calls. No authentication.

### 11.5 Environment variables

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # server only

# Quran Foundation
QF_CLIENT_ID=
QF_CLIENT_SECRET=             # server only
QF_AUTH_URL=https://oauth2.quran.foundation
QF_API_URL=https://apis.quran.foundation

# Express
EXPRESS_PORT=3001
SESSION_SECRET=               # server only

# Frontend
VITE_API_BASE_URL=http://localhost:3001    # → Railway URL in prod
```

---

## 12. Schema Overview

Full DDL lives in `supabase/migrations/*.sql`. This section is the conceptual reference. Visual reference: `tahfeedh-er-diagram.svg`.

### 12.1 Tables (12 total)

| Table | Purpose | Key facts |
|---|---|---|
| `app_user` | Identity hub | Extends `auth.users`; single `role` column (dual-role deferred — see notes-for-future.md) |
| `student_settings` | Per-student config | 1:1 with `app_user`; auto-created via trigger |
| `teacher_invite_code` | Teacher-issued classroom codes (ADR 0028) | 8-char Crockford-ish, 24h TTL, reusable, rotatable; student enters to join |
| `student_group` | Teacher's classes/halaqahs | Owned by teacher; unique name per teacher |
| `enrollment` | Teacher ↔ student relations | Many-to-many; UNIQUE(teacher_id, student_id); RLS uses this |
| `memorization_page` | Page-level memorization | Sparse: no row = page untouched |
| `memorization_verse` | Verse-level (in-progress) | Sparse: used during partial-page memorization |
| `ayah_review_state` | Algorithm input | Ayah-level review timestamps + recent_stage state machine |
| `test` | Human-witnessed tests | JSONB ranges; only one open test per student; `teacher_id` nullable when `test_mode='guest_teacher'`; `guest_tester_name TEXT` optional. See ADR 0004 |
| `error_log` | Individual error entries | `signature` is GENERATED STORED |
| `error_location_stats` | Rollup of recurrent errors | Updated by Express after each test closes |
| `goal` | Long-term hifz targets | Synced with QF Goals API via `qf_goal_id` |
| `qf_user_token` | QF OAuth tokens | RLS denies all client access |

#### `student_settings` DDL (reflects onboarding flow per §6.3)

```sql
CREATE TABLE student_settings (
  user_id UUID PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  pages_per_session_new NUMERIC(3,1) NOT NULL DEFAULT 1.0
    CHECK (pages_per_session_new >= 0),
  pages_per_session_revision INT NOT NULL DEFAULT 5
    CHECK (pages_per_session_revision >= 0),
  has_completed_quran BOOLEAN NOT NULL DEFAULT false,
  max_review_interval_sessions INT NOT NULL DEFAULT 60,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Two changes from earlier drafts:
- `pages_per_session_new` is `NUMERIC(3,1)` (was `INT`) so `0.5` is valid — see half-page support in §6.3.
- `onboarding_complete BOOLEAN NOT NULL DEFAULT false` — new column gating route access.

Helper functions in §12.3 do not change; the algorithm reads `pages_per_session_new` as a number regardless of integer or fractional value.

### 12.2 Enums (12 total)

| Enum | Values |
|---|---|
| `user_role` | `student`, `teacher` |
| `memorization_status` | `in_progress`, `memorized`, `mastered` |
| `test_type` | `newly_memorized`, `revision` |
| `test_status` | `in_progress`, `completed`, `abandoned` |
| `test_mode` | `enrolled_teacher`, `guest_teacher` |
| `test_rating` | `strong_pass`, `pass_needs_practice`, `excellent`, `good`, `needs_work`, `fail` |
| `error_type` | `tajweed`, `pronunciation`, `omission`, `addition`, `mismatch`, `wrong_verse`, `forgotten_verse`, `hesitation` |
| `error_severity` | `minor`, `moderate`, `major` |
| `enrollment_status` | `active`, `paused`, `completed` |
| `goal_status` | `active`, `completed`, `abandoned` |

### 12.3 Helper functions

| Function | Purpose |
|---|---|
| `current_session_number(student_id)` | Count of distinct days with completed test |
| `session_status_today(student_id, date)` | Returns (status, has_new, has_revision, completed_quran) |
| `daily_streak(student_id)` | Walks backward from today counting consecutive complete days |
| `_mint_invite_code()` | Internal: 8-char Crockford code (alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, no 0/O/1/I/L). ADR 0028 |
| `get_or_create_teacher_invite_code()` | Teacher RPC: returns the current live code or mints one (24h TTL). ADR 0028 |
| `rotate_teacher_invite_code()` | Teacher RPC: revokes the active code, mints a fresh one. ADR 0028 |
| `enroll_via_code(code)` | Student RPC: validates a teacher's code → INSERT or unpause enrollment. ADR 0028 |
| `leave_teacher(teacher_id)` | Student RPC: flips own enrollment to `'paused'`. ADR 0028 |
| `is_my_student(student_id)` | RLS helper: is the current `auth.uid()` a teacher of this student? (gates on `status='active'`) |
| `touch_updated_at()` | Generic updated_at trigger |
| `ensure_student_settings()` | Trigger: auto-create settings row when app_user created |

### 12.4 Key RLS principles

- **Every table has RLS enabled.** Even derived tables.
- **`is_my_student()` is the gate** for teacher-reads-student-data across most tables.
- **`ayah_review_state` and `error_location_stats` deny client writes** — only Express service-role client can mutate. These are derived state; mutating directly would break invariants.
- **`qf_user_token` denies all client access.** Tokens are sensitive; only Express reads them.
- **Cascade deletes are intentional.** Deleting a user deletes all their data. Documented in this principle.

### 12.5 Schema portability

The schema avoids Supabase-specific features beyond RLS:
- `auth.users` FK is the one tie-in; can be remapped during migration
- All other tables are plain Postgres
- Reference data is in the repo, not Supabase storage
- The Express service-role pattern can be replaced with any auth scheme

---

## 13. Post-Test Processing Pipeline

When a test transitions from `in_progress` → `completed`, Express runs this pipeline inside a Supabase transaction (using the service role client, which bypasses RLS).

### Step 1: Resolve test ranges
```typescript
const ayahsCovered = resolveTestRanges(test.ranges);
// → [{ surah, ayah, pageNumber, wordCount }, ...]
```

### Step 2: Update ayah_review_state for each covered ayah

For each `(surah, ayah)` in coverage:

```typescript
const errorsAtAyah = errorsInTest.filter(e =>
  e.surah_number === surah && e.ayah_number === ayah
);

await upsertAyahReviewState({
  student_id,
  surah_number: surah,
  ayah_number: ayah,
  last_reviewed_at: test.ended_at,
  last_reviewed_session_number: currentSessionNumber,
  consecutive_clean_tests: errorsAtAyah.length === 0
    ? existing.consecutive_clean_tests + 1
    : 0,
});
```

### Step 3: Recent revision state machine

For each ayah currently in recent revision (`recent_stage IS NOT NULL`):

```typescript
const newStage = computeNewStage(existing.recent_stage, test.rating, errorsAtAyah);
const interval = STAGE_INTERVALS[newStage]; // 1, 3, or 7 sessions

if (newStage > 3) {
  // graduate
  await update(ayah_review_state, {
    recent_stage: null,
    graduated_at: test.ended_at,
    ready_at: null,
  });
} else {
  await update(ayah_review_state, {
    recent_stage: newStage,
    ready_at: addSessions(now, interval),
  });
}
```

### Step 4: Error_location_stats updates

Group errors by signature; for each signature:

```typescript
await upsertErrorLocationStats({
  student_id,
  signature,
  surah_number, ayah_number, word_position, error_type,
  occurrence_count: existing.occurrence_count + 1,
  last_seen_at: test.ended_at,
  tests_since_last_occurrence: 0,
  cleared: false,
  first_seen_at: existing.first_seen_at ?? test.ended_at,
});
```

For locations covered by the test where no error of that signature fired (i.e., the location was *tested but clean*):

```typescript
await update(error_location_stats,
  { tests_since_last_occurrence: tests_since_last_occurrence + 1,
    cleared: tests_since_last_occurrence + 1 >= 3 },
  { student_id, signature, /* location covered by test */ });
```

### Step 5: Memorization status promotion

For pages where all ayahs were tested in this `newly_memorized` test with `strong_pass`:

```typescript
await update(memorization_page, {
  status: 'memorized',
  memorized_at: test.ended_at,
});

// And insert/update ayah_review_state for these ayahs with recent_stage=1
```

For pages with 5+ consecutive clean revision tests:
```typescript
await update(memorization_page, {
  status: 'mastered',
  mastered_at: test.ended_at,
});
```

### Step 6: QF Bookmarks sync (fire-and-forget)

If the student is connected to QF (has `qf_user_token` row):
- For new memorization → upsert bookmark for next un-memorized ayah
- Errors here don't fail the transaction; logged for retry

### Step 7: Return summary

```typescript
return {
  test_id,
  new_errors: [/* signatures not in stats before */],
  recurring_errors: [/* signatures with prior occurrences */],
  cleared_errors: [/* locations cleared during this test */],
  pages_promoted: [/* pages that changed status */],
};
```

This summary powers the post-test summary screen.

### Implementation note

All steps run in **one Supabase transaction** via service role client (bypasses RLS for writes to `ayah_review_state` and `error_location_stats`). The frontend never writes to these tables directly.

---

## 14. UI Structure

### 14.1 Layout

Mantine `AppShell`:
- **Header (64px):** semi-transparent `parchment.0` with `backdrop-filter: blur(14px)`. Left: dot-style role badge. Right: user pill (gradient mihrab→sage avatar, name, email, chevron → dropdown with Settings / Sign out). Brand wordmark lives in the sidebar, not the header.
- **Sidebar (268px, left, collapsible on mobile):** `parchment.0 → sage.1` gradient panel. Top: brand wordmark (Cairo `تَحفِيظ` + Playfair "Tahfeedh"). Then a section label, bilingual nav rows (English left / Amiri Arabic right), version footer. Active state driven by `useMatchRoute` + `[data-active]` attribute — never via React hover state (ADR 0010).
- **Main:** radial `mihrab.7 → mihrab.9 → mihrab.10` gradient for depth. Cards float above with their own shadows.

### 14.2 Student navigation (sidebar)

- **Today** (default) — daily plan
- **Tests** — "Begin test" CTA (guest-witnessed; see ADR 0004) + past tests history
- **Timeline** — calendar / history view (errors over time, milestones)
- **My Mushaf** — 604-page grid + page deep-dive
- **Goals** — long-term targets
- **Settings** — capacity sliders, completed-Quran flag, invite code, profile, **Edit Memorization** (reopens onboarding Step 2 with current state pre-populated)

### 14.3 Teacher navigation (sidebar)

- **Students** (default) — list of enrolled students
- **Groups** — class/halaqah management
- **Tests** — flat overview of all tests this teacher has run across all enrolled students
- **Settings** — profile

When a teacher drills into a student, the layout switches to show that student's data with a "Back to Students" breadcrumb.

### 14.4 Today view (the centerpiece)

Three vertical zones on top of the gradient `mihrab` main area:

**1. Hero strip (no card, sits on the dark ground)**
- Greeting line ("Good morning, Seena") with a sun/sunset/moon icon
- Bilingual title: Cairo `اليوم` over Playfair "Today", both in parchment
- Right side: streak badge — a glassy pill with a gradient flame icon (honey→brick when lit, neutral gray when 0), streak number, "day/days"

**2. Progress card (cream `Card`, radius xl)**
- 30-cell juz grid (one cell per juz) colored by aggregated page status:
  - sage.7 = mastered, sage.4 = memorized, honey.4 = in-progress, white tint = untouched
- Tooltip per cell ("Juz 12 — memorized"); hover lifts cell 2px
- Western "completed / 30 juz" caption + Arabic-Indic counter `٣٠ / ٣٠` on the right
- Legend chips below: memorized N · mastered N · in progress N · untouched N

**3. Plan card (cream `Card`, radius xl)**
- Header: "Today's plan" tag + "0 of N covered today" caption (real session-completion math lands in Phase D)
- `Divider` labelled "New lesson" → `EmptySlotCard` with sage-gradient icon halo, badge chip pointing at the phase that wires it
- `Divider` labelled "Revision queue" → `EmptySlotCard` with honey-gradient icon halo
- Footer caption: "Tests are the only way pages move through the queues — start one whenever a witness is ready."

For teachers in test mode, the "Start" / item rows are tappable to launch the test flow with that range pre-loaded.

For teachers in test mode, the "Start" / item rows are tappable to launch the test flow with that range pre-loaded.

### 14.5 Live test screen

Two-pane layout:
- **Left:** Mushaf rendering with overlays + word/verse tap handlers
- **Right (sidebar drawer on mobile):** Test metadata, errors logged so far, "End Test" button

Tapping a word or verse opens the error logging modal:
- Error type selector (8 options as colored chips)
- Severity selector (minor/moderate/major)
- Optional note text area
- For `wrong_verse`: QF Search field to find the target ayah
- [Save Error] / [Cancel]

End test:
- Rating selector (3 options based on test_type)
- Optional overall notes
- [Submit]

### 14.6 Post-test summary

```
┌─ Test Complete ──────────────────────────┐
│ ✓ 12 minutes • 5 pages reviewed          │
│                                          │
│ Rating: Good                              │
│                                          │
│ NEW ERRORS (3)                            │
│  ⊗ Tajweed on word 4 of 2:35              │
│  ⊗ Hesitation on 2:38                     │
│  ⊗ Wrong-verse jump from 2:50 → 2:286    │
│                                          │
│ RECURRING (1)                             │
│  ↻ Omission on word 7 of 2:30 (3rd time) │
│                                          │
│ CLEARED (2)                               │
│  ✓ Tajweed on 2:25 — clean for 3 tests   │
│  ✓ Pronunciation on 2:28 — clean         │
│                                          │
│  [Review Each Error]    [Done]            │
└──────────────────────────────────────────┘
```

### 14.7 Teacher students list

Card-based view, sortable / filterable:
- Student name + photo
- Streak count
- Last test date
- Today's session status (complete / pending)
- Tap → student drill-in view

Group management is a separate route.

### 14.8 Mobile responsive

All screens designed for 375px wide minimum. Sidebar collapses to bottom nav on mobile. Mushaf scales font down to 22px on narrow screens. Test logging modal becomes full-screen on mobile.

---

## 15. Visual Design Tokens

Using Mantine's default color tokens:

### 15.1 Error type colors

| Error type | Token | Hex (Mantine default) |
|---|---|---|
| tajweed | `blue.6` | #228be6 |
| pronunciation | `cyan.6` | #15aabf |
| omission | `red.6` | #fa5252 |
| addition | `orange.6` | #fd7e14 |
| mismatch | `grape.6` | #be4bdb |
| wrong_verse | `pink.6` | #e64980 |
| forgotten_verse | `red.8` | #c92a2a |
| hesitation | `yellow.6` | #fab005 |

### 15.2 Heatmap ramp (overlay mode "heatmap")

- Low intensity: `yellow.3` (#ffe066)
- Medium: `orange.6` (#fd7e14)
- High: `red.9` (#a51111)

Interpolated linearly by intensity score.

### 15.3 Memorization status colors

| Status | Token |
|---|---|
| untouched (no row) | `gray.1` |
| in_progress | `yellow.3` |
| memorized | `green.4` |
| mastered | `green.7` (with star icon) |

### 15.4 Typography

- UI body / headings: see DESIGN-SYSTEM.md §3 (six-font discipline: Playfair, Montserrat, Roboto, Cairo, Amiri, Scheherazade New)
- Mushaf text: 604 page-scoped QPC V2 woff2 fonts (`QPC V2 P{N}`), one per Madani page — see ADR 0003
- Mushaf font size: 28px desktop, 22px mobile, line-height 2

### 15.5 Spacing & layout

Standard Mantine spacing tokens. AppShell sidebar 260px wide on desktop. Content max-width 1200px centered.

---

## 16. Demo Video Plan

**Length:** 2:30–3:00
**Style:** Problem/solution narrative
**Tone:** Authentic, calm, not salesy

### Structure

**0:00–0:30 — The Pain**
- Open with a hafiz student's reality: scattered notes, teacher with no shared memory of past mistakes, the cycle of memorize → forget → re-memorize
- Voice-over: "Hifz is one of the most demanding journeys in Islam — but the tools to help haven't kept up. Students forget what they've memorized. Teachers can't track what each student struggles with. The relationship at the heart of hifz is invisible to software."

**0:30–2:15 — The Solution: Tahfeedh in action**
- Solo student opens app, sees Today plan — 1 new lesson + 5 reviews
- Each item has a reason ("Recurring errors on this page")
- Teacher generates an invite code and shares it (per ADR 0028)
- Student opens the Classroom tab, taps "Join via code", enters the 8-char code
- Teacher's view: student appears under "Ungrouped" with full history visible
- Teacher starts a live test on page 5
- Mushaf renders with **historical error overlays** (heatmap toggle visible)
- Teacher taps a word that was wrong last time — error modal pops up showing it's recurred 3x
- Teacher logs a new error during the test
- A wrong-verse error: teacher types a fragment, **QF Search** finds the ayah the student jumped to
- End test, see post-test summary: new / recurring / cleared
- Show how this **changes tomorrow's session** — that page is now scheduled sooner
- Teacher dashboard: 3 students at a glance, drill into another one

**2:15–2:35 — The Integration**
- Brief explanation of what powers it:
  - QUL / Tarteel AI: canonical mushaf data + mutashabihat
  - Quran Foundation: Search API, Bookmarks sync, Goals sync
  - "Open Quran.com — your bookmark is already where you left off in Tahfeedh"

**2:35–3:00 — The Vision**
- Roadmap callouts: mobile native, audio review, mutashabihat AI, multi-language
- Closing: "Hifz isn't memorization. It's a relationship. Tahfeedh is built around that truth."

---

## 17. Seed Data Plan

Goal: a stranger hits the demo URL, logs in as either persona, immediately sees populated realistic data.

### Seed accounts

```
demo-teacher@tahfeedh.app    / password: TahfeedhDemo2025
demo-student@tahfeedh.app    / password: TahfeedhDemo2025
```

### Demo data structure

**One teacher** (`demo-teacher@tahfeedh.app`) with **3 enrolled students:**

| Student | Profile | Memorization | History |
|---|---|---|---|
| Ahmad (demo-student) | Intermediate | Pages 1–50 (Juz 1 done, into Juz 2) | 18 tests over 6 months |
| Fatima | Advanced | Pages 1–150 (5 juz) | 22 tests over 8 months |
| Yusuf | Beginner | Pages 590–604 (Juz 30 in progress) | 10 tests over 3 months |

### Seed generation principles

- Tests dated realistically (~2-3 per week per student, with occasional gaps)
- Errors cluster on known difficult ayahs (mutashabihat-heavy pages)
- Error rates decrease over time as students "improve"
- Some errors recur 3+ times to demonstrate the heatmap
- Some errors get cleared (don't recur in last 3 tests)
- Ahmad has a session in progress for "today" — partially completed, demoable

### Implementation

`scripts/seed.ts`:
- Reads service-role key from env
- Creates auth.users via Supabase Admin API
- Inserts `app_user`, `enrollment`, `student_group` rows
- Generates timestamped `test` + `error_log` rows by walking a realistic schedule
- Computes initial `ayah_review_state` and `error_location_stats` via the post-test pipeline
- Idempotent: drops + recreates demo data on each run

Run after every deploy to keep demo state fresh.

---

## 18. Submission Writeup Draft

> **Tahfeedh** is a hifz CRM built on the principle that Quran memorization is a relationship — between a student, a teacher, and the Quran itself. It gives memorizers a daily session plan that balances new lessons with revision, gives teachers a live testing interface that overlays each student's historical mistakes onto the mushaf, and uses a custom session-based spaced repetition algorithm tuned for the way hifz actually works.
>
> **Quranic data architecture.** Tahfeedh combines two complementary sources:
>
> *From Quranic Universal Library (Tarteel AI):* the KFGQPC V2 Madani 15-line mushaf layout, word-by-word script, and QPC Hafs font ship with the app for authentic, offline-capable mushaf rendering. We also use QUL's 5,277-entry mutashabihat dataset to identify verses most prone to confusion and adjust review frequency accordingly.
>
> *From Quran Foundation APIs:*
> - **Search API** powers a unique error-logging workflow — when a student slips into a wrong verse (the classic mutashabihat trap), teachers type a fragment of what they heard and Tahfeedh finds it across all 6,236 ayahs.
> - **Bookmarks API** syncs in-progress memorization to the student's Quran.com account so their journey follows them across apps.
> - **Goals API** mirrors long-term hifz targets across both platforms.
>
> **The result:** an app where static canonical data is shipped with the app for speed, while user-bound, dynamic concerns flow through QF's APIs. Custom hifz logic — error tracking with type and severity, the live test flow, the spaced repetition algorithm — runs entirely on Tahfeedh's own infrastructure, designed by and for the hifz tradition.

---

## 19. Milestone Build Plan

Dependency-ordered. AI-paced. Tick them off as you go.

### M1 — Foundation ✅
- [x] Monorepo scaffold (apps/web + apps/server + packages/shared)
- [x] Vite + React + TanStack Router + Mantine in apps/web
- [x] Express + TypeScript in apps/server with one /health route
- [x] Supabase project created
- [x] Run migrations 1–8 in Supabase SQL editor
- [x] Supabase auth wired in frontend: email/password signup, login, protected routes
- [x] Role selection at signup persists to `app_user.roles`
- [x] Express endpoint that calls QF Content API (`/chapters`) and returns the result
- [x] Frontend successfully fetches surah list via Express
- [x] One-time deploy to Cloudflare Pages + Railway, confirm pipeline works

**Done when:** sign up → log in → see a list of 114 surahs fetched through your backend.

### M2 — The Mushaf
- [ ] Download QUL V2 layout SQLite, word-by-word script, QPC Hafs font
- [ ] `scripts/build-quran-data.ts` converts SQLite → 604 per-page JSON files
- [ ] Build-time pipeline computes `midpoint_ayah_break` per page (used by half-page memorization)
- [ ] Metadata.json with surah names, juz/hizb boundaries
- [ ] `<MushafPage />` component with dynamic-imported page data
- [ ] @font-face setup for QPC Hafs
- [ ] Word-level and verse-level click handlers
- [ ] Three overlay render modes (stub data initially)
- [ ] My Mushaf grid view (604 pages, status placeholders)

**Done when:** navigate to any page (1–604), see beautiful mushaf rendering, tap any word/verse, see toggle-able overlays.

### M3 — Memorization + Today View
- [ ] Onboarding flow: Step 1 (state declaration), Step 2 (juz/surah mode picker), Step 3 (session size)
- [ ] Onboarding gate: redirect to `/onboarding` when `onboarding_complete = false`
- [ ] Bulk-write `memorization_page` + `ayah_review_state` rows from juz/surah selections
- [ ] Half-page support in new-lesson queue (when `pages_per_session_new < 1`)
- [ ] Mark page memorized → writes `memorization_page` row
- [ ] Partial-page memorization writes `memorization_verse` rows
- [ ] Frontend reads memorization state and colors My Mushaf grid
- [ ] Today view skeleton: streak (using `daily_streak()`), new lesson placeholder, review placeholder
- [ ] Algorithm Queue 1 (next un-memorized page) implemented
- [ ] Today view shows real "new lesson" row

**Done when:** fresh student signs up, marks pages, sees Today update, sees My Mushaf fill in.

### M4 — Tests + Errors
- [ ] Test creation flow: pick type, pick range (page picker UI)
- [ ] Live test view: mushaf with current range, error logging modal
- [ ] Error modal supports all 8 error types + severity + note
- [ ] Wrong-verse error type triggers QF Search inline
- [ ] Submit test → post-test processing pipeline runs (server-side)
- [ ] Errors written to `error_log`, stats updated
- [ ] Post-test summary screen with new/recurring/cleared
- [ ] Student-side **Begin test** entry point (guest-witnessed; ADR 0004) — trust nudge, optional `guest_tester_name`, same live-test UI as teacher path
- [ ] Student Tests sidebar — history list + Begin-test CTA
- [ ] Teacher Tests sidebar — flat overview of tests run across all enrolled students
- [ ] RLS: students can insert/update their own `test` rows when `test_mode='guest_teacher'`

**Done when:** end-to-end test from student selection → live test → error logging → submitted → summary visible, AND a student can run a guest-witnessed test on their own device with the same live-test UI.

### M5 — Algorithm + Today Full
- [ ] Queue 2 (recent revision state machine) implemented in pipeline
- [ ] Queue 3 (old revision priority) implemented
- [ ] Algorithm endpoint returns today's full plan
- [ ] Today view "review" section shows real data with reasons
- [ ] Tap a scheduled review → opens test flow pre-loaded
- [ ] Session completion check (`session_status_today`)
- [ ] Daily streak ticks correctly

**Done when:** complete a test, see tomorrow's revision queue change in defensible ways.

### M6 — Teacher Side (ADR 0027)
- [x] Teacher dashboard: enrolled students as a **directory** (groups as collapsible folders + Ungrouped section, sorted alphabetically). Per-row chips: streak, today's session status (complete / partial / pending), last test rating + relative time.
- [x] Group CRUD (create, rename, delete) — inline on the Students route. Dedicated `/groups` route dropped per ADR 0027.
- [x] Click student → drill-in `/students/$studentId` — header (name, group, streak, "Start test for this student") + reused M7 cards (`<ForecastCard>`, `<ActivityStatsCard>`, `<RevisionHealthGrid>`) + recent tests list.
- [x] "Start test for this student" → existing `TestCreationModal` in `mode="enrolled_teacher"`. Server `/api/tests/create` enrolled_teacher branch lights up (was stubbed 501 in Phase D).
- [x] Enrollment direction flipped (ADR 0028, migration 0021). Teacher mints an 8-char Crockford-alphabet invite code via the "Invite a student" modal on the Students page (`get_or_create_teacher_invite_code` / `rotate_teacher_invite_code` RPCs, reusable, 24h TTL). Student joins through the new `/classroom` route (`enroll_via_code` is now student-called). `student_code` table dropped. New students land Ungrouped — teacher organizes them via the Move-to-group menu.
- [x] Student-side Classroom view (`_authed.classroom.tsx`) — lists active teachers, "Join via code" CTA, "Leave class" per row via `leave_teacher(uuid)` RPC. Flipping enrollment to `'paused'` immediately revokes teacher data access via existing `is_my_student()` RLS gate.

**Done when:** teacher account manages 3 students across groups, runs a test on any of them, sees full history. ✅ Reached 2026-05-19.

### M7 — Progress + Error Drilldown + Polish

Reframed (ADR 0025): the old "Timeline" route presumed a chronological past-events view, but the recap route + Tests-landing sparkline already cover historical surfaces. The M7 route is now forward-looking — forecast, revision health, activity stats. The error-detail modal (ADR 0023 design / ADR 0026 implementation) lives on the mushaf.

- [x] **Progress dashboard** at `/progress` (renamed from `/timeline`): ForecastCard (next juz + full Quran completion at configured pace), ActivityStatsCard (7d/30d toggle — pages memorized, pages reviewed, tests + pass rate), RevisionHealthGrid (30 juz cells colored by stalest ayah's `last_reviewed_at`). Each component accepts `studentId?: string` so M6's teacher drill-in reuses them.
- [x] Error detail modal with per-occurrence list + ghost-error reveal toggle (ADR 0023 + ADR 0026) — opens from mushaf overlay taps.
- [ ] Empty states with personality
- [ ] Loading skeletons everywhere
- [ ] Error toasts on failures
- [ ] Mobile-responsive sweep (every flow at 375px width)
- [ ] PWA manifest + service worker stub

**Done when:** app feels finished. Empty states have personality. Mobile works.

### M7.5 — Settings Page
Carved out of M7 — the Settings route is currently an `EmptyState` stub and bundles enough surface area to be its own milestone slot.

Student settings:
- [ ] Daily capacity controls (`pages_per_session_new` + `pages_per_session_revision`) — sliders or numeric inputs with the same bounds onboarding Step 3 enforces (≤ 20, half-page allowed for new)
- [ ] `app_user.has_completed_quran` toggle
- [ ] Profile (name, email — read-only for MVP unless trivial)
- [ ] **Edit Memorization** — routes to `/onboarding?edit=1` with reducer state pre-populated from current DB rows. Submits through the existing `/api/onboarding/finish` + `commit_onboarding` path (recommended path in `notes-for-future.md`, zero new SQL)
- [ ] Hifz direction toggle (`student_settings.hifz_direction`) — currently only set at onboarding (ADR 0014)

Teacher settings:
- [ ] Profile only

**Not in scope:**
- Classroom membership / invite codes — they live on `/classroom` (student side) and the teacher Students route, not Settings (per ADR 0028).
- "Connect Quran.com" button — that lives in M8 (depends on OAuth flow).

**Done when:** a student can change daily capacity, toggle completed-Quran, switch hifz direction, and recalibrate their memorization claims via Edit Memorization, all from Settings.

### M8 — QF User APIs
- [ ] OAuth Authorization Code + PKCE flow in Express using `openid-client`
- [ ] `qf_user_token` storage
- [ ] "Connect Quran.com" button in student settings
- [ ] Bookmarks write-through on memorization actions
- [ ] Goals write-through on goal create/update (if time)

**Done when:** submission can honestly claim "Content + User API integrated."

### M9 — Mutashabihat (CONDITIONAL)
Only if M1–M7 went smoothly:
- [ ] Integrate QUL mutashabihat JSON
- [ ] Mushaf shows tricky-ayah indicators
- [ ] Wrong-verse error modal pre-suggests mutashabihat candidates
- [ ] Algorithm gets `mutashabihat_penalty` weight

### M10 — Seed Data + Demo Prep
- [ ] `scripts/seed.ts` written and tested locally
- [ ] Run against deployed Supabase
- [ ] Verify demo URL works end-to-end with both credentials
- [ ] README has demo creds + screenshots + tech stack + APIs used + roadmap

### M11 — Submission
- [ ] Record demo video (problem/solution structure)
- [ ] Edit, add captions
- [ ] Write submission description + API usage paragraphs
- [ ] Final README polish
- [ ] Submit form
- [ ] Post in Quran Foundation Hackathon Discord that you submitted

---

## 20. Open Items & Ambiguities

Things to decide or refine *during* implementation, not blocking the start:

### 20.1 Algorithm weight tuning
The weights in §7.2 are starting guesses. After seed data exists, run a mental simulation: does the algorithm surface intuitive pages? Adjust before demo.

### 20.2 Mid-page surah boundary rendering
When a surah ends and another begins on the same page, the mushaf needs a separator line + the new surah's name. The QUL layout data includes line types — handle `surah_name` and `basmallah` line types specially in `<MushafPage />`.

### 20.3 Time zones
Session completion is "today in student's local time." For MVP, assume browser-reported timezone. Store all timestamps as UTC; convert on read. Add user timezone setting to `student_settings` if it becomes an issue.

### 20.4 QF Bookmarks API write semantics
Need to confirm: does the Bookmarks API replace existing bookmarks, append, or upsert by some key? Test during M8 integration. Fall back to "skip if it errors" — don't let QF sync block memorization actions.

### 20.5 Soft cap on "continue tomorrow's session early"
Currently undefined ceiling. Decide during UX polish in M7.

### 20.6 Error severity weighting in algorithm
Currently `error_rate_last_3_tests` treats all errors equally. Consider weighting `major > moderate > minor`. Decide once real data exists in seed.

### 20.7 What happens when a teacher revokes a student
`enrollment.status = 'completed'` — teacher can no longer see student data via RLS. Student keeps all data. Decide if there should be a soft delete or hard delete on the teacher side.

### 20.8 Mutashabihat dataset format
Need to inspect the JSON structure when downloading from QUL — may require post-processing to match (surah, ayah) → list of similar (surah, ayah). Handle during M9.

### 20.9 Demo video voice
Record yourself reading the script, or use TTS? Decide M11.

### 20.10 Mushaf rendering at narrow widths
QPC Hafs at 22px may still overflow some pages at 375px. Test early in M2 and adjust line-height/font-size or implement horizontal scroll on the mushaf container as fallback.

### 20.11 Concurrent test edits
A teacher could theoretically edit an error during a test from one tab while submitting from another. For MVP, accept last-write-wins. Add row-version optimistic locking in v2 if it becomes an issue.

### 20.12 Reading direction
Mushaf is RTL. UI is LTR. Make sure the mushaf container has `dir="rtl"` while the surrounding UI stays LTR. Test in M2.

### 20.13 Re-onboarding edge cases
When a user uses Settings → Edit Memorization to mark *additional* memorization beyond what was originally captured, the new pages/ayahs should get `last_reviewed_at = now - 30 days` (same as original onboarding). If they mark pages as *no longer memorized* (e.g., they over-claimed at onboarding), decide: hard delete the rows, or set status back to `in_progress`. Recommend soft (status reset) to preserve any test history that might exist. Handle in M7.

### 20.14 Marker visual style and badge legibility
Word markers need to be visually distinct enough to be tappable on mobile (44×44px minimum tap target per accessibility guidelines) without crowding the mushaf text. Initial implementation: a 6px dot positioned ~4px beneath the word's baseline, with an invisible 44×44px tap-target wrapper. Badge text uses 9–10px font at high contrast. Test legibility at 22px mushaf font on mobile during M2 — if dots interfere with reading, switch to a subtle underline style.

For verse-end markers: position adjacent to the ۝ ayah number marker. Keep small enough that an unaffected verse and an error-marked verse look near-identical at a glance — the overlay should augment the mushaf, not replace its visual identity.

### 20.15 Error detail modal sort key
Within each signature group (§9.6, ADR 0023), occurrences need an order. Two candidates: **severity desc, then recency desc** (most-actionable first) or **recency desc** (most-recent first). They disagree when an old `major` competes with a fresh `minor`. Pick during M7 once we have real seed data to look at.

When multiple errors aggregate at one location, the marker's intensity = max of individual intensities (single hottest error drives the color).

---

## 21. Glossary

- **Hifz** — Quran memorization
- **Hafiz** (m) / **Hafiza** (f) — someone who has memorized the Quran (or is memorizing)
- **Sabaq** (Urdu) / **Hifz al-Jadid** (Ar.) — new lesson; pages being memorized for the first time. *Tahfeedh's term: "Newly Memorized"*
- **Sabqi** (Urdu) / **Murajaa Qaribah** (Ar.) — recent review; reinforcing newly-memorized material
- **Manzil** (Urdu) / **Murajaa Baidah** (Ar.) — old review; maintaining long-memorized material. *Tahfeedh's term: "Revision" (covers both recent and old)*
- **Mutashabihat** — verses that are similar to other verses, a major source of memorization confusion
- **Mushaf** — a physical or printed copy of the Quran with a specific page layout
- **Madani 15-line** — the canonical mushaf layout used globally (printed in Madinah; 604 pages)
- **Juz** — 1/30th of the Quran; the Quran has 30 ajzaa
- **Hizb** — 1/60th of the Quran (half a juz)
- **Rub** — 1/4 of a hizb
- **Halaqah** — a circle of students learning under one teacher
- **Tajweed** — the rules of Quranic pronunciation
- **QPC Hafs** — the King Fahd Quran Printing Complex font in the Hafs reading
- **QUL** — Quranic Universal Library (Tarteel AI's open dataset)
- **QF** — Quran Foundation (the organization running this hackathon)
- **PKCE** — Proof Key for Code Exchange; OAuth2 extension for public clients
- **RLS** — Row Level Security (Postgres feature; Supabase exposes this)
- **Onboarding** — mandatory post-login flow capturing existing memorization state and session preferences. Gates access to Today view via `student_settings.onboarding_complete`.
- **Midpoint ayah break** — computed-at-build-time data identifying the natural ayah boundary closest to a page's vertical midpoint, used for half-page memorization slicing.

---

*End of document. Last updated at design lock. Update freely during build.*
