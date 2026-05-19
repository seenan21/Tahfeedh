# Tahfeedh — Build Plan

> Short anchor for when context is cleared. Full milestone detail lives in DESIGN.md §19; design decisions live in `decisions/`.

**Deadline:** 2026-05-20 (Quran Foundation Hackathon).

---

## Where we are

- **M1 (Foundation):** done — monorepo, Vite+Mantine, Express, Supabase project, env wiring. Migrations 0001–0013 applied. Auth (signup with role, login, sign-out) wired.
- **Phase A:** done — `_authed` layout route gates on auth + onboarding, AppShell with role-aware sidebar, stub routes for all sidebar items, onboarding stub flipped the gate.
- **Phase B:** done — half-page schema (0013) + `commit_onboarding` SQL fn, derived `quran-index.json` artifact, `POST /api/onboarding/finish` endpoint, real 3-step onboarding flow (juz grid + searchable surah list + partial-page picker + half-page session-size), Today skeleton (streak + juz-progress + empty slots), full visual polish pass (SilkBackground on auth, glassy header with user menu, gradient sidebar with CSS-module three-state styling, 30-cell juz progress grid, bilingual EmptyState on every stub route).
- **Doc surface:** done — DESIGN.md + DESIGN-SYSTEM.md patched to reflect shipped state; 25 navigation `CLAUDE.md` files across the project (root + every code subdir).
- **Deploy surface (Railway):** healthy — `@tahfeedh/shared` builds to `dist/` (root scripts enforce shared → server → web order), Node engine pinned to 22 (`.nvmrc` + `engines.node` for the WebSocket-realtime requirement). Railway build command is `npm install --include=dev && npm run build:server`; set `NIXPACKS_NODE_VERSION=22` in Railway env vars.
- **M2 (Mushaf), data half:** done — 604 per-page JSON files, metadata.json, derived quran-index.json, 604 page-scoped QPC V2 fonts auto-loaded via generated CSS, deploy wiring (`npm run build:web`).
- **M2 (Mushaf), components half:** done — `<MushafPage />` renderer (lazy per-page JSON + per-page font + RTL + delegated word/verse taps), reader-first My Mushaf route with inline `PageDetailsPanel`, collapsible juz tracker, prev/next/jump toolbar. ADR 0015 ripped out the manual marking UI in favor of test-driven status.
- **Phase C:** done (2026-05-18) — Mushaf reader + tracker + Queue 1 RPC + direction preference. ADRs 0013 (Queue 1 in Postgres), 0014 (hifz direction), 0015 (status is test-driven; supersedes 0012). Migrations 0014 + 0015 applied to the remote DB.
- **Design surface:** stable. Latest ADRs: 0008 (onboarding bulk-write), 0009 (SilkBackground entry-points only), 0010 (modernized shell), 0011 (error overlay merge at render time), 0012 (marking endpoint — superseded), 0013 (next_new_lesson RPC), 0014 (hifz direction preference), 0015 (status is test-driven).

---

## Phase A — Foundation finish + skeleton ✅ Complete (2026-05-18)

Closed the M1 leftovers and got a clickable shell on screen. Captured as ADR 0005 + migrations 0011/0012. See CHANGELOG `[Unreleased]` for the diff list.

1. Write & run **migrations 1–8** (all tables, all enums incl. new `test_mode`, all helper functions, RLS).
2. **Supabase auth** — signup (with role selector), login, session bootstrap, sign-out.
3. **Protected routes** — unauth → `/login`; auth + `onboarding_complete=false` → `/onboarding`.
4. **AppShell with role-aware sidebar + stub routes** for every nav item.
   - Student: Today / Tests / Timeline / My Mushaf / Goals / Settings
   - Teacher: Students / Groups / Tests / Settings

**Demoable:** sign up → log in → click through every sidebar item without 404s.

---

## Phase B — Onboarding + Today skeleton (M3 first half) ✅ Complete (2026-05-18)

Closed M3's first half. ADRs 0006–0009 captured. Migration 0013, `quran-index.json`, `POST /api/onboarding/finish`, full 3-step onboarding flow (juz grid + searchable surah list + partial-page picker + half-page support), Today skeleton (streak + juz-progress + empty slots), and the auth-page + sidebar + stub-route polish all shipped together. See CHANGELOG `[Unreleased]` for the diff list.

