# apps/web/src/features/live-test/

The Phase D witnessed-test flow (DESIGN.md §14.5 / §14.6). Reached from `/_authed/tests/$testId`. All errors stream to the server per tap (ADR 0018); the finish endpoint reads them from the DB. The mushaf overlay is **always on during a live test** — each logged error immediately tints the corresponding word so the witness/student see the spatial picture alongside the error log on the right.

## Index

| File | What | When to read |
|---|---|---|
| `LiveTestRoute.tsx` | Two-pane layout: `<MushafPage>` left with prev/next page toolbar, `<ErrorLogPane>` right. Owns modal state for `ErrorLogModal` and `PostTestSummaryModal`. Loads the test row via direct Supabase select | Touching the live-test surface |
| `ErrorLogModal.tsx` | Bottom-sheet modal on word-tap. 8 error-type chips, severity SegmentedControl, optional note. When `error_type === 'wrong_verse'`, shows an inline debounced QF Search field (radio-pick → `related_surah` + `related_ayah`) | Touching the error-logging UX or the wrong-verse differentiator |
| `ErrorLogPane.tsx` | Right pane: streaming list of logged errors (from local state mirrored from `useTestSession`), rating Select (options differ by test_type), notes textarea, "End test" button | Touching the live test sidebar UI |
| `PostTestSummaryModal.tsx` | NEW / RECURRING / CLEARED sections backed by the `submit_test` summary | Touching the post-test summary screen |
| `TestCreationModal.tsx` | Begin-Test modal: test_type + page range + witness name. Calls `POST /api/tests/create`, navigates to `/tests/$testId` on success. Trust nudge per ADR 0004 | Touching test creation UX |
| `useTestSession.ts` | Hook: holds `errors[]`, exposes `logError(input)` → `POST /api/tests/:id/error` and `finishTest(rating, notes)` → `POST /api/tests/:id/finish` | Adjusting the live-test data flow |
| `useTestPages.ts` | `useTestPages(ranges)` derives the candidate page list (any page that overlaps any range) for prev/next navigation. Mirrors server `resolveTestRanges` (page-collection step) but doesn't compute fully-covered subset | Adjusting the page navigation order |
