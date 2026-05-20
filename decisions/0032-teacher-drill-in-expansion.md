# 0032 — Teacher Drill-in Expansion: Viewer-Aware Cards + Today-View Reuse

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M6 (revision)

## Context

After ADR 0031 unblocked the teacher drill-in click, the surface itself felt thin and slightly miscalibrated:

- **ForecastCard** suggested the *viewer* "Adjust in Settings", but a teacher viewing a student's forecast can't change the student's pace.
- **ActivityStatsCard's** "Tests taken" counted every completed test for the student (self-tests, other teachers, etc.), but in the teacher context the user expects it to reflect "tests I administered" only.
- **No today/session view** — teachers had no way to see what pages the student is supposed to memorize next, which is the natural thing to want before starting a test.
- **No hifz tracker** — `RevisionHealthGrid` shows revision staleness but not memorized coverage; the same 30-juz grid that lives on `/today` (`JuzProgressBar`) gives the at-a-glance picture.
- **CTA + back-button affordances** weren't matched to the page weight — the green CTA blended in and the back link was a tiny anchor.

The M7 cards already followed the `studentId?` prop convention (ADR 0025). This ADR extends that with **viewer-context props** so the same components can serve self vs. teacher-of-student without per-route reimplementation.

## Decision

### Viewer-context props on existing M7 cards

- **`ForecastCard`** gains `isOwnView?: boolean` (default `true`). When `false`, the bottom hint switches from "At your configured pace … Adjust in Settings" to "Student's configured pace · X pages/day. Only the student can change this." No data change — just messaging.
- **`ActivityStatsCard`** gains `viewerTeacherId?: string`. When set, `fetchTestsInWindow` adds `.eq('teacher_id', viewerTeacherId)` and the row relabels to "Tests taken with you" (sub-text adapts too). The cache key now includes `viewerTeacherId ?? null` to keep self-view and teacher-view caches separate. `RevisionHealthGrid` is unchanged — staleness is a property of the student's review state, identical for either viewer.

### Today-view component reuse

- **`SessionPlanCard`** gains `readOnly?: boolean` (default `false`). When `true`, hides the celebration "Load next session" footer and the bottom "tests are the only queue-mover" hint. The data + queue ordering stay identical. Used by the drill-in as a read-only "what to test next" surface.
- **`JuzProgressBar`** reused as-is (already takes `studentId`) above the today-session block. This is the first cross-route use of a `today/` component outside `/today` itself.

### `JuzProgressBar` — pages-left annotation

Per cell, the derivation now returns `{ status, pagesLeft }`. Below each **incomplete** cell (in_progress + untouched) a 9px tabular-num count renders (with an invisible spacer below completed cells to keep grid baseline alignment). Tooltip also gains the count for screen-reader / verbose readers. Applies in both `/today` (student) and the teacher drill-in — single source, both audiences benefit.

`pagesLeft = max(0, juzLen - (mastered + memorized))` — `in_progress` pages count as remaining work because the page isn't yet memorized.

### Drill-in layout + chrome

- **CTA**: "Start test for this student" → `color="honey.7"`, `size="md"`. Warm gold, stronger than the previous sage.
- **Back button**: `<Anchor>← Students</Anchor>` → full `<Button variant="white" color="dark" leftSection={<ArrowLeft/>}>Back to Students</Button>`. Same chrome family as the directory's "Invite a student"/"New group" buttons.
- **Section order** (top → bottom): Back · Header · Hifz tracker · Today's session (read-only) · Forecast + Activity · Revision health · Recent tests.

### Why not extract teacher-specific copies of the cards

Each new prop is a small conditional — duplicating two cards to add three text variants would cost more than it saves and would split the source of truth for future tweaks. The prop pattern is the same one ADR 0025 set up; viewer-context props are the natural next layer.

## Consequences

- ✅ Teacher's per-student page now answers the four questions a teacher actually asks before testing: how much has this student memorized, what's next, how active are they, and how's the revision holding up.
- ✅ Wording stops claiming the teacher can change the student's settings.
- ✅ "Tests taken with you" is literal and useful — the teacher sees how much they've personally observed.
- ✅ Pages-left annotation lives in one component; student `/today` and teacher drill-in are visually consistent.
- ⚠️ `SessionPlanCard` now has a `readOnly` branch — keep adding new interactive bits behind the `readOnly` check or they'll leak into the teacher view.
- ⚠️ Cross-route reuse of `today/` components is a new pattern (compare `features/progress/` which was scoped reuse from day one). Today components were not originally written with reuse in mind — they still happen to be pure enough. If `today/` grows route-specific assumptions later, reconsider whether they belong in `features/` instead.
