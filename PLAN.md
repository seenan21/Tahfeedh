# Tahfeedh — Build Plan

> Short anchor for when context is cleared. Full milestone detail lives in DESIGN.md §19; design decisions live in `decisions/`.

**Deadline:** 2026-05-20 (Quran Foundation Hackathon).

---

## Where we are (snapshot — end of 2026-05-19)

Phases A–D are complete. The core of M5, M6, and M7 all landed today. Remaining: M7 polish bullets (empty states / skeletons / toasts / mobile sweep / PWA), M7.5 Settings page, M8 QF User APIs, M9 mutashabihat (conditional), M10 seed + demo prep, M11 video + submission. Deadline 2026-05-20.

### Shipped today (2026-05-19)

- **M5 algorithm closure (ADR 0024, migration 0020).** `submit_test` rolls per-ayah `consecutive_clean_tests`, runs the full Queue 2 stage machine + interval scheduling, fail-resets `recent_stage` to 1 (+ clears `graduated_at` on regression), promotes `memorized → mastered` after 5 consecutive clean strong-pass revisions. `_compute_session_plan` does Queue 2 first (by `min(stage)` asc → `min(ready_at)` asc), tops up with Queue 3 graduated pages scored by the DESIGN.md §7.2 formula minus `mutashabihat_penalty` (TODO M9).
- **M6 teacher side (ADRs 0027 + 0028).** Students directory route (groups as collapsible folders + Ungrouped section, inline group CRUD, Move-to-group menu), drill-in route at `/students/$studentId` reusing M7 progress cards via the `studentId?` prop + "Start test for this student" wired to `TestCreationModal` in `enrolled_teacher` mode. Server `/api/tests/create` enrolled_teacher branch implemented.
- **Enrollment direction flipped (ADR 0028, migration 0021).** Dropped `student_code`. Teacher mints an 8-char Crockford-alphabet invite code (`get_or_create_teacher_invite_code` / `rotate_teacher_invite_code`, reusable, 24h TTL). Student joins via the new `/classroom` route (`enroll_via_code` is now student-called). `leave_teacher(uuid)` RPC flips the student's enrollment to `'paused'`, immediately revoking the teacher's data access via the existing `is_my_student()` RLS gate.
- **M7 core (ADRs 0025 + 0026).** Renamed `_authed.timeline.tsx` → `_authed.progress.tsx`. New `apps/web/src/features/progress/` folder: `ForecastCard` (configured-pace projection to next juz + full Quran), `ActivityStatsCard` (7d/30d toggle — pages memorized, distinct pages reviewed, tests + pass rate), `RevisionHealthGrid` (30 juz cells colored by stalest ayah's `last_reviewed_at`). Each card accepts `studentId?` for M6 drill-in reuse. `ErrorDetailModal` in `apps/web/src/mushaf/` opens on overlay taps with per-occurrence list grouped by `error_type` + ghost reveal for cleared signatures.

### Previously shipped

- **M1 (Foundation):** monorepo (apps/web + apps/server + packages/shared), Vite + React + Mantine + TanStack Router, Express, Supabase project + auth, Railway deploy (Node 22 for WebSocket-realtime).
- **Phase A:** `_authed` layout gate + role-aware sidebar + stub routes (ADR 0005).
- **Phase B:** 3-step onboarding (juz grid + searchable surah list + partial-page picker + half-page session sizes), `commit_onboarding` SQL fn, `quran-index.json` artifact, Today skeleton (streak + 30-cell juz progress), full visual polish pass.
- **Phase C:** reader-first My Mushaf, `MushafPage`, collapsible `MushafGrid` Tracker view, `PageDetailsPanel`, Queue 1 (`next_new_lesson` RPC), hifz direction picker.
- **Phase D:** live witnessed test flow (two-pane `LiveTestRoute`, `ErrorLogModal` with inline QF Search for `wrong_verse`), streaming error inserts (ADR 0018), `submit_test` post-test pipeline (ADR 0017), `PostTestSummaryModal` + recap route (ADR 0022), Tests landing sparkline + last-15 list (ADR 0021), overlay rendering with heatmap intensity + count badge.
- **Phase E partial (earlier today):** `daily_session` table + `today_session` / `load_next_session` / `_compute_session_plan` RPCs (ADR 0020). `SessionPlanCard` + `PlanRow` on Today.

### Live database

- Migrations 0001 → 0021 all applied to remote.
- Tables (all RLS-enabled): `app_user`, `student_settings`, `teacher_invite_code` (new in 0021), `student_group`, `enrollment`, `memorization_page`, `memorization_verse`, `ayah_review_state`, `daily_session` (0017), `test` (with `summary jsonb` from 0019), `error_log`, `error_location_stats`, `goal`, `qf_user_token`. `student_code` dropped in 0021.
- Functions (SECURITY DEFINER unless noted, `search_path=public`):
  - **Helpers (STABLE):** `is_my_student(uuid)`, `current_session_number(uuid)`, `session_status_today(uuid, date)`, `daily_streak(uuid)` — `authenticated`.
  - **Onboarding:** `commit_onboarding(uuid, jsonb)` — service_role only (ADRs 0008, 0014).
  - **Memorization:** `mark_memorization(uuid, jsonb)` — service_role only, **reserved, no caller** (ADR 0015, for M7.5 Edit Memorization).
  - **Algorithm:** `next_new_lesson(uuid)` — direction-aware (ADRs 0013, 0014), `authenticated`. `_compute_session_plan(uuid)` — service_role only; full Queue 1/2/3 (ADRs 0020 + 0024). `today_session(uuid)`, `load_next_session(uuid)` — `authenticated` (ADR 0020).
  - **Post-test:** `submit_test(uuid, jsonb)` — service_role only; mastery promotion + stage machine (ADRs 0017 + 0024).
  - **Enrollment (ADR 0028):** `enroll_via_code(text)` — `authenticated`, **caller is now the student**. `get_or_create_teacher_invite_code()`, `rotate_teacher_invite_code()`, `leave_teacher(uuid)` — `authenticated`. `_mint_invite_code()` — internal, 8-char Crockford alphabet.

### Live Express endpoints

- `GET /health`
- `GET /api/qf/chapters`, `GET /api/qf/search` (QF Content API proxy)
- `POST /api/onboarding/finish` (ADR 0008)
- `POST /api/tests/create` — both `guest_teacher` and `enrolled_teacher` modes (ADRs 0004 + 0027)
- `POST /api/tests/:id/error` — streaming per-tap inserts (ADR 0018)
- `POST /api/tests/:id/finish` — resolves ranges + calls `submit_test` RPC

### What's still owed

- **M7 polish (Plan.Md M7 line):** empty states with personality, loading skeletons everywhere, error toasts, mobile-responsive sweep at 375px, PWA manifest + service worker stub.
- **M7.5 Settings page:** daily capacity sliders (`pages_per_session_*`), `has_completed_quran` toggle, hifz direction toggle, profile, **Edit Memorization** (reopens onboarding pre-populated, calls existing `commit_onboarding`). Per ADR 0028, no student-side invite code generation — Classroom tab owns the join flow.
- **M8 QF User APIs:** OAuth + PKCE flow via `openid-client`, `qf_user_token` storage, "Connect Quran.com" button (lives inside M7.5 Settings), Bookmarks write-through, optional Goals write-through.
- **M9 mutashabihat (conditional):** QUL mutashabihat JSON, tricky-ayah indicators on mushaf, wrong-verse pre-suggestions, `mutashabihat_penalty` term in `_compute_session_plan` (currently `-- TODO M9`).
- **M10 seed + demo prep:** `scripts/seed.ts`, deployed Supabase verification, README polish + screenshots + demo creds.
- **M11 submission:** demo video + captions + submission form + Discord post.

### Deliberately deferred (not blocking)

- Dual-role accounts (notes-for-future.md).
- Streak per-row coverage validation against `daily_session.attempted` (ADR 0024).
- "1 session = 1 calendar day" mapping in mastery intervals (ADR 0024) — multi-session days TBD.
- Queue 3 `error_rate_last_3_tests` proxy (active error-signature count ÷ 3) vs literal last-3-tests walk (ADR 0024).
- Drag-and-drop student reassignment (ADR 0027) — Move-to-group menu covers it.
- Teacher mushaf tab on drill-in (ADR 0027).
- Per-group code binding on invite codes (ADR 0028).
- `error_log` per-location prefetch — modal queries on open (ADR 0026).
- Mark-resolved button in error detail modal (ADR 0026).
- Rate-limit on `enroll_via_code` — 24h TTL + 32^8 search space deemed sufficient (ADR 0028).
- `mark_memorization` SQL fn in DB but unreachable, reserved for M7.5 Edit Memorization.

### Latest ADRs (most recent first)

- **0028** — Invite-code direction flipped. Teacher mints; student joins. New `teacher_invite_code` table, `student_code` dropped, `enroll_via_code` semantics reversed. Classroom tab on student side.
- **0027** — Teacher Students directory layout (groups as folders + Ungrouped). Inline group CRUD; no `/groups` route. Drill-in reuses M7 cards.
- **0026** — Error detail modal implementation (closes ADR 0023).
- **0025** — `/timeline` renamed to `/progress`; three reusable cards accepting `studentId?`.
- **0024** — M5 algorithm completion: mastery at 5 consecutive clean strong-pass revisions; fail resets stage to 1 only; Queue 3 priority formula minus mutashabihat.
- **0023** — Error detail modal design (implemented by 0026).
- **0022** — Test recap route + persisted `test.summary jsonb`.
- **0021** — Tests landing shows recent history (sparkline + last 15).
- **0020** — Today's session frozen in `daily_session`.
- **0019** — Overlay computation client-side from cached `error_location_stats`.

---

## Phase A — Foundation finish + skeleton ✅ Complete (2026-05-18)

`_authed` layout, role-aware sidebar, every stub route renders an EmptyState. ADR 0005.

---

## Phase B — Onboarding + Today skeleton ✅ Complete (2026-05-18)

Real onboarding flow, server bulk-write via `commit_onboarding`, Today's streak + juz progress + empty slot cards. ADRs 0006–0010.

---

## Phase C — Mushaf reader + tracker + Queue 1 + direction ✅ Complete (2026-05-18)

**What shipped:**
- `<MushafPage />` — lazy per-page JSON + per-page font + RTL + delegated word/verse tap handlers. Overlay props plumbed (stubbed to `'none'` until Phase D supplies real data).
- My Mushaf route — reader-first, sticky `PageDetailsPanel`, SegmentedControl toggle to a collapsible juz Tracker, prev/next/jump toolbar, last-page persistence in `localStorage`.
- `next_new_lesson(uuid)` RPC + Today's `NewLessonCard` wired to it.
- `hifz_direction` column + onboarding picker + direction-aware Queue 1.
- ADR 0015 course-correction: marking UI removed because hifz status must be test-earned.

**ADRs:** 0013, 0014, 0015 (effectively reverses 0012).
**Migrations:** 0014 (mark_memorization + next_new_lesson), 0015 (hifz direction + direction-aware functions).

---

## Phase D — Tests + errors end-to-end (M4) ✅ Complete (2026-05-19)

This was the differentiator phase. Status changes happen *here* — the post-test pipeline is what moves pages through `in_progress → memorized → mastered`. The live test view is also where the wrong-verse error overlay (the headline feature) lives.

**Scope:**

11. **Test creation flow** — pick test type (`newly_memorized` | `revision`) + range. Shared between enrolled-teacher and student-initiated guest paths (ADR 0004). Constraints per DESIGN.md §8.3.
12. **Live test view** — two-pane: `<MushafPage>` on the left (with overlay modes wired), test metadata + error log on the right. Tap a word → `ErrorLogModal` (8 error types per DESIGN.md §9.2 + severity + optional note).
13. **Wrong-verse + QF Search inline** — when error type is `wrong_verse`, the modal shows a QF Search field to find the intended ayah. Differentiator.
14. **Post-test pipeline** — transactional update of `ayah_review_state`, `error_location_stats`, `memorization_page` (DESIGN.md §13). Returns `{new, recurring, cleared}` summary. Service-role write via Express + SQL function (same shape as `commit_onboarding`).
15. **Post-test summary screen** (DESIGN.md §14.6) + RLS for student-initiated guest tests.
16. **Tests sidebar pages** — student history + Begin-test CTA (trust nudge per ADR 0004); teacher flat overview.
17. **Overlay computation** — `getOverlayMarkers(pageNumber, stats, mode)` + `getErrorsAtLocation(...)` per ADR 0011. Wire to MushafPage's `overlays` + `overlayMode` props.

**Demoable:** start a test → log errors live → submit → see summary → see tomorrow's plan shift (NewLessonCard recomputes after the pipeline updates `memorization_page`).

**Likely ADRs:**
- Post-test pipeline transaction shape (one SQL fn or several).
- Overlay computation site — client-side from already-fetched `error_location_stats`, or a dedicated RPC.
- Wrong-verse modal: QF Search proxy through Express (already mounted at `/api/qf/search`) — confirm the response shape sketched in `apps/server/src/routes/qf.ts` is what the modal needs.

**Touches:**
- New: `apps/server/src/routes/tests.ts` + `apps/server/src/pipelines/post-test/` (the transactional writer).
- New: migration `0016_post_test_pipeline` — the SQL function(s).
- New: `apps/web/src/features/live-test/` (per CLAUDE.md shorthand: "live test screen").
- Update: `_authed.tests.tsx` — replace EmptyState with the history + Begin-test view.
- Update: `MushafPage` — implement `simple` / `heatmap` / `colored` overlay modes against the new `ErrorOverlay[]` data.

---

## Phase E — Remaining milestones

- **M5 ✅ Complete (2026-05-19)** — frozen `daily_session` + simple revision shipped earlier (ADR 0020). M5 algorithm closure landed via migration `0020_m5_algorithm.sql` (ADR 0024): full Queue 2 stage machine + Queue 3 priority formula in `_compute_session_plan`; per-ayah `consecutive_clean_tests` rollup, fail-stage-reset, and `memorized → mastered` promotion in `submit_test`. Streak coverage check against `daily_session.attempted` deliberately deferred — current streak rule unchanged.
- **M6 (core landed 2026-05-19; enrollment direction flipped same day, ADR 0028)** — Teacher Students route is a directory (groups as collapsible folders + Ungrouped). Inline group CRUD (no `/groups` route), Move-to-group menu. **Invite-code flow flipped**: teacher mints an 8-char Crockford code (`get_or_create_teacher_invite_code` / `rotate_teacher_invite_code`, 24h TTL, reusable), student joins via the new `/classroom` route (`enroll_via_code` now called by student). Drill-in `/students/$studentId` reuses M7's three cards via `studentId` prop + has a "Start test for this student" button wired to `TestCreationModal` in `enrolled_teacher` mode. Migration 0021. Servers `/api/tests/create` enrolled_teacher branch lit up (ADR 0027).
- **M7 (core landed 2026-05-19)** — Reframed from "Timeline" to forward-looking **Progress** dashboard (`/progress` replaces `/timeline`): ForecastCard (next juz + full Quran at configured pace), ActivityStatsCard (7d/30d — memorized / reviewed / tests + pass rate), RevisionHealthGrid (juz staleness). Each card accepts `studentId?` so M6 drill-in reuses them. ADR 0025. Error detail modal landed on mushaf overlay taps (ADRs 0023 → 0026). Mobile sweep + PWA still owed (Polish work).
- **M7.5** — Settings page (currently an EmptyState stub): daily capacity, completed-Quran flag, profile, hifz direction, **Edit Memorization** (reopens onboarding pre-populated — see `notes-for-future.md`). Note: per ADR 0028, invite codes are teacher-side — students join via `/classroom`, not Settings. DESIGN.md §19.
- **M8** — QF User APIs (Bookmarks + Goals OAuth flow). Adds the "Connect Quran.com" button inside the M7.5 Settings page.
- **M9** — Mutashabihat (conditional).
- **M10** — Seed data + demo prep.
- **M11** — Video + submission.

---

## Cut order if time gets tight

1. M9 (mutashabihat — explicitly conditional).
2. M8 beyond minimum (one QF User API endpoint is enough to claim "Content + User integrated").
3. Goals page (skeleton only).
4. Timeline polish (basic list is enough).

**Never cut Phase D** — the live test flow is what wins the Impact (30 pts) criterion.

---

## Read these before resuming work

1. **This file's "Where we are"** — the snapshot above.
2. **`CHANGELOG.md` `[Unreleased]`** — the running diff list.
3. **`notes-for-future.md`** — what's been deferred (dual-role, Edit Memorization recalibrate flow).
4. **`decisions/`** — for Phase D, start with:
   - **0011** (error overlay merge at render time) — covers the marker computation Phase D needs.
   - **0004** (guest witnessed tests) — RLS + UX trust model for the test flow.
   - **0008** (server bulk-write via Express + SQL fn) — the pattern the post-test pipeline reuses.
   - **0013** (next_new_lesson RPC) — what the pipeline must update so the next plan recomputes correctly.
   - **0015** (status is test-driven) — the philosophy the pipeline enforces.
5. **`DESIGN.md`** — §7 (algorithm), §8 (test rules), §9 (error model + §9.7 overlay rules), §10.3-10.4 (mushaf + overlay modes), §13 (post-test pipeline — the spec), §14.5 (live test screen), §14.6 (post-test summary).
6. **`DESIGN-SYSTEM.md`** — color tokens, type scale, error-type palette (§15.1), heatmap ramp (§15.2).
7. **Per-directory `CLAUDE.md` files** — root has the navigation table; each code dir has a tabular index. `apps/web/src/mushaf/` is the most-touched dir for Phase D.

---

## Open questions for next session (none blocking)

- Post-test pipeline: one fat SQL function (mirrors `commit_onboarding`) vs. several smaller ones called by an Express orchestrator? Lean toward the former for atomicity.
- Overlay rendering performance: 604 pages × N errors — should marker computation cache by page, or recompute on each `<MushafPage>` mount? Probably fine to recompute given how small per-page data is.
- QF Search response shape: confirm what `apps/server/src/routes/qf.ts`'s `/search` proxy returns matches what the wrong-verse modal needs (DESIGN.md §11.1).
