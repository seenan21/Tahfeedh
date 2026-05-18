# apps/server/src/onboarding/

Pure expansion logic for the `/api/onboarding/finish` endpoint (ADR 0008). Lives separately from the route so it can be unit-tested without an HTTP shell.

## Index

| File | What | When to read |
|---|---|---|
| `expand.ts` | `expandSelections(input, index)` — turns `OnboardingFinishInput` (juz / surah / inProgress) into `CommitOnboardingPayload` (memorizedPages, inProgress.page+verses, ayahReviewStates, sessions, hasCompletedQuran). Pure function | Changing what "Juz 1 selected" / "Surah 36 ayahs 1–30" / partial-page expands to |
