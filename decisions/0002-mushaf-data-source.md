# 0002 — Mushaf Data Source: api.quran.com v4 (Not QUL SQLite)

**Date:** 2026-05-18
**Status:** Implemented
**Milestone:** M2

## Context
DESIGN.md §10.2 specified pulling Madani 15-line layout from QUL SQLite (`mushaf-layout/10`, `quran-script/61`) via `better-sqlite3` at build time. In practice, every "Download sqlite" button on qul.tarteel.ai gates behind sign-in (`/users/sign_in`), and there is no public CDN for the SQLite exports.

The same canonical word-layout data (code_v2 glyph, line_number, position, verse_key) is exposed at `https://api.quran.com/api/v4/verses/by_page/{N}?words=true&word_fields=code_v2,line_number,position,location,char_type_name` with no auth — quran.com's database is populated from QUL upstream.

## Decision
Use `api.quran.com/api/v4` as the build-time data source. Output schema in `apps/web/src/data/pages/{N}.json` matches DESIGN.md §10.2 unchanged — only the upstream source differs.

## Consequences
- ✅ No QUL auth required; build runs in any CI without credentials.
- ✅ No `better-sqlite3` dependency (native module that's fiddly on Windows).
- ✅ Re-running `npm run build:quran-data` picks up upstream corrections.
- ⚠️ Build now depends on api.quran.com being reachable at deploy time.
- ⚠️ 604 sequential-ish HTTP requests on every deploy (~1 min at concurrency 10) vs. a one-time SQLite download.
- ⚠️ If we ever need a frozen snapshot (reproducible builds, offline-first PWA), revisit and switch to a vendored SQLite via authenticated QUL pull.

## Affects
DESIGN.md §10.2 — updated in the same change to remove the QUL/SQLite specifics.
