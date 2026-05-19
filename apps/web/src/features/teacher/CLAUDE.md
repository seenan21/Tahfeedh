# apps/web/src/features/teacher/

Teacher-side helpers (M6, ADR 0027). The directory view + group/student CRUD modals live inline in `_authed.students.tsx` (one route file owns the surface for now); only the cross-cutting data hook is extracted here. The teacher drill-in (`_authed.students.$studentId.tsx`) doesn't pull from this folder — it reuses the M7 progress cards via their `studentId` prop.

## Index

| File | What | When to read |
|---|---|---|
| `useTeacherStudents.ts` | Hook returning `{ directory: { groups: TeacherGroup[]; studentsByGroup: Map<groupId \| null, TeacherStudent[]> }, isLoading, refetch }`. Joins `enrollment` + `app_user` (display names) + `student_group` (names) under existing RLS. Sorts students alphabetically within each group; case-insensitive, null names last. Ungrouped lives under `studentsByGroup.get(null)` | Touching the teacher directory data shape, the sort key, or adding fields shown on the student rows |
