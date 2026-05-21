# 0054 — Onboarding Populates `memorization_verse` for Memorized Pages

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M9

## Context

A onboarded student (Yusuf Bashir) with 84 memorized pages saw an empty
revision queue on `/today`: "No revision yet — Revision pages will appear
once you have memorized pages with review history." His
`memorization_page` rows existed and his `ayah_review_state` rows had been
populated by past tests, yet the queue was empty.

Root cause: the 0029 algorithm rewrite (ADR 0050) replaced the layered
Q2 → Q2b → Q3 revision queue with a unified score that JOINs through
`memorization_verse`:

```
memorization_page  ⨝  memorization_verse  ⨝  ayah_review_state
```

But `commit_onboarding` only ever wrote `memorization_verse` rows for the
`inProgress` page (migration 0013). Fully-memorized pages had no bridge
rows, so the JOIN excluded them. The post-test pipeline (ADR 0038 /
migration 0026) does UPSERT `memorization_verse` per tested page, but
onboarding-memorized pages that have never been tested are invisible to
the queue until a test happens to fill them in.

Two related quirks surfaced during the fix:

1. **`quran-index.json` had broken page entries.** 14 pages (121, 122, 532,
   533, 584, 585, 592–599) had `ayah_start > ayah_end` with
   `surah_start === surah_end`. Cause: a verse like 79:16 can span two
   pages, and the page-JSON ordering placed its tail-words after the next
   ayahs, so `build-quran-index.ts`'s "first word, last word" logic picked
   wrong boundaries. `expandPageAyahs` produced an empty range for those
   pages, leaving 10 of yusuf's memorized pages out of the backfill on
   first pass.

2. **`today_session` is sticky for the day.** A pre-backfill `daily_session`
   row froze the empty revision queue even after the data was fixed. Per
   ADR 0020 the function is read-then-insert, so re-derivation requires
   deleting the row (or hitting "Load next session").

## Decision

**A. Onboarding emits per-ayah triples.**

- `apps/server/src/onboarding/expand.ts` — `CommitOnboardingPayload` gains
  a `memorizedVerses: Array<{surah, ayah, page}>` field. For every page in
  `memorizedPages`, the expander calls `expandPageAyahs` (already in
  `apps/server/src/memorization/pageAyahs.ts`) and emits the triples. The
  `inProgress` block keeps its own `verses` payload — unchanged.
- **Migration 0031** — `commit_onboarding` now bulk-inserts those triples
  into `memorization_verse` with `ON CONFLICT DO NOTHING`. Edit-
  Memorization (ADR 0039) keeps its idempotency because re-running over
  the same student is a no-op.

**B. `quran-index.json` rewritten for the 14 broken pages.** Boundaries
recomputed by taking `min(surah, ayah)` and `max(surah, ayah)` over all
`char_type === 'word'` words on the page (instead of `first/last` in
JSON order). Both `apps/web/src/data/quran-index.json` and
`apps/server/src/data/quran-index.json` are rewritten. The build script
(`scripts/build-quran-index.ts`) is **not** updated in this ADR — the
hand-patched values match what the script would produce if it switched
to min/max, and a longer-term build-script fix can land separately.

**C. Backfill for yusuf.** A one-shot SQL using `unnest(int[], int[], int[])`
of 1,263 (surah, ayah, page) triples — first 1,002 from `expandPageAyahs`
(post-index-fix), then 261 from per-page JSON for the 14 affected pages
— `INSERT … ON CONFLICT DO NOTHING` into `memorization_verse`. After the
backfill: `(select count(distinct page_number) from memorization_verse
where student_id = yusuf) = 84` (matching his 84 memorized pages).
Deleting his stale `daily_session` row for `current_date` let
`today_session` recompute; he now sees 5 revision pages on `/today`.

## Consequences
- ✅ Onboarded students get a non-empty revision queue on day one —
  matches the spirit of ADRs 0037 / 0050 (the algorithm should never
  punish "you memorized this but never tested it" by hiding the page).
- ✅ `commit_onboarding` is still idempotent (ON CONFLICT DO NOTHING) —
  Edit-Memorization re-entries are safe.
- ✅ 14 mushaf pages now have correct boundary metadata; downstream
  consumers (`expandPageAyahs`, `surahsInJuz`, range expansion in
  `resolveTestRanges`) start producing correct results for those pages.
- ⚠️ `scripts/build-quran-index.ts` still uses the `first/last in JSON
  order` heuristic. Re-running it would re-introduce the same 14 broken
  entries. A separate change should switch the script to min/max ordering
  (or a stable per-ayah scan).
- ⚠️ Existing onboarded students (besides yusuf) may have the same gap.
  The pattern in §C applies to any student with `memorization_page rows
  where status='memorized' AND not exists (matching memorization_verse
  rows)`. No automatic mass-backfill ran — fixed per-student as the
  issue surfaces.

## Reverses
Extends ADR 0008 (onboarding bulk write), ADR 0050 (unified revision
queue), and ADR 0038 (memorization_verse UPSERT in submit_test). Does
not supersede any prior ADR.
