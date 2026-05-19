# apps/web/src/features/

Feature-folder subdirectories — each is a self-contained surface (route + supporting components + hooks) tied to one user-facing flow. Compare to `routes/` (file-based router) and `components/` (shared primitives): a feature folder owns *all* the moving parts for one experience, and its top-level file is the component the route renders.

## Index

| Path | What | When to read |
|---|---|---|
| `live-test/` | The live-test surface (Phase D / M4): two-pane mushaf + error log, error logging modal with inline QF Search for wrong-verse, post-test summary | Touching the witnessed-test flow |
| `progress/` | Forward-looking student dashboard (M7, ADR 0025): `ForecastCard`, `ActivityStatsCard`, `RevisionHealthGrid`, with pure helpers under `lib/`. All components accept `studentId?: string` so M6's teacher drill-in reuses them | Touching forecasts, activity stats, revision health, or making any of those visible in a new surface |
| `teacher/` | Teacher-side helpers (M6, ADR 0027): `useTeacherStudents` hook joins `enrollment` + `app_user` + `student_group` into a `studentsByGroup` map. Group/student CRUD lives inline in `_authed.students.tsx`; modals are not extracted (one route file owns the directory + modals for now) | Touching the teacher directory data shape or extracting modals as the surface grows |
