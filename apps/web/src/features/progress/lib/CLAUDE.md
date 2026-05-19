## Files

| File | What | When to read |
|---|---|---|
| `forecast.ts` | `computeForecast({memorizedPageNumbers, pagesPerSessionNew, hifzDirection, quranIndex})` returns next-juz and full-Quran completion dates + pages-left counters. Direction-aware (`forward` walks 1→604, `backward` walks 604→1). Returns `hasCompletedHifz=true` flag when every page is memorized | Tweaking forecast math, the pace assumption, or completion-target selection |
| `activityStats.ts` | `summarize()` adds a pass-rate field over raw counts; `cutoffIso()` converts a `'7d'`/`'30d'` window into an ISO timestamp the Supabase `.gte()` filter wants; `isPassingRating()` defines what counts as a passing rating (`strong_pass` ∪ `excellent`) | Tweaking the activity-stats summarization, the passing-rating set, or the window definitions |
| `revisionHealth.ts` | `computeRevisionHealth({ayahReviewRows, memorizedPageRows, quranIndex})` returns 30 `JuzRevisionHealth` rows. Exports `BAND_COLOR` (Mantine var bg/fg per band) and `BAND_LABEL` for the legend. Bands: fresh (<7d), aging (7–14d), stale (14–30d), overdue (30d+), never (memorized but no review state), untouched | Adjusting band thresholds, the staleness algorithm, or the legend colors |
