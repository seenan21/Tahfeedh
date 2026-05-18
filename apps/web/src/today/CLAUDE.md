# apps/web/src/today/

Today-view-specific components mounted by `_authed.today.tsx`.

## Index

| File | What | When to read |
|---|---|---|
| `StreakBadge.tsx` | Calls `daily_streak()` RPC. Gradient flame pill when lit; neutral when 0 | Touching streak presentation |
| `JuzProgressBar.tsx` | Reads `memorization_page` rows, derives per-juz status, renders the 30-cell colored grid + legend (DESIGN.md §14.4, ADR 0010) | Touching the juz-progress visualization |
| `EmptySlotCard.tsx` | Inner-card placeholder with colored icon halo (sage / honey) + badge chip | Replacing one of the placeholder rows with a real plan row in Phase C / D |
