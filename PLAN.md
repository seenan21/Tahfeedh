# Tahfeedh — Build Plan

> Short anchor for when context is cleared. Full milestone detail lives in DESIGN.md §19; design decisions live in `decisions/`.

**Deadline:** 2026-05-20 (Quran Foundation Hackathon).

---

## Where we are

- **M1 (Foundation):** done — monorepo, Vite+Mantine, Express, Supabase project, env wiring. Migrations 0001–0012 applied (10 baseline + 0011 ADR-0004 schema delta + 0012 `onboarding_complete`). Auth (signup with role, login, sign-out) wired.
- **Phase A:** done — `_authed` layout route gates on auth + onboarding, AppShell with role-aware sidebar, stub routes for all sidebar items, onboarding stub flips the gate.
- **M2 (Mushaf), data half:** done — 604 per-page JSON files, metadata.json, 604 page-scoped QPC V2 fonts auto-loaded via generated CSS, deploy wiring (`npm run build:web`).
- **M2 (Mushaf), components half:** not started — no `<MushafPage />`, no grid view yet.
- **Design surface:** stable. Latest ADRs: 0002 (data source: api.quran.com v4), 0003 (per-page fonts), 0004 (guest-witnessed tests), 0005 (`_authed` layout route).

---

## Phase A — Foundation finish + skeleton

Closes the M1 leftovers and gets a clickable shell on screen.

1. Write & run **migrations 1–8** (all tables, all enums incl. new `test_mode`, all helper functions, RLS).
2. **Supabase auth** — signup (with role selector), login, session bootstrap, sign-out.
3. **Protected routes** — unauth → `/login`; auth + `onboarding_complete=false` → `/onboarding`.
4. **AppShell with role-aware sidebar + stub routes** for every nav item.
   - Student: Today / Tests / Timeline / My Mushaf / Goals / Settings
   - Teacher: Students / Groups / Tests / Settings

**Demoable:** sign up → log in → click through every sidebar item without 404s.

---

## Phase B — Onboarding + Today skeleton (M3 first half)

5. **Onboarding** — Step 1 (path), Step 2 (juz/surah mode), Step 3 (session size). Bulk-write memorization rows on finish.
6. **Today view skeleton** — streak (Western numerals), juz-progress (Arabic-Indic), empty new-lesson + review slots.

**Demoable:** fresh signup → onboarding → Today shows the right placeholders.

---

## Phase C — Mushaf renderer + memorization marking (M2 components + M3 second half)

7. **`<MushafPage />`** — dynamic-imports `pages/{N}.json`, applies `font-family: 'QPC V2 P{N}'`, RTL container, word+verse tap handlers, three overlay modes (stub data).
8. **My Mushaf grid** — 604-page grid colored by `memorization_page` status.
9. **Memorization marking** — tap a grid page → mark memorized/in-progress; partial-page writes `memorization_verse`.
10. **Algorithm Queue 1** — next-unmemorized-page; Today shows a real new-lesson row.

**Demoable:** mark pages → grid fills → Today recomputes → drill into any page's mushaf.

---

## Phase D — Tests + errors end-to-end (M4)

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

1. `DESIGN.md` table of contents + §19 milestone plan
2. `decisions/` — at least 0002, 0003, 0004 (the divergences from DESIGN.md)
3. `DESIGN-SYSTEM.md` — color tokens, type scale, component recipes
4. This file's "Where we are" section
