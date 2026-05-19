# apps/server/src/memorization/

Pure expansion helpers for the `/api/memorization/mark` endpoint (ADR 0012). Same shape as `apps/server/src/onboarding/` — kept separate from the route so it's easy to unit-test.

## Index

| File | What | When to read |
|---|---|---|
| `pageAyahs.ts` | `expandPageAyahs(pageNumber, quranIndex)` returns every (surah, ayah) on a page using only the static `quran-index.json` (no per-page JSON load). `isAyahOnPage(...)` validates an ayah lies on the named page — used to sanity-check `in_progress` payloads | Touching how a page expands into its ayah set |
