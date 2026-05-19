# Tahfeedh — Build Plan

> Short anchor for when context is cleared. Full milestone detail lives in DESIGN.md §19; design decisions live in `decisions/`.

**Deadline:** 2026-05-20 (Quran Foundation Hackathon).

---

## Where we are (snapshot — 2026-05-19, Phase D shipping)

### Shipped

- **M1 (Foundation):** monorepo, Vite+Mantine, Express, Supabase project, env wiring. Auth (signup with role, login, sign-out) wired.
- **Phase A:** `_authed` layout route gates on auth + onboarding, AppShell with role-aware sidebar, stub routes for every sidebar item, onboarding stub flipped the gate (ADR 0005).
- **Phase B:** real 3-step onboarding (juz grid + searchable surah list + partial-page picker + half-page session sizes), `POST /api/onboarding/finish` + `commit_onboarding` SQL fn, derived `quran-index.json` artifact, Today skeleton (streak + 30-cell juz progress + empty slots), full visual polish pass (SilkBackground on auth, glassy header with user menu, gradient sidebar, bilingual EmptyState on every stub route). Migrations 0011–0013.
- **Phase C:** ✅ My Mushaf is **reader-first** (no Drawer, no marking UI). Reader-mode is the default; SegmentedControl toggles to "Tracker" (collapsible juz accordion with per-juz stacked progress bar). Toolbar: prev / next / jump-to-page. Inline `PageDetailsPanel` shows status, memorized/mastered timestamps, review freshness from `ayah_review_state`, and Phase-D placeholders for errors + recent tests. Today's `NewLessonCard` calls `next_new_lesson` RPC and respects each student's hifz direction. Migrations 0014 + 0015 applied.
- **Hifz direction (ADR 0014):** `hifz_direction` ('forward' Baqarah-first / 'backward' Juz-Amma-first) on `student_settings`; captured by a bilingual picker in onboarding Step 1; honored by `next_new_lesson`.
- **Test-driven status (ADR 0015):** the manual marking UI was removed. Post-onboarding, `memorization_page.status` only moves via the Phase D post-test pipeline. The `mark_memorization` SQL fn remains in the DB unreachable, reserved for the post-M8 Edit Memorization Settings flow — restore plan in `notes-for-future.md`.
- **Deploy surface (Railway):** healthy — `@tahfeedh/shared` builds to `dist/`, root scripts enforce shared → server → web order, Node engine pinned to 22 (`.nvmrc` + `engines.node` for WebSocket-realtime). Build command: `npm install --include=dev && npm run build:server`; `NIXPACKS_NODE_VERSION=22` in env.
- **Doc surface:** DESIGN.md + DESIGN-SYSTEM.md patched to reflect shipped state; `CLAUDE.md` index in every code subdir.

### Live database

- Migrations 0001 → 0015 all applied to remote.
- Tables (all RLS-enabled, per 0008): `app_user`, `student_settings`, `student_code`, `student_group`, `enrollment`, `memorization_page`, `memorization_verse`, `ayah_review_state`, `test`, `error_log`, `error_location_stats`, `goal`, `qf_user_token`.
- Functions (SECURITY DEFINER, `search_path=public`):
  - `is_my_student(uuid)` — granted `authenticated`
  - `enroll_via_code(text)` — granted `authenticated`
  - `current_session_number(uuid)`, `session_status_today(uuid, date)`, `daily_streak(uuid)` — helpers
  - `commit_onboarding(uuid, jsonb)` — service_role only (ADR 0008); accepts `hifzDirection` (ADR 0014)
  - `mark_memorization(uuid, jsonb)` — service_role only; **reserved**, no caller (ADR 0015)
  - `next_new_lesson(uuid)` — granted `authenticated`; direction-aware (ADRs 0013, 0014)

### Live Express endpoints

- `GET /health`
- `GET /api/qf/chapters`, `GET /api/qf/search` (QF Content API proxy)
- `POST /api/onboarding/finish` (ADR 0008)
- **No** `/api/memorization/*` — removed in ADR 0015.

### Phase D — in progress (2026-05-19)

Shipped today:
- **Migration 0016 applied** — `submit_test(uuid, jsonb)` SECURITY DEFINER fn. Closes test, touches `ayah_review_state`, upserts `error_location_stats`, decays stale stats (cleared at counter ≥ 3), promotes pages on `strong_pass`+`newly_memorized`, returns `{new, recurring, cleared}` summary.
- **`/api/tests/*` endpoints** — `create`, `:id/error` (streaming inserts), `:id/finish` (calls submit_test RPC after Express resolves ranges).
- **Live test feature** at `/_authed/tests/$testId` — two-pane (MushafPage + ErrorLogPane), per-tap `ErrorLogModal` with inline QF Search for `wrong_verse`, post-test summary modal.
- **Overlay computation** in `apps/web/src/mushaf/getOverlayMarkers.ts` — 3 modes (simple/heatmap/colored) wired through `MushafPage.overlays` prop.
- **PageDetailsPanel** now reads real error stats + recent tests (was Phase-D placeholders).
- **Mushaf rendering bug fixed** — words now read right-to-left (ADR 0016).

Still open (deferred from initial Phase D plan):
- Full Tests history list — cut per scope decision; current Tests route shows Begin CTA + most-recent link only.
- Mastery promotion (`memorized → mastered`), fail-downgrade, recent-revision stage machine — all M5.

### Latest ADRs (most relevant first for resuming)

- **0019** — Overlay computation client-side from cached `error_location_stats`.
- **0018** — Streaming error inserts (per-tap POST, not batched at finish).
- **0017** — Post-test pipeline as one SECURITY DEFINER SQL function.
- **0016** — Mushaf line layout fix: `direction: rtl` + justified flex (no `row-reverse`).
- **0015** — Memorization status is test-driven (no manual marking post-onboarding). Reverses 0012.
- **0014** — Hifz direction preference (forward/backward).
- **0013** — `next_new_lesson` Postgres RPC for Queue 1.
- **0011** — Error overlay merge at render time.
- **0010** — Modernized shell visuals.

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

## Phase D — Tests + errors end-to-end (M4) ⬅️ **IN PROGRESS**

This is the differentiator phase. Status changes happen *here* — the post-test pipeline is what moves pages through `in_progress → memorized → mastered`. The live test view is also where the wrong-verse error overlay (the headline feature) lives.

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

- **M5** — Algorithm full (Queues 2 + 3, session completion, streak ticks; revision bucket math per §7.3). **Includes the Today's-session machine** — a frozen `daily_session` row per (student, date) with new-lesson + revision rows, attempted-checkmarks, and a "Load next session" CTA. Fixes the current Phase D regression where `NewLessonCard` falsely shows "every page is in your mushaf" after a single page is promoted. See `notes-for-future.md` → "Today's Session machine (M5)" for the full breakdown.
- **M6** — Teacher dashboard + groups + invite codes.
- **M7** — Timeline view, error detail modal, **Edit Memorization** (the deferred Settings flow — see `notes-for-future.md`), mobile sweep, PWA.
- **M8** — QF User APIs (Bookmarks + Goals OAuth flow).
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
