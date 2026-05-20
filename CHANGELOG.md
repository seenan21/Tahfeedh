# Changelog

## [Unreleased]

### Fixed — Teacher drill-in: today's session + recent tests load (ADR 0033)
- **Migration `0024_teacher_session_and_test_reads.sql`.** Two openings so the teacher's read of student data isn't crippled:
  - New `test_teacher_select_student` SELECT policy on `test` — `using (is_my_student(student_id))`. The teacher can now read every completed test for an actively enrolled student (self-tests, other-teacher tests, this-teacher tests). The existing `test_teacher_all` policy still gates writes to teacher-administered, so this is read-only widening.
  - `today_session(p_student_id)` guard relaxed from `p_student_id <> auth.uid() → forbidden` to also allow `is_my_student(p_student_id)`. Body unchanged from 0018; read-or-create idempotent semantics intact.
- Knock-on: `daily_streak`, `session_status_today`, the drill-in's "Recent tests" query, and the ActivityStatsCard test count (with `viewerTeacherId` filter) all work correctly for teacher-viewed students now.
- `load_next_session` + `next_new_lesson` deliberately left student-only — those are real writes that advance the queue.
- **ADR 0033** captures the openings + rejected alternatives.

### Added — Teacher drill-in expansion (ADR 0032)
- **`apps/web/src/features/progress/ForecastCard.tsx`** — new `isOwnView?: boolean` prop (default true). When false, the pace-hint swaps from "Adjust in Settings" to "Only the student can change this." Used by the teacher drill-in.
- **`apps/web/src/features/progress/ActivityStatsCard.tsx`** — new `viewerTeacherId?: string` prop. When set, `fetchTestsInWindow` adds `.eq('teacher_id', viewerTeacherId)` and the row relabels to "Tests taken with you" (with adapted sub-text). Cache key includes the teacher id so self-view + teacher-view caches don't collide.
- **`apps/web/src/today/SessionPlanCard.tsx`** — new `readOnly?: boolean` prop. When true, hides the celebration footer with the "Load next session" CTA + the bottom hint. Used by the teacher drill-in's read-only "what to test next" surface.
- **`apps/web/src/today/JuzProgressBar.tsx`** — derivation now returns `{ status, pagesLeft }` per juz; pages-left count renders under each incomplete cell (in_progress + untouched); tooltip extended with the count. Applies to both `/today` and the teacher drill-in (first cross-route reuse of a `today/` component).
- **`apps/web/src/routes/_authed.students.$studentId.tsx`**:
  - Mounts `JuzProgressBar` (hifz tracker) and read-only `SessionPlanCard` (today's session — what to test next) above the existing forecast/activity row.
  - Passes `isOwnView={false}` to ForecastCard and `viewerTeacherId={user.id}` to ActivityStatsCard.
  - "Start test for this student" CTA → `color="honey.7"`, `size="md"` (was sage).
  - Back link → full `<Button variant="white" color="dark" leftSection={<ArrowLeft/>}>Back to Students</Button>` (was a tiny anchor).
- **ADR 0032** captures the viewer-context prop pattern, the today-component reuse, and the pages-left annotation.

### Fixed / Added — Teacher `/tests` history + students route nesting (ADR 0031)
- **Renamed `apps/web/src/routes/_authed.students.tsx` → `_authed.students.index.tsx`.** TanStack file-routing was treating the `.tsx` as a layout parent of `_authed.students.$studentId.tsx`. The directory page had no `<Outlet />` so clicking a student row updated the URL but the drill-in never rendered. As an `index` file it becomes a sibling of `$studentId` under `_authed`, same shape as the tests routes. `routeTree.gen.ts` regenerated.
- **`apps/web/src/routes/_authed.tests.index.tsx`** — `TestsPage` now branches on `user.role`. Student branch unchanged. Teacher branch is a new `TeacherTestsHistory` component: 30 most-recent completed tests where `teacher_id = self.id`, student name on each row (separate `app_user.display_name` fetch keyed by collected `student_id`s), New-lesson/Revision badge, range + relative time, rating badge, whole row clickable → `/tests/$testId/recap`. No self-test CTA, no sparkline. Test creation stays where M6 put it: the drill-in's "Start test for this student" button.
- **ADR 0031** captures both fixes and the rationale for keeping the drill-in as the single test-creation entry point.

### Fixed — "Unnamed teacher" in student Classroom tab (ADR 0030)
- **Migration `0023_student_reads_teacher_app_user.sql`.** Adds `app_user_select_my_teacher` SELECT policy on `app_user`: a student can read any `app_user` row corresponding to a teacher they have an `status='active'` enrollment with. Mirror of the existing teacher → student direction via `is_my_student()`. PostgreSQL OR's multiple policies for the same operation, so this is additive — the existing `app_user_select` policy is untouched.
- No frontend change needed; `apps/web/src/routes/_authed.classroom.tsx` was already joining `enrollment` → `app_user.display_name`, just being blocked by RLS. Names now resolve.
- Leaving a teacher (`leave_teacher` flips enrollment to `'paused'`) immediately revokes the student's read access to that teacher's `app_user` row, symmetric with how the teacher loses access to the student's data.

### Changed — Teacher directory polish (ADR 0029)
- **Migration `0022_realtime_enrollment.sql`.** `alter publication supabase_realtime add table enrollment;` — first realtime surface in the app. The teacher directory now reflects student joins live without a refresh.
- **`apps/web/src/features/teacher/useTeacherStudents.ts`** — opens a Supabase Realtime channel `teacher-enrollment-<teacherId>` on `postgres_changes` (event `*`) filtered by `teacher_id=eq.<id>`. Any event invalidates `teacher_enrollments` + `teacher_student_users`. Channel torn down on unmount.
- **`apps/web/src/routes/_authed.students.tsx`** — `StudentRow` rewritten:
  - Removed the today-status badge (`session_status_today` RPC + `fetchTodayStatus` + `todayStatusBadge` helper). The "pending" label was misread as enrollment-pending.
  - Outer wrapper is now a native `<div role="button" tabIndex={0}>` with explicit `onClick` + `onKeyDown` (Enter / Space) — whole row clickable, keyboard-navigable. Kebab-menu wrapper keeps `stopPropagation`.
  - Per-row menu trigger icon swapped `Move` → `FolderInput` (was reading as drag-to-reorder).
- **ADR 0029** captures the realtime pattern (first in the app), the row-click refactor, and the rationale for dropping today-status from the directory.

### Changed — Enrollment direction flip + Classroom tab (ADR 0028)
- **Migration `0021_invite_code_flip.sql` (applied).** Drops `student_code` (table, `ensure_student_code` trigger, `generate_invite_code` helper). New `teacher_invite_code` table — 8-char Crockford-ish codes (alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, no 0/O/1/I/L), reusable, 24-hour TTL. RLS `tic_owner` lets the teacher manage their own codes; students never touch the table directly.
- **New RPCs** (all `SECURITY DEFINER`): `get_or_create_teacher_invite_code()` returns the teacher's current live code (mints if none); `rotate_teacher_invite_code()` revokes the active code + mints a fresh one; `leave_teacher(p_teacher_id)` flips the caller's enrollment to `'paused'` so existing `is_my_student()` RLS revokes the teacher's data access immediately.
- **`enroll_via_code(p_code)` rewritten** — caller is now the **student**. Resolves code → teacher, rejects expired/revoked/self-codes, INSERTs or UPDATEs the enrollment row (re-join after `'paused'` flips back to `'active'` and preserves history). New students land in `group_id = NULL` (Ungrouped); the teacher organizes them later.
- **`apps/web/src/routes/_authed.students.tsx`** (teacher): "Enroll via code" replaced with **"Invite a student"** modal — shows the teacher's current 8-char code in a monospace block with a Copy button + "Rotate code" action (confirm prompt). Expiry timestamp displayed.
- **`apps/web/src/routes/_authed.classroom.tsx`** (student, NEW): lists active teachers (display name, joined-date, optional group badge from the teacher's grouping), "Join via code" CTA, "Leave class" per row via kebab menu. Empty state directs the student to ask their teacher for an invite code.
- **`apps/web/src/components/AppSidebar.tsx`** — student nav gains **Classroom** entry (`/classroom`, icon `School`, Arabic `الحلقة`) between My Mushaf and Goals.
- **ADR 0028** captures the flip, rejected alternatives (pending state, single-use codes), and the trust-direction rationale.

### Added — M6 teacher side (directory + drill-in)
- **`apps/web/src/routes/_authed.students.tsx`** rewritten from EmptyState to the teacher directory view (ADR 0027). Groups as collapsible folders + an Ungrouped section. Each row shows display name, streak (`daily_streak` RPC), today's session status (`session_status_today` RPC), and last test rating + relative time. Inline `+ New group` + `Enroll via code` actions in the page header; kebab on each group header for Rename / Delete; Move-to-group menu on each student row. All writes go directly through Supabase JS under existing RLS (`sg_owner` + `en_teacher_all` + `enroll_via_code` SECURITY DEFINER) — no migration, no Express endpoints.
- **`apps/web/src/routes/_authed.students.$studentId.tsx`** — new teacher drill-in. Header (name, group, streak, "Start test for this student" button) + reused M7 cards (`<ForecastCard>`, `<ActivityStatsCard>`, `<RevisionHealthGrid>` with `studentId` prop) + recent-tests list linking to `/tests/$testId/recap`. Verifies active enrollment before rendering.
- **`apps/web/src/features/teacher/useTeacherStudents.ts`** — hook that joins `enrollment` + `app_user` + `student_group` into a `studentsByGroup: Map<groupId | null, TeacherStudent[]>` shape.
- **`apps/web/src/features/live-test/TestCreationModal.tsx`** extended — accepts `mode?: 'guest_teacher' | 'enrolled_teacher'` (default `guest_teacher`) and `subjectLabel?: string`. In `enrolled_teacher` mode: witness field hidden, `next_new_lesson` pre-fill disabled, body sends `{ test_mode: 'enrolled_teacher', student_id }`.
- **`apps/server/src/routes/tests.ts`** — `POST /api/tests/create` now handles the `enrolled_teacher` branch (was a stub 501 in Phase D). Verifies the caller has an active `enrollment` with `body.student_id`, then inserts with `student_id` from payload + `teacher_id` from caller.
- **`packages/shared/src/schema.ts`** — `testCreateSchema` accepts optional `student_id: z.string().uuid()` with a refine: required when `test_mode === 'enrolled_teacher'`.
- **`apps/web/src/components/AppSidebar.tsx`** — Teacher nav drops the standalone "Groups" entry; the Students route owns group CRUD now.
- **Removed:** `apps/web/src/routes/_authed.groups.tsx`.
- **ADR 0027** — captures the groups-as-folders directory model + the drill-in's reuse of M7 cards via `studentId` prop.
- **DESIGN.md §19 M6** patched to reflect implementation.

### Added — M7 progress dashboard + error detail modal
- **New route `apps/web/src/routes/_authed.progress.tsx`** (replaces `_authed.timeline.tsx`). Sidebar entry renamed Timeline → Progress (ar: التقدم), icon `TrendingUp` (ADR 0025). Renders three reusable cards: ForecastCard + ActivityStatsCard + RevisionHealthGrid.
- **`apps/web/src/features/progress/ForecastCard.tsx`** — configured-pace projection. Reads `student_settings.pages_per_session_new` + `hifz_direction` + `memorization_page`. Shows next-juz and full-Quran completion dates with pages-left + days-away counts. Deterministic forecast (no rolling-pace math, no slip-warning).
- **`apps/web/src/features/progress/ActivityStatsCard.tsx`** — 7d/30d SegmentedControl toggle, three metrics: pages newly memorized (count of `memorization_page.memorized_at >= cutoff`), pages reviewed (distinct pages from `ayah_review_state.last_reviewed_at` mapped via `quran-index.json`), tests taken with pass rate (`strong_pass` + `excellent` over total).
- **`apps/web/src/features/progress/RevisionHealthGrid.tsx`** — 30 juz cells colored by the stalest ayah's `last_reviewed_at` among memorized pages in each juz. Five bands: fresh / aging / stale / overdue / never (memorized but no review state) / untouched.
- **`apps/web/src/features/progress/lib/forecast.ts`**, **`lib/activityStats.ts`**, **`lib/revisionHealth.ts`** — pure helper modules. The cards consume `studentId` only; helpers do the computation. Same `studentId?` prop convention will let M6 drill-in reuse the cards (ADR 0025).
- **`apps/web/src/mushaf/ErrorDetailModal.tsx`** — per-occurrence error history modal (ADR 0026 implements ADR 0023's design). Triggered by `MushafPage` `onMarkerTap` callback wired in `_authed.mushaf.tsx`. Queries `error_log` rows at the tapped location, groups visually by `error_type`, hides cleared signatures behind an Eye-toggled "ghost errors" reveal. Uses the parent's already-fetched `error_location_stats.cleared` set to classify ghost-or-active — no schema change, no second stats fetch.
- **`apps/web/src/routes/_authed.mushaf.tsx`** — wires `onMarkerTap` + mounts `<ErrorDetailModal>`.
- **`apps/web/src/components/AppSidebar.tsx`** — student nav entry switched Timeline → Progress, icon `CalendarDays` → `TrendingUp`.
- **Removed:** `apps/web/src/routes/_authed.timeline.tsx`.
- **ADR 0025** — captures the timeline → progress reframe + the `studentId?`-prop reuse convention.
- **ADR 0026** — closes out ADR 0023 (no longer "Planned").
- **DESIGN.md §19 M7** patched to reflect the reframed scope.

### Added — M5 algorithm completion
- **Migration `0020_m5_algorithm.sql` (applied).** Rewrites `submit_test()` and `_compute_session_plan()` to close all `-- TODO M5+` markers from migrations 0016 + 0017 (ADR 0024).
  - **`submit_test()`** now also: rolls up per-ayah `consecutive_clean_tests` (increment on clean coverage, reset on any logged error at the ayah); runs the Queue 2 stage machine (DESIGN.md §7.2) — strong_pass/excellent advances `recent_stage`, good/pass_needs_practice slides `ready_at` without advancing, needs_work decrements, **fail resets stage to 1 + clears `graduated_at` (graduated pages drop back into Queue 2) — page status unchanged**; engages the stage machine on the `newly_memorized + strong_pass` test that promotes the page (stage 1, ready_at = +1 day); graduates ayahs when stage would exceed 3 (`recent_stage = NULL`, `graduated_at = now`, `ready_at = NULL`); promotes pages from `memorized → mastered` when **every** ayah on the page has `consecutive_clean_tests >= 5` after a `revision + strong_pass`. Intervals: stage 1 → +1d, stage 2 → +3d, stage 3 → +7d.
  - **`_compute_session_plan()`** now: Queue 2 first — pages with any ayah where `recent_stage IS NOT NULL AND ready_at <= now()`, ordered by `min(stage) asc, min(ready_at) asc`; Queue 3 tops up — graduated pages scored by the DESIGN.md §7.2 priority formula minus `mutashabihat_penalty` (TODO M9): `recency × 1.0 + errors × 20.0 - mastery × 3.0 + juz_cohesion (±2 neighbors reviewed in last 3 days) + overdue × 10.0`. `error_rate_last_3_tests` is approximated by `count(non-cleared error_location_stats on page) / 3` (proxy, comment noted in SQL).
- **ADR 0024** (`decisions/0024-m5-algorithm-completion.md`) — captures the four chosen rules + the proxy on error_rate.

### Changed — Milestone plan
- **New milestone M7.5 — Settings Page.** The `_authed.settings.tsx` route is still an `EmptyState` stub but bundles enough work (capacity sliders, completed-Quran flag, invite code display, profile, hifz direction toggle, Edit Memorization) to warrant its own slot between M7 and M8. DESIGN.md §19 updated: M7's "Settings → Edit Memorization" bullet moved into the new M7.5 block. Plan.Md "Remaining milestones" updated. `notes-for-future.md`'s "Edit Memorization (post-M8)" entry retitled to "(M7.5)" — the previous wording predated the M7.5 carve-out. No ADR — this is plan housekeeping, not architectural.

### Changed — Design notes for M7
- **ADR 0023** (`decisions/0023-error-detail-modal-design.md`) — captures the error detail modal design intent: list every individual `error_log` occurrence at the tapped location (not summarized), and hide `cleared = true` rows by default behind a "ghost errors — show" reveal. No code yet; M7 work.
- **DESIGN.md §9.6** updated — modal lists per-occurrence rows; ghost-error rules added.
- **DESIGN.md §20.15** added — open question: within-signature sort key (severity-first vs. recency-first), decide during M7.
- **DESIGN.md M7 milestone bullet** updated to mention ghost-error reveal.
- **Plan.Md M7 line** updated with same reference.

### Added — Test recap (read-only history view)
- **Migration `0019_test_summary_persistence.sql` (applied).** Adds `test.summary jsonb` and rewrites `submit_test()` to `UPDATE test SET summary = v_summary` immediately before returning. Extends ADR 0017 (one fat fn) with one side-effect write so the read-only recap can render historical NEW/RECURRING/CLEARED — `error_location_stats` is global mutable state and can't be back-derived once subsequent tests decay/overwrite the counters. (ADR 0022).
- **`apps/web/src/routes/_authed.tests.$testId.recap.tsx`** — new read-only route. Renders `<TestRecapView>` for completed/abandoned tests.
- **`apps/web/src/features/live-test/TestRecapView.tsx`** — fetches the `test` row + `error_log` rows (both via direct Supabase + existing student-select RLS). Renders header (type · range · ended_at · duration · witness · rating badge), notes block, persisted post-test summary (or "summary unavailable for tests before this date" placeholder), and the full logged-errors list.
- **`apps/web/src/features/live-test/LoggedErrorsList.tsx`** — extracted from `ErrorLogPane.tsx`; shared by the live-test sidebar and the recap. Optional `showTrashAffordance` keeps the future-affordance disabled trash icon on the live side only.
- **`apps/web/src/features/live-test/PostTestSummaryView.tsx`** — extracted from `PostTestSummaryModal.tsx`; same NEW/RECURRING/CLEARED sections, no Modal/Close wrapper. Reused by the modal (live flow) and the recap.
- **ADR 0022** (`decisions/0022-test-recap-route-and-persisted-summary.md`) — the route + persistence pair.

### Changed — Test recap
- **`apps/web/src/features/live-test/LiveTestRoute.tsx`** — completed/abandoned tests now redirect to `/tests/:id/recap` (`replace: true`) instead of rendering the "already completed" alert. Effect-based, not render-side.
- **`apps/web/src/routes/_authed.tests.index.tsx`** — history rows now navigate to `/tests/:id/recap`.
- **`apps/web/src/features/live-test/ErrorLogPane.tsx`** — error-list ScrollArea replaced by `<LoggedErrorsList errors={errors} showTrashAffordance />`. No behavior change.
- **`apps/web/src/features/live-test/PostTestSummaryModal.tsx`** — body delegates to `<PostTestSummaryView summary={summary} />`. Modal keeps the Done button + duration badge.
- **ADR 0020 (tests-landing recent history) renumbered to ADR 0021** — collided with the Phase E `0020-frozen-daily-session.md` that landed alongside. File renamed `0020-tests-landing-shows-recent-history.md → 0021-...`; CHANGELOG reference + decisions/CLAUDE.md index updated.

### Added — Phase E (M5) — Today's Session machine + simple revision queue
- **Migration `0017_daily_session.sql` (applied).** New `daily_session` table — one row per `(student_id, session_date, session_index)` holding `new_lesson_pages int[]` + `revision_pages int[]`. RLS: students read their own rows; teachers via `is_my_student`. All inserts go through SECURITY DEFINER RPCs (ADR 0020).
- **`today_session(uuid)` SQL RPC** — the Today read entry point. Returns the latest session row for `current_date`, auto-creating `session_index = 1` on first call of a new calendar day. Joins page-typed completed-test ranges to attach per-page `attempted` flags (any closed test today whose range covers the page checks the row — pass or fail both count). Granted `authenticated`.
- **`load_next_session(uuid)` SQL RPC** — explicit "Load next session early" CTA (DESIGN.md §7.7). Computes a fresh plan and inserts at `session_index = max + 1` for `current_date`. Granted `authenticated`.
- **`_compute_session_plan(uuid)` internal SQL helper** — runs both queues for one session insert. Queue 1 mirrors the direction-aware frontier walk from `next_new_lesson` (`0015_hifz_direction.sql`). Revision queue is the simplest viable rule: memorized pages sorted by stalest `ayah_review_state.last_reviewed_at`, capped at `student_settings.pages_per_session_revision`. Excludes the new-lesson page from the revision set. Service-role only.
- **`apps/web/src/today/SessionPlanCard.tsx`** — replaces the old `NewLessonCard` + revision `EmptySlotCard`. Single card fed by the `today_session` RPC. Renders new-lesson section, revision section, attempted counter ("N of M attempted"), and either a celebration block + "Load next session" button (when `all_attempted`) or the standard footer caption. `useMutation` calls `load_next_session` and seeds the next session into the query cache.
- **`apps/web/src/today/PlanRow.tsx`** — new reusable row component used for both new-lesson and revision rows. Strikes through the page title when attempted, shows an "Attempted today" pill, dims the row, and switches the "Open mushaf" button to subtle variant.
- **Cache invalidation** — `useTestSession.finishTest` now invalidates `['today_session', studentId]` so attempted-checkmarks refresh after a test ends (`apps/web/src/features/live-test/useTestSession.ts`).
- **Shared types** — `TodaySession`, `TodaySessionRow` added to `@tahfeedh/shared`.
- **ADR 0020** (`decisions/0020-frozen-daily-session.md`) — captures the frozen-plan decision, the anti-gaming rationale, and the deferred Queue 2/3 priority math.

### Fixed — M5
- **Migration `0018_fix_session_rpc_ambiguity.sql` (applied).** Today's session card was failing with `column reference "session_date" is ambiguous` because `RETURNS TABLE(session_date date, session_index int, …)` OUT parameters shadow the table columns inside the function body under Postgres 15+. Qualified every column reference in `today_session`, `load_next_session`, and `session_status_today` (which had the same latent bug since 0006 — surfaced by `StreakBadge` once the Today route started exercising both RPCs).

### Changed — M5
- **DESIGN.md §7.1 patched** — replaced "computed on read each time the student opens the Today view" with the persisted-plan model. The completion-state derivation principle is preserved; only the plan-storage rule changed. Cross-references ADR 0020.
- **Today route** (`apps/web/src/routes/_authed.today.tsx`) — Plan card now renders a single `SessionPlanCard`; the inline Divider scaffolding moved inside the card.
- **Removed:** `apps/web/src/today/NewLessonCard.tsx` — superseded by `SessionPlanCard` + `PlanRow`. The standalone `next_new_lesson` query stays in use only inside `_authed.mushaf.tsx` for the reader's initial-page bootstrap.

### Added — Phase D (M4) — Live tests + error logging E2E
- **Migration `0016_post_test_pipeline.sql` (applied).** `submit_test(uuid, jsonb)` SECURITY DEFINER function — transactionally closes a test, touches `ayah_review_state.last_reviewed_at` for every covered ayah, upserts `error_location_stats` from the streamed `error_log` rows, decays untouched stats (clears at counter ≥ 3 per DESIGN.md §12 / §13.4), promotes `memorization_page.status` from `in_progress → memorized` on `strong_pass` for `newly_memorized` tests, and returns `{ testId, new[], recurring[], cleared[] }`. Granted to `service_role` only (ADR 0017). M5 work (mastery promotion, fail-downgrade, recent-revision stage machine) is documented inline with `-- TODO M5` markers.
- **Express `/api/tests` router** (`apps/server/src/routes/tests.ts`) with three endpoints — `POST /create`, `POST /:id/error` (streaming per-tap inserts, ADR 0018), `POST /:id/finish` (resolves ranges via `apps/server/src/pipelines/post-test/resolve.ts`, calls `submit_test` RPC). All three verify the Supabase bearer + ownership; the create endpoint surfaces the unique-partial-index conflict as 409.
- **Pure range resolver** (`apps/server/src/pipelines/post-test/resolve.ts`) — `resolveTestRanges(ranges, quranIndex): { coveredAyahs, coveredPages }`. Handles `page`/`surah`/`ayah`/`juz`; throws on `hizb`/`rub` (not in static index — out of MVP scope). Reuses `expandPageAyahs` from `apps/server/src/memorization/pageAyahs.ts`.
- **Shared types + Zod schemas:** `TestMode`, `PostTestSummary`, `PostTestSummaryRow`, `ErrorLocationStatsRow` (types.ts); `testCreateSchema`, `logErrorSchema`, `finishTestSchema` with refinements (wrong_verse requires `related_surah`/`related_ayah`; guest_teacher requires `guest_tester_name`; `word_position_end ≥ word_position`).
- **Live-test feature folder** (`apps/web/src/features/live-test/`):
  - `LiveTestRoute.tsx` — two-pane layout (MushafPage left, ErrorLogPane right), prev/next page toolbar, modal orchestration. Reached via `/_authed/tests/$testId`.
  - `TestCreationModal.tsx` — type + page range + witness name. Trust nudge per ADR 0004.
  - `ErrorLogModal.tsx` — 8 error-type chips (DESIGN.md §9.2), severity, optional note, **inline QF Search field when `error_type === 'wrong_verse'`** (debounced query to `/api/qf/search`, radio-picks store `related_surah`+`related_ayah`).
  - `ErrorLogPane.tsx` — streaming error list with badges, rating picker (different options per test type), End-Test button.
  - `PostTestSummaryModal.tsx` — three sections (NEW / RECURRING / CLEARED) backed by the `submit_test` summary payload.
  - `useTestSession.ts` — hook holding `errors[]` + `logError()` + `finishTest()`.
  - `useTestPages.ts` — derives the candidate page list from a test's ranges (mirrors `resolveTestRanges` for the client).
- **Tests sidebar route updated** (`apps/web/src/routes/_authed.tests.tsx`): Begin-Test CTA + trust nudge; resumes an in-progress test if one exists; shows a single "Most recent test" line link to Today. Full history list intentionally deferred (cut per Phase D scope decision).
- **Tests landing — recent history surface (ADR 0021).** Replaces the single "Most recent test" breadcrumb on `_authed.tests.index.tsx` with: (a) a 30-day activity sparkline (inline SVG, no chart-lib dep) showing tests-per-day with hover tooltips, and (b) a list of the last 15 completed tests as Card rows — type badge, range summary, relative date, rating badge — each linking to `/tests/$testId/recap`. Queries hit the existing `test_student_ended_idx` partial index.
- **Live-test route file** `apps/web/src/routes/_authed.tests.$testId.tsx`.
- **Overlay computation** (`apps/web/src/mushaf/getOverlayMarkers.ts`, ADR 0019). `getOverlayMarkers(pageNumber, stats, mode, quranIndex)` collapses `error_location_stats` rows to one marker per visual location; merges by max-intensity for color and total occurrence_count for the badge. `getErrorsAtLocation` helper for the future error-detail modal. Three modes wired: `simple` (red marker), `heatmap` (5-band ramp), `colored` (per error type).
- **MushafPage marker rendering** — `overlays` prop now accepts `ErrorLocationStatsRow[]`; words with markers get a tinted background + bottom underline (via CSS custom property `--marker-color`) and an optional count badge (`5+` collapse rule per ADR 0011).
- **PageDetailsPanel populated with real Phase D data**: errors-logged section reads from `error_location_stats` filtered to the page's ayahs (top-3 patterns by occurrence); recent-tests section reads from `test` filtered to ranges that overlap the page.
- **ADR 0016** — Mushaf line layout: `direction: rtl` + justified flex (no `row-reverse`).
- **ADR 0017** — Post-test pipeline as one fat SQL function.
- **ADR 0018** — Streaming error inserts (per-tap POST).
- **ADR 0019** — Overlay computation client-side from cached `error_location_stats`.
- **ADR 0021** — Tests landing shows recent history (sparkline + last 15 list).

### Fixed — Phase D foundation
- **Mushaf rendering: words now read right-to-left (ADR 0016).** `apps/web/src/mushaf/MushafPage.module.css` removed `flex-direction: row-reverse` from `.line` — combined with `.mushaf-page { direction: rtl }` it was a BiDi double-reversal that rendered LTR. Filled lines now justify edge-to-edge via inline `justify-content: space-between` (set per line by `LineRow`); centered lines (surah_name, basmallah, `is_centered`) keep `justify-content: center`. Added `unicode-bidi: isolate` + `letter-spacing: 0` to `.mushaf-word` so the renderer behaves correctly when embedded in an LTR pane (the new live-test layout). `MushafPage.tsx` preloads the current page's QPC V2 font via an injected `<link rel="preload">` to cut the FOIT/FOUT swap flash.

### Changed
- **My Mushaf restructured (ADR 0015).** The route is now reader-first: the actual mushaf page renders on the main canvas (no Drawer), with a sticky read-only `PageDetailsPanel` to the right showing status + memorized timestamp + review freshness (from `ayah_review_state`) + Phase-D placeholders for error summary and recent tests. A SegmentedControl toggles to a `Tracker` view; the new `MushafGrid` is a collapsible accordion with one juz per row (each shows a stacked progress bar + counts; expanding reveals the page cells). Reader toolbar: prev / next / page indicator / "Jump to" input. Last-selected page persists in `localStorage`; initial page comes from cached `next_new_lesson` or page 1.
- **Removed manual memorization marking** — `MarkPageModal`, `POST /api/memorization/mark`, the `/api/memorization` mount, and the `markMemorizationSchema` / `MarkMemorizationInput` / `MemorizationMarkStatus` types are all gone. Per ADR 0015, `memorization_page.status` changes only via the post-test pipeline (Phase D) or onboarding's `commit_onboarding` bulk-write. The SQL function `mark_memorization(uuid, jsonb)` stays in the DB (reserved for the post-M8 Edit Memorization Settings flow — see `notes-for-future.md`).
- ADR 0012 (Memorization Marking via Express + SQL Function) status updated to Superseded by ADR 0015.

### Added
- ADR 0015 (`decisions/0015-memorization-status-test-driven.md`).
- `apps/web/src/mushaf/PageDetailsPanel.tsx` + module CSS — the new read-only side panel.
- `apps/web/src/mushaf/MushafRoute.module.css` — toolbar + two-column reader layout.
- `notes-for-future.md` — new entry for the post-M8 Edit Memorization / Recalibrate flow (two restore paths documented).
- Migration `0015_hifz_direction` (applied) — adds `hifz_direction` enum (`'forward' | 'backward'`) + `student_settings.hifz_direction` column (default `'forward'`, NOT NULL). Rewrites `next_new_lesson(uuid)` to read the column and pick the lowest-unmemorized page in forward mode, highest-unmemorized in backward mode (ADR 0014, addresses traditional Juz-Amma-first hifz path). Rewrites `commit_onboarding(uuid, jsonb)` to accept `hifzDirection` in the payload and write it through.
- Shared types: `HifzDirection` union; `onboardingFinishSchema` extended with `hifzDirection` (default `'forward'`).
- Server: `expandSelections()` forwards `hifzDirection` on `CommitOnboardingPayload`; the `/api/onboarding/finish` route already RPCs the SQL function with the full payload.
- Onboarding state: `OnboardingState.direction` (default `'forward'`), `SET_DIRECTION` action, `toFinishPayload` includes `hifzDirection`.
- `Step1Path.tsx` adds a bilingual two-card direction picker ("From Al-Baqarah forward" / "From Juz Amma first") below the path picker — every student now declares whether their frontier advances forward or backward.
- Migration `0014_marking_and_next_lesson` (applied) — `mark_memorization(uuid, jsonb)` SECURITY DEFINER function for service-role writes across `memorization_page`, `memorization_verse`, `ayah_review_state` in one transaction (ADR 0012); `next_new_lesson(uuid)` SECURITY DEFINER function for Queue 1 frontier walk granted to `authenticated` (ADR 0013). Superseded by 0015 (direction-aware).
- `POST /api/memorization/mark` Express endpoint — verifies bearer, validates payload with `markMemorizationSchema`, expands `pageNumber` into the page's ayah set via `apps/server/src/memorization/pageAyahs.ts`, RPC-calls `mark_memorization`. Mounted in `apps/server/src/index.ts`.
- Shared types: `MarkMemorizationInput`, `MemorizationMarkStatus`, `NextNewLesson`, `NextNewLessonKind`, `MidpointAyahBreak`; `MushafWord` now carries `code_v2 + char_type` (matches the per-page JSON emitted by `build-quran-data.ts` and ADR 0003). Shared schema adds `markMemorizationSchema` + `ayahKeySchema` (Zod).
- `apps/web/src/mushaf/MushafPage.tsx` — renderer for one Madani 15-line page (lazy-loads `pages/{N}.json`, applies `font-family: 'QPC V2 P{N}'`, single delegated click handler for word + verse taps). Accepts `overlays + overlayMode` props for Phase D (stubbed: only `'none'` rendered). `compact` prop for grid drill-down peeks.
- `apps/web/src/mushaf/MushafGrid.tsx` — 604-page grid grouped by juz, colored by `memorization_page.status` (same palette as `JuzProgressBar`). Tap → `onPick(pageNumber)`.
- `apps/web/src/mushaf/MarkPageModal.tsx` — bottom-sheet style modal with segmented control (Untouched / First half / Second half / Memorized). For in-progress halves, expands ayahs against `midpoint_ayah_break` and POSTs to `/api/memorization/mark`; invalidates `memorization_pages` + `next_new_lesson` queries on success.
- `apps/web/src/today/NewLessonCard.tsx` — replaces the new-lesson `EmptySlotCard`. Calls `supabase.rpc('next_new_lesson')` and renders "Begin page N · surah" / "Continue page N · surah" with an "Open mushaf" CTA. Falls back to a hifz-complete empty state when the RPC returns no row.
- `_authed.mushaf.tsx` rewritten: bilingual hero + status legend, the 604-cell grid, `MarkPageModal`, and a side `Drawer` housing `MushafPage` for the reader.
- Migration `0011_guest_witnessed_tests` — implements ADR 0004: `test_mode` enum, nullable `test.teacher_id`, `guest_tester_name` column, witness check constraint, and student-write RLS policies for guest-witnessed tests and their `error_log` rows.
- Migration `0012_onboarding_complete` — adds `student_settings.onboarding_complete` boolean used by the `_authed` route gate.
- Migration `0013_session_size_and_onboarding_writes` — alters `pages_per_session_new` to `NUMERIC(3,1)` for half-page support, bounds both per-session counters at 20, and adds the `commit_onboarding(uuid, jsonb)` SECURITY DEFINER function granted only to the service role (ADRs 0006, 0008).
- Pathless `_authed` layout route enforcing the auth + onboarding gate and rendering the AppShell with role-aware sidebar (ADR 0005).
- `AppSidebar` component with three-state selection pattern per DESIGN-SYSTEM §6.
- Stub routes for every sidebar item: `tests`, `timeline`, `mushaf`, `goals`, `settings`, `groups`. Student-only and teacher-only routes redirect cross-role visitors to their landing page.
- `apps/web/src/data/quran-index.json` — derived lookup (page/surah/juz ranges + first-ayah-page map) generated by `scripts/build-quran-data.ts` or the new fast `scripts/build-quran-index.ts` (`npm run build:quran-index`). Typed in `@tahfeedh/shared` as `QuranIndex` (ADR 0007).
- `POST /api/onboarding/finish` Express endpoint — verifies the Supabase bearer token, expands selections against the static index, and RPC-calls `commit_onboarding` (ADR 0008). New helpers: `apps/server/src/auth/verifyUser.ts`, `apps/server/src/onboarding/expand.ts`.
- Real 3-step onboarding flow: `Step1Path` (fresh / partial / complete), `Step2Capture` with juz grid + searchable surah list + partial-page picker, `Step3Sessions` with half-page support and Custom… input.
- Today skeleton (DESIGN.md §14.4) — `StreakBadge` wired to the `daily_streak()` RPC (Western digits + flame icon), `JuzProgressBar` rendering completed/in-progress juz counts in Arabic-Indic numerals, and `EmptySlotCard` placeholders for new-lesson and review rows.
- Visual polish: `SilkBackground` (R3F + custom shader) on `/login`, `/signup`, `/`; `BilingualHero` and `IntroHadith` components; user-menu dropdown in the header with sign-out, settings, role badge; Lucide icons on the sidebar; bilingual `EmptyState` replaces "Coming soon" cards on every stub route (ADR 0009).
- App-shell modernization (ADR 0010): radial mihrab gradient on `AppShell.main`, `backdrop-filter: blur` glassy header, parchment→sage gradient sidebar with the brand wordmark moved inside it, bilingual nav rows (English left / Arabic right), three-state CSS module styling driven by `useMatchRoute` + `[data-active]` (fixes the hover-sticks bug). Today view rebuilt with a hero strip on the dark ground, a 30-cell juz grid colored by status, a gradient flame streak badge, and refined slot cards with colored icon halos. Empty-state hero pattern (88px iconHalo, tag chip, fade-in animation) on every stub route.

### Changed
- DESIGN.md §9.7 added (overlay rendering & overlap handling): per-scope render rules, the three overlap cases, count badges, the 5+ density guardrail, and modal grouping. DESIGN.md §10.4 rewritten with the `getOverlayMarkers` / `getErrorsAtLocation` contract. DESIGN.md §20.14 added: marker tap-target size, baseline offset, badge typography, and the max-intensity-wins color rule. Captured as ADR 0011 (merge at render time, never at storage).
- `getCurrentUser` now returns `onboardingComplete`. Teachers always `true`; students read from `student_settings`.
- Login, signup, and root index routes redirect via new `landingRouteForUser` helper so students with incomplete onboarding land on `/onboarding`.
- `__root.tsx` stripped to a bare provider — AppShell now lives inside `_authed.tsx`.
- `apiFetch` now forwards the current Supabase access token as `Authorization: Bearer …` so the Express server can verify the caller via `supabaseAdmin.auth.getUser(token)`.
- DESIGN.md §6.3 line 397 corrected: `has_completed_quran` lives on `app_user`, not `student_settings` (per implemented schema and `session_status_today`, see ADR 0008).
- `scripts/build-quran-data.ts` also writes the derived `quran-index.json` to web and server data directories alongside the per-page JSONs and metadata.

### Fixed
- Production crash on `node dist/index.js` (`ERR_UNKNOWN_FILE_EXTENSION ".ts"`): `@tahfeedh/shared` now compiles to `dist/*.js` + `.d.ts` and `package.json` `exports` point at the built artifacts. Root scripts enforce build order (shared → server → web); `predev` builds shared on cold start and `dev:shared` watches it during development.
- Server boot crash on Railway: `@supabase/supabase-js` realtime client needs a WebSocket impl that Node 20 doesn't ship natively. Bumped engines.node to `>=22` (root + apps/server) and added `.nvmrc` pinning 22. Node 22 has native WebSocket so no `ws` runtime dep needed.
