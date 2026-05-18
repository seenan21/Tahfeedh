# packages/shared/src/

## Index

| File | What | When to read |
|---|---|---|
| `index.ts` | Re-exports from types + schema | Importing from `@tahfeedh/shared` and trying to remember what's exported |
| `types.ts` | Enum mirrors (`UserRole`, `MemorizationStatus`, `TestType`, `ErrorType`, …), `TestRange`, `MushafPageData`, `QuranIndex` (PageIndexEntry / SurahIndexEntry / JuzIndexEntry), `QfChapter` | Adding a new domain type used on both sides of the wire |
| `schema.ts` | Zod schemas: `userRoleSchema`, `testRangeSchema`, `onboardingFinishSchema` (+ inferred `OnboardingFinishInput`) | Adding request validation for a new endpoint |
