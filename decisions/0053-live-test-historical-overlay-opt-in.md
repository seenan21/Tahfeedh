# 0053 — Live-Test Historical Error Overlay (Opt-In, Default OFF)

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M6

## Context
The live-test mushaf always shows the *live* overlay — every error
logged during the current test immediately tints the corresponding
word, giving the witness real-time spatial feedback. But it shows
nothing about whether the student has historically struggled at the
same words. For an enrolled teacher running a witnessed test, knowing
"this student keeps repeating an error on this word" is exactly the
diagnostic information that improves the next test.

The countervailing concern is bias: if a marker is visible before the
student recites the word, the witness will reflexively listen harder
there. That is anti-pedagogical — a witnessed test should measure the
student's recitation, not the witness's prior expectation.

## Decision
Add a "Show historical errors" Switch to the live-test toolbar, **default
OFF**, **rendered only when `test.teacher_id === user.id`** (i.e. the
witness is an enrolled teacher, not a self-test student). When ON,
fetch the student's `error_location_stats` (RLS already grants this
read via `is_my_student()`, migration 0008) and merge them under the
existing `liveOverlay` so fresh in-session taps still win on the same
word.

The marker tap behavior is unchanged — taps continue to open
`ErrorLogModal`, never `VerseDetailModal`. Mounting both would create
two competing reactions to the same tap.

The historical stats reflect "state as of the last finished test"
because `submit_test` is what decays + upserts them. That's the right
snapshot for the diagnostic case; the live overlay layered on top
shows the current-test reality. No UI copy is needed to explain this —
the Switch label is self-explanatory.

Self-test users (`test_mode='guest_teacher'`, `teacher_id IS NULL`)
never see the Switch. They can't bias themselves with their own
history, but the simpler argument is that the self-test stays clean.

## Consequences
- ✅ Teachers get a diagnostic loop for repeat errors without the
  always-on bias.
- ✅ Default OFF preserves the existing live-test UX. Adding the
  toggle costs ~1 row in the toolbar; the historical fetch only runs
  if the teacher reaches for it.
- ✅ Zero schema or RLS change — `error_location_stats` already
  permits teacher reads via `is_my_student()`.
- ⚠️ When the toggle is ON, the witness sees data updated as of the
  *last* test the student finished, not real-time across concurrent
  tests. This is fine for the single-witness model the app assumes; a
  future multi-witness scenario would need a tighter update cadence.
- ⚠️ The toggle is per-session local state. If we ever want it
  remembered, store on `student_settings` (teacher preference) — not
  on the test row.
