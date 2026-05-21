# 0050 — Unified Revision Priority Scoring + Kind Tag

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M8

## Context

`_compute_session_plan` filled the revision bucket in three sequential passes: Queue 2 (active recent stages, due) → Queue 2b (memorized but never tested — ADR 0037 band-aid for onboarded students) → Queue 3 (graduated, weighted priority). Each tier filled the remaining capacity before falling through.

This produced two surprising behaviors:

1. **Never-tested onboarding-memorized pages outranked overdue graduated pages.** Q2b's "page_number asc" had no notion of age or error rate.
2. **A stage-2 recent page that was 5 days overdue would still appear *below* a stage-1 page tested today** — because Q2 sorted on `min(stage) asc` first, and stage 1 < stage 2.

The user's spec is more honest: every eligible revision page gets one priority score; the top N across the union wins. Recent and old compete on a unified axis.

## Decision

**One scoring formula, one UNION ALL, one ORDER BY.** Tier comes back as a tag for UI grouping, not as a sort key.

### Recent score (any ayah in stage 1 or 2, `ready_at <= now()`)
```
score = 60 − (stage − 1) × 25 + sessions_overdue × 15
```

- Stage 1 fresh (ready today): **60** — top of the queue, hard to beat.
- Stage 2 fresh: **35** — high but a meaningfully overdue old page can edge past.
- Stage 2, 1 day overdue: **50**.
- Stage 2, 2 days overdue: **65** — outranks even a fresh stage-1 page. Deferring a recent revision climbs steeply, which is the algorithm's promise that recency-loss has real cost.

### Old score (every ayah on the page graduated, OR never tested yet)
DESIGN.md §7.2 formula, minus mutashabihat penalty (deferred to M9):

```
score =   days_since_review × 1.0
        + (active_error_count / 3.0) × 20.0
        − min(consecutive_clean_tests, 5) / 5 × 3.0
        + juz_cohesion_bonus            (1.0 if any ±2-page neighbor reviewed in last 3 days)
        + max(0, days_since_review − 60) × 10.0
```

Typical scores sit in 10–40, climb past 100 when truly overdue, and reach 200+ for chronically neglected pages. The asymmetry guarantees DESIGN.md §3.3's "the queue ends" promise — a forgotten page can outrank a fresh stage-1 page once it's overdue enough.

### Never-tested-yet pages (the former Q2b case)
**Folded into the old-revision pool with natural defaults.** Onboarding backdates `last_reviewed_at` by 30 days, so a never-tested onboarded page scores ~30 the first day after onboarding. As it ages past 60 days unseen, the `+(days − 60) × 10` term lifts it naturally. No special-case score, no Q2b tier.

### UI sub-headers (no rigid sub-caps)
`_compute_session_plan` returns a parallel `revision_kinds text[]` column. `daily_session.revision_kinds` persists the kind for each page so `today_session` / `load_next_session` thread it into the JSONB row output as `kind: 'recent' | 'older'`.

`SessionPlanCard` groups consecutive same-kind runs under "Recent" / "Older" headers without resorting. If all rows are one kind, the headers don't render (flat list). A recent page scoring above older pages stays at top; the headers just label the natural boundaries the score ordering produced.

## Consequences

- ✅ Single source of truth for revision ordering. No sequential fallback tiers; no order-of-evaluation surprises.
- ✅ Q2b deleted. The "memorized but never tested" case is no longer a special path — it's just an old-revision pool member with default-shaped state.
- ✅ The "two days overdue stage-2 beats fresh stage-1" behavior is now structural, not a happy accident. Verifiable by a unit-test that asserts `score(stage=2, overdue=2) > score(stage=1, overdue=0)`.
- ✅ UI sub-headers are legible without imposing artificial sub-caps. Fresh memorizers see mostly "Recent"; long-time huffaz see mostly "Older."
- ⚠️ Pre-existing `daily_session` rows have `revision_kinds = '{}'` (default empty). The reader falls back to `'older'` per row. New rows after migration populate kinds correctly.
- ⚠️ The score formula is tunable but **not tuned**. Weights are DESIGN.md §7.2 starting guesses plus the user's recent-score coefficients (60 / 25 / 15). Real-world tuning is a post-MVP exercise.
- ⚠️ Never-tested-pages relying on the 30-day-backdate onboarding trick is fragile. If `commit_onboarding` ever stops backdating, those pages would score 0 and never surface until aged past 60 days. The backdate is documented in `0013_session_size_and_onboarding_writes.sql` and in DESIGN.md §6.3.

## Reverses

ADR 0024 (Q2 + Q3 sequential fill), ADR 0037 (Q2b fallback tier — the case it solved is absorbed into the old-revision pool).
