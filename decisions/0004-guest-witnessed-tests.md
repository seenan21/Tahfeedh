# 0004 — Guest-Witnessed Tests (Shared-Device Mode)

**Date:** 2026-05-18
**Status:** Implemented (design); pending code in M4
**Milestone:** M4

## Context
DESIGN.md §3.1 reads "all tests require a teacher" and the student sidebar §14.2 has no entry point to start a test. In real-world hifz, most testing volume comes from parents, older siblings, visiting huffaz at the masjid, and study partners — none of whom are enrolled users in our system. Limiting tests to enrolled-teacher accounts would lock the most common testing pattern out of the data model, force users to type errors into a notes app, or just go untracked.

The principle of teacher-witnessed hifz (§3.1) is satisfied as long as a *human witness* is present. The system doesn't need to authenticate that witness to honor the principle — it needs to refuse pure self-testing.

## Decision

Add a "guest-witnessed" testing path:

1. **Student sidebar gains a `Tests` entry.** Two surfaces: a "Begin test" CTA and the test-history list (currently buried in Timeline).
2. **Teacher sidebar also gains a `Tests` entry** for symmetry — a flat view of all tests the teacher has run across all students.
3. **Schema additions on `test`:**
   - `teacher_id` becomes nullable (was NOT NULL).
   - New column `test_mode` enum: `enrolled_teacher | guest_teacher`. (No `self` value — pure self-testing remains out of scope per §3.1.)
   - New column `guest_tester_name TEXT` — optional free-text shown in history ("Tested by: Abu Ahmad").
4. **RLS:** when `test_mode = 'guest_teacher'`, the student themself can insert/update the test row. `is_my_student()` still applies for `enrolled_teacher` rows.
5. **Trust nudge, not algorithmic penalty.** Before a guest test starts, the student sees: *"This will be recorded in your hifz history. Only ask someone qualified to test you."* Guest-tested data flows into the algorithm identically — weighting it less would create perverse incentives to misreport.
6. **No "self-test" mode**, ever. The Begin-test flow requires the student to physically hand the device over — there's no silent button that lets them rate themselves. The trust nudge + the friction of involving another person is the enforcement.

## Consequences
- ✅ Captures the majority of real testing volume that today goes untracked.
- ✅ Student gets a discoverable entry point to "be tested" without violating §3.1.
- ✅ Teachers get a flat tests-overview surface (was missing).
- ⚠️ Slight risk a determined student fakes guest tests on themselves. Acceptable — the algorithm is robust to noisy data (3+ tests at a location to clear an error, etc.) and the social contract is the real enforcement.
- ⚠️ RLS gets one more conditional branch on `test` writes.

## Affects
- DESIGN.md §3.1 — softened to "human-witnessed" with guest variant.
- DESIGN.md §6.1 — Tests added to IN-scope student + teacher features.
- DESIGN.md §12.1 — `test` table schema notes.
- DESIGN.md §12.2 — new `test_mode` enum.
- DESIGN.md §14.2 / §14.3 — Tests added to both sidebars.
- DESIGN.md §19 — guest-test path added under M4.
