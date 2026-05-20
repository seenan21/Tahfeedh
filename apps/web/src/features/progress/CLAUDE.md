# apps/web/src/features/progress/

Forward-looking student dashboard (M7, ADR 0025). Three reusable cards plus their pure helper modules. Every component accepts a `studentId?: string` prop so the teacher drill-in (`_authed.students.$studentId.tsx`) renders the same surfaces for any of its students without re-implementing.

## Index

| File | What | When to read |
|---|---|---|
| `ForecastCard.tsx` | Configured-pace projection. Reads `student_settings.pages_per_session_new` + `hifz_direction` + `memorization_page`, calls `computeForecast()`, renders next-juz date + full-Quran date with pages-left + days-away counts. Hifz-complete renders a celebration state. `isOwnView?: boolean` (default true) swaps the bottom hint between "Adjust in Settings" and "Only the student can change this" for teacher viewers (ADR 0032) | Tweaking the forecast UX, the pace assumption, or what completion targets are shown |
| `ActivityStatsCard.tsx` | 7d/30d `SegmentedControl` toggle + three metric rows (pages memorized, distinct pages reviewed, tests + pass rate). Each metric fires its own Supabase query keyed by `[metric, studentId, window]` so window flips refetch cleanly. `viewerTeacherId?: string` filters the tests query to `teacher_id = viewerTeacherId` and relabels the row to "Tests taken with you" (ADR 0032) | Tweaking the stats list, adding a metric, or changing the windowing toggle |
| `RevisionHealthGrid.tsx` | 30 juz cells colored by the stalest ayah's `last_reviewed_at` among memorized pages in each juz. Five bands (fresh/aging/stale/overdue/never) plus untouched. Tooltip per cell shows the band + memorized-pages count + relative staleness | Tweaking the staleness visualization or band thresholds |

## Subdirectories

| Directory | What | When to read |
|---|---|---|
| `lib/` | Pure helper modules (no React, no Supabase) consumed by the three cards | Adjusting forecast math, staleness band thresholds, or activity-stats summarization |
