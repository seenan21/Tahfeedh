# apps/server/src/pipelines/post-test/

Range resolution + payload assembly for the post-test pipeline. The actual transactional work happens in the `submit_test(uuid, jsonb)` SQL function (`supabase/migrations/0016_post_test_pipeline.sql`); this directory is the pre-RPC pure logic, mirroring `apps/server/src/onboarding/expand.ts`.

## Index

| File | What | When to read |
|---|---|---|
| `resolve.ts` | `resolveTestRanges(ranges, quranIndex): { coveredAyahs, coveredPages }` — expands `page`/`surah`/`ayah`/`juz` ranges; throws on `hizb`/`rub` (not supported in Phase D). Reuses `expandPageAyahs` from `apps/server/src/memorization/pageAyahs.ts` | Touching how a test's ranges become the JSONB payload, or adding a new range type |
