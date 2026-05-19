# apps/web/src/today/

Today-view-specific components mounted by `_authed.today.tsx`.

## Index

| File | What | When to read |
|---|---|---|
| `StreakBadge.tsx` | Calls `daily_streak()` RPC. Gradient flame pill when lit; neutral when 0 | Touching streak presentation |
| `JuzProgressBar.tsx` | Reads `memorization_page` rows, derives per-juz status, renders the 30-cell colored grid + legend (DESIGN.md §14.4, ADR 0010) | Touching the juz-progress visualization |
| `EmptySlotCard.tsx` | Inner-card placeholder with colored icon halo (sage / honey) + badge chip. Used by `SessionPlanCard` for the "hifz complete" and "no revision yet" empty states | Tweaking the placeholder row |
| `SessionPlanCard.tsx` | Whole Today plan card (M5, ADR 0020) — calls `today_session` RPC, renders new-lesson + revision rows via `PlanRow`, attempted counter, celebration + "Load next session" CTA via `load_next_session` mutation | Touching the Today plan card or session-machine surface |
| `PlanRow.tsx` | Reusable row used by `SessionPlanCard` for both new-lesson (sage halo) and revision (honey halo) rows. Shows "Attempted today" pill, strike-through, and dims when attempted | Tweaking row visuals or the attempted-state styling |
