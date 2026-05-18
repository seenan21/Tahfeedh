# 0007 — Static quran-index.json for Onboarding Range Expansion

**Date:** 2026-05-18
**Status:** Implemented
**Milestone:** M3

## Context
Onboarding's juz/surah picker and Today's juz-progress bar both need deterministic lookups: juz → pages, surah → pages, ayah → page. `metadata.json` (ADR 0002) carries surah `pages` and juz `verse_mapping`, but not a per-page boundary list or a per-ayah → page map. Computing these on-the-fly in the browser would require loading many of the 604 per-page JSONs during onboarding and recomputing on every Today render.

## Decision
The build pipeline (`scripts/build-quran-data.ts`) emits an additional `quran-index.json` alongside the per-page files and metadata. A faster, local-only rebuild script (`scripts/build-quran-index.ts`, exposed as `npm run build:quran-index`) reads the existing page JSONs to regenerate the index without re-fetching from api.quran.com — useful when only the index shape changes.

Both copies are written to `apps/web/src/data/quran-index.json` and `apps/server/src/data/quran-index.json` so the web and server can each import the artifact locally without crossing workspace boundaries. Shape (typed in `@tahfeedh/shared`):

- `pages[1..604]`: `{ surah_start, ayah_start, surah_end, ayah_end }`
- `surahs[1..114]`: `{ start_page, end_page, ayah_count, first_ayah_page_map: { [ayah]: page } }`
- `juzs[1..30]`: `{ pages: [start, end], ayah_ranges: { [surah]: [start, end] } }`

## Consequences
- ✅ Onboarding selection expansion (Express) and juz-progress (web) read a single small file.
- ✅ Stays in sync with metadata/pages because the same build emits all three.
- ✅ Independent fast rebuild via `build:quran-index` avoids 604 API calls when iterating on index shape.
- ⚠️ The artifact must be regenerated whenever the Madani layout source changes; the build script's docstring calls this out.
