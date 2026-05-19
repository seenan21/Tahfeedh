# apps/server/src/memorization/

Pure expansion helpers for page-level ayah math. The original `/api/memorization/mark` endpoint was removed in ADR 0015 (status is test-driven); these helpers are kept because the Phase D post-test pipeline and the future Edit-Memorization settings flow both need page → ayah expansion.

## Index

| File | What | When to read |
|---|---|---|
| `pageAyahs.ts` | `expandPageAyahs(pageNumber, quranIndex)` returns every (surah, ayah) on a page using only the static `quran-index.json` (no per-page JSON load). `isAyahOnPage(...)` validates an ayah lies on the named page — used to sanity-check `in_progress` payloads | Touching how a page expands into its ayah set |
