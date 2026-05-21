# 0037 — Any Pass Advances + Revision Queue Fallback

**Date:** 2026-05-20
**Status:** Superseded by 0048 (rating collapse absorbed "any pass advances") and 0050 (Q2b tier deleted; never-tested case folded into unified scoring)
**Milestone:** M5

## Context

Two bugs surfaced during live use:

1. **New-lesson slot stuck on the same page.** A student would strong_pass page X on a `newly_memorized` test and then see page X again on the next session. Root cause: `submit_test` promoted via `UPDATE memorization_page SET status='memorized' WHERE status='in_progress'`. Onboarding only seeds one such row (the `inProgress` page). Any page reached later by Queue 1's frontier walk has no `memorization_page` row at all, so the UPDATE matched zero rows and the page was never promoted. `_compute_session_plan` then returned the same page again.

2. **Revision queue empty for onboarded students.** A student who marked many juz memorized during onboarding saw "No revision yet." Root cause: Queue 2 in `_compute_session_plan` requires `ars.recent_stage IS NOT NULL AND ars.ready_at <= now()`, and Queue 3 requires `bool_and(ars.graduated_at IS NOT NULL)`. `commit_onboarding` inserts `ayah_review_state` rows with `recent_stage=NULL` and `graduated_at=NULL` (the stage machine only engages on a `newly_memorized + strong_pass` test, per ADR 0024). Onboarded pages were stranded between the two queues.

Separately, the product framing for sessions shifted (during this discussion): "sessions are not capped to one per day; people can do four in one day or one every two days." Combined with bug (1), this surfaced a philosophical question — should only `strong_pass` advance the new-lesson slot, or any pass?

## Decision

**Any pass advances** (`strong_pass` / `excellent` / `good` / `pass_needs_practice`). Only `needs_work` and `fail` leave the page as `in_progress`. The Queue 2 stage machine also engages on any pass — ayahs go to `recent_stage = 1` and `ready_at = now + 1 day` so the page enters the revision pipeline regardless of how strong the first pass was. Reverses ADR 0024 on the "only `strong_pass` promotes" specific point; the rest of ADR 0024 (mastery rule, fail behavior, Queue 2/3 ordering) is unchanged.

**Page promotion is now an UPSERT.** Insert a `memorization_page` row with `status='memorized'` if absent; update existing rows in the same statement; never downgrade a `mastered` page back to `memorized`.

**Queue 2b — revision-queue fallback.** New tier in `_compute_session_plan` between Queue 2 and Queue 3. Picks memorized pages that have no `memorization_verse` row joined to any `ayah_review_state` with `recent_stage IS NOT NULL OR graduated_at IS NOT NULL`. In practice this catches every onboarding-memorized page (no `memorization_verse` rows at all, since `commit_onboarding` only writes `memorization_verse` for the `inProgress` page) plus any tested page that lacks `memorization_verse`. Ordered by `page_number asc` — a stable, predictable default for "I have no test history; where do I start?"

Final ordering: **Queue 2 (active stages, due now) → Queue 2b (never tested) → Queue 3 (graduated, weighted priority)**. Q2b before Q3 because a never-tested memorized page is more likely to have decayed than a long-graduated one.

## Consequences

- ✅ Fixes the "new-lesson slot stuck on page X after a pass" loop. Any pass now produces a `memorization_page` row with `status='memorized'`; Queue 1's frontier walk skips it.
- ✅ Fixes the "no revision yet" empty state for onboarded students. Queue 2b catches them.
- ✅ Matches the new product framing — sessions aren't capped per day; clicking "Load next session" now genuinely advances the new-lesson slot.
- ⚠️ Reverses ADR 0024's "only strong_pass promotes" rule. The "strict philosophy" of test-driven advancement (ADR 0015) is preserved — status still only changes via the post-test pipeline — but the bar is now "any pass," not "strong_pass only."
- ⚠️ Pages promoted via Queue 2b are revised at flat `page_number` priority rather than the stage-machine cadence. This is acceptable because they have no `memorization_verse` rows to join through — adding those would require either (a) an Express-side backfill that reads `quran-index.json` and inserts `memorization_verse` for memorized pages, or (b) a payload addition to `submit_test`. Deferred; Queue 2b is good enough until the stage machine becomes the bottleneck.
- ⚠️ A "good" first pass now gives the same stage-1 entry as a "strong" first pass. The pedagogical difference between the two ratings is no longer visible at the algorithm boundary — they only differ in error logging.

## Reverses

0024 (partial — only the "strong_pass-only promotion" point; the rest of 0024 stands)
