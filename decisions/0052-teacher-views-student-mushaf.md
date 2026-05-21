# 0052 — Teacher Views Student Mushaf via Sub-Route

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M6

## Context
Teachers had no way to see the canonical visual of a student's hifz state.
The drill-in (`/students/$studentId`) surfaces the M7 analytics cards but
no mushaf — yet the mushaf with its heatmap overlay is exactly the surface
that answers "which pages are healthy / struggling?". RLS already permits
teacher reads on `memorization_page`, `error_location_stats`,
`ayah_review_state`, and `error_log` for actively enrolled students (per
ADRs 0008, 0033). The components needed (`MushafPage`, `PageDetailsPanel`,
`VerseDetailModal`, `MushafGrid`) are already parameterized on `studentId`.

## Decision
Extract the body of `_authed.mushaf.tsx` into a reusable
`apps/web/src/mushaf/StudentMushafSurface.tsx` with props
`{ studentId, viewerRole: 'self' | 'teacher', studentName?, onBack? }`.

- `_authed.mushaf.tsx` becomes a thin wrapper that passes `user.id` and
  `viewerRole='self'`.
- New route `_authed.students.$studentId.mushaf.tsx` verifies active
  enrollment (same pattern as the drill-in), then renders the surface
  with `viewerRole='teacher'`, the student's display name, and an
  `onBack` that navigates back to the drill-in.
- The drill-in (`_authed.students.$studentId.index.tsx`, renamed from
  `.tsx` so the file routing sees it as a sibling of the new mushaf
  child — same fix ADR 0031 applied to the parent students route) gets
  a "View mushaf" Button next to the existing "Start test for this
  student" CTA. Honey "Start test" stays primary; "View mushaf" uses
  the default sage-outlined variant.
- Last-viewed page is persisted in localStorage scoped per viewer-context
  (`tahfeedh:mushaf:lastPage` for self, `tahfeedh:mushaf:lastPage:<id>`
  per student for teachers) so per-student state doesn't collide.
- Teacher view skips the self-only `next_new_lesson` cache lookup
  (defaults to page 1); hero renders "Student mushaf" eyebrow + the
  student's name in the Latin H2.

## Consequences
- ✅ Teachers get the canonical hifz-state visualization for any
  enrolled student with zero new RLS work.
- ✅ Pattern extends ADR 0032's viewer-aware-prop convention to a full
  surface (not just a single card).
- ✅ Single component owns both views — visual + behavioral changes
  land in both at once.
- ⚠️ The drill-in now has a child route, so it had to be renamed to
  `.index.tsx`. Existing links to `/students/$studentId` continue to
  work; only the file path changed.
- ⚠️ No write affordances are exposed to teachers (the surface is
  read-only by construction — there are no marking UIs since ADR 0015).
  If a future ADR ever reintroduces student-side writes from the mushaf,
  the teacher view will need an explicit gate.
