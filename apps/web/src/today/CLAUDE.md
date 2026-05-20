# apps/web/src/today/

Today-view-specific components mounted by `_authed.today.tsx`.

## Index

| File | What | When to read |
|---|---|---|
| `StreakBadge.tsx` | Calls `daily_streak()` RPC. Gradient flame pill when lit; neutral when 0 | Touching streak presentation |
| `JuzProgressBar.tsx` | Reads `memorization_page` rows, derives per-juz `{ status, pagesLeft }`, renders the 30-cell colored grid + legend + pages-left count under each incomplete cell (DESIGN.md §14.4, ADRs 0010 + 0032). Also mounted on the teacher drill-in | Touching the juz-progress visualization or the pages-left annotation |
| `EmptySlotCard.tsx` | Inner-card placeholder with colored icon halo (sage / honey) + badge chip. Used by `SessionPlanCard` for the "hifz complete" and "no revision yet" empty states | Tweaking the placeholder row |
| `SessionPlanCard.tsx` | Whole Today plan card (M5, ADR 0020) — calls `today_session` RPC, renders new-lesson + revision rows via `PlanRow`, attempted counter, celebration + "Load next session" CTA via `load_next_session` mutation. `readOnly?: boolean` (default false) hides the interactive footer; used by the teacher drill-in (ADR 0032) | Touching the Today plan card, the session-machine surface, or extending the read-only branch |
| `PlanRow.tsx` | Reusable row used by `SessionPlanCard` for both new-lesson (sage halo) and revision (honey halo) rows. Shows "Attempted today" pill, strike-through, and dims when attempted | Tweaking row visuals or the attempted-state styling |
