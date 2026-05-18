# apps/web/src/onboarding/

The 3-step onboarding flow shown to brand-new students. Mounted at `/onboarding` (top-level, no AppShell — ADR 0005). Finish posts to `/api/onboarding/finish` (ADR 0008).

## Index

| File | What | When to read |
|---|---|---|
| `state.ts` | `useReducer` state + actions + `toFinishPayload()` that produces the endpoint body matching `onboardingFinishSchema` | Adding a new step, changing what's collected, or modifying the finish payload |
| `Step1Path.tsx` | Path picker: Fresh / Partial / Complete. Routes Partial → Step 2, others → Step 3 | Tweaking Step 1 |
| `Step2Capture.tsx` | Mode toggle (Juz / Surah) + selections panel + collapsible partial-page picker | Tweaking Step 2 layout |
| `JuzGrid.tsx` | 30-cell juz selector with shortcut chips (`1-5`, `26-30`, `All`, `Clear`) | Tweaking juz-selection visuals |
| `SurahList.tsx` | Searchable list of 114 surahs with per-row "ayahs 1 to N" partial input | Tweaking surah-selection UX |
| `PartialPagePicker.tsx` | "Currently in the middle of one" — cascading juz → surah → ayah picker | Tweaking the partial-page marker UX |
| `Step3Sessions.tsx` | Session size: half-page / 1 / 2 / Custom for new; 3 / 5 / 10 / Custom for revision (DESIGN.md §6.3) | Tweaking session size presets or validation |