**Demoable:** fresh signup → SilkBackground on auth → onboarding 3 steps → Today shows real streak + juz progress in Arabic-Indic + bilingual empty cards; every sidebar item renders a polished bilingual EmptyState.

---

## Phase C — Mushaf renderer + memorization marking (M2 components + M3 second half) ✅ Complete (2026-05-18)

7. **`<MushafPage />`** — dynamic-imports `pages/{N}.json` via `apps/web/src/data/quran-data.ts` helpers, applies `font-family: 'QPC V2 P{N}'` (loaded by `quran-fonts.css`), RTL container, word+verse tap handlers, three overlay modes (memorization status / heatmap / error type) — overlay data stubbed for now (real data lands in Phase D).
8. **My Mushaf grid** — replace `_authed.mushaf.tsx` empty state with a 604-page grid colored by `memorization_page` status (sage.7 mastered, sage.4 memorized, honey.4 in-progress, white untouched — match `JuzProgressBar`). Tap a page → drill into `<MushafPage />`.
9. **Memorization marking** — tap a grid page → bottom-sheet/modal to mark memorized/in-progress; partial-page state writes `memorization_verse` rows. Reuse the SQL pattern from `commit_onboarding` (service-role write through Express endpoint, since `ayah_review_state` writes also need to fire for newly-memorized pages).
10. **Algorithm Queue 1** — next-unmemorized-page logic (DESIGN.md §7.2). Wire `_authed.today.tsx` new-lesson empty slot to a real query that finds the highest contiguous-memorized frontier and surfaces the next page.

**Demoable:** mark pages on the grid → grid fills in → Today recomputes the new-lesson row → drill into any page's mushaf with overlays.

**Touches:**
- New: `apps/web/src/components/MushafPage.tsx` (+ overlay components), `apps/web/src/mushaf/MushafGrid.tsx` (or under `apps/web/src/routes/_authed.mushaf.tsx`)
- New: `apps/server/src/routes/memorization.ts` + SQL function for marking endpoints (migration 0014)
- Update: `_authed.today.tsx` to render the real new-lesson card when frontier is found
- Likely ADR: marking endpoint shape + algorithm-queue-1 implementation choice (server-side derived view vs client-computed)

---

## Phase D — Tests + errors end-to-end (M4) ⬅️ **NEXT**

11. **Test creation flow** — pick type + range; shared between enrolled teacher and student-initiated guest path.
12. **Live test view** — MushafPage + error logging modal (8 types + severity + note).
13. **Wrong-verse + QF Search inline** — the differentiator feature.
14. **Post-test pipeline** — transactional update of `ayah_review_state`, `error_location_stats`, `memorization_page`; returns new/recurring/cleared summary.
15. **Post-test summary screen** + RLS for student-initiated guest tests.
16. **Tests sidebar pages** — student history + Begin-test CTA (with trust nudge per ADR 0004); teacher flat overview.

**Demoable:** start a test → log errors live → submit → see summary → see tomorrow's plan shift.

---

## Phase E — Remaining milestones

17. **M5** — Algorithm full (Queues 2 + 3, session completion, streak ticks).
18. **M6** — Teacher dashboard + groups + invite codes.
19. **M7** — Timeline view, error detail modal, Edit Memorization, mobile sweep, PWA.
20. **M8** — QF User APIs (Bookmarks + Goals OAuth flow).
21. **M9** — Mutashabihat (conditional).
22. **M10** — Seed data + demo prep.
23. **M11** — Video + submission.

---

## Cut order if time gets tight

In order of "drop first":

1. M9 (mutashabihat — explicitly conditional)
2. M8 beyond minimum (one QF User API endpoint is enough to claim "Content + User integrated")
3. Goals page (skeleton only)
4. Timeline polish (basic list is enough)

**Never cut Phase D** — the live test flow is what wins the Impact (30 pts) criterion.

---

## Read these before resuming work

1. This file's "Where we are" section
2. `CHANGELOG.md` `[Unreleased]` — the running diff list
3. `decisions/` — start with 0010 (current visual conventions), 0008 (server bulk-write pattern Phase C will reuse), then 0002/0003 (mushaf data) since Phase C touches MushafPage
4. `DESIGN.md` §7 (algorithm), §10 (mushaf rendering), §14.4 (Today view)
5. `DESIGN-SYSTEM.md` — color tokens, type scale, sidebar/empty-state recipes
6. Per-directory `CLAUDE.md` files (root has the navigation table; each code dir has a tabular index)
