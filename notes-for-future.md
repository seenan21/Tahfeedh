# Notes for Future

Deferred decisions and scope cuts made during the hackathon MVP build. Each entry: what was cut, why, and how to restore it later.

---

## Dual-role accounts (Student + Teacher on one user)

**Status:** Deferred. MVP uses a single `role` column on `app_user`.

**Original design:** `DESIGN.md` §2 originally specified `roles user_role[]` so one account could be both student and teacher, with a role switcher in the header and a "Add second role" action in Settings.

**Why cut for MVP:**
- Saves UI work: no role switcher, no "Add role" settings flow, no role-perspective toggle on shared screens.
- Simpler RLS: policies key off `role = 'teacher'` or `role = 'student'` rather than `'teacher' = ANY(roles)`.
- Demo accounts in §17 are each single-role anyway, so no demo regression.
- Removes a class of edge cases (Today view perspective when a user is both).

**How to restore:**
1. Migration:
   ```sql
   ALTER TABLE app_user
     ALTER COLUMN role TYPE user_role[]
     USING ARRAY[role];
   ALTER TABLE app_user RENAME COLUMN role TO roles;
   ```
2. Update RLS policies that compare `role = '...'` → `'...' = ANY(roles)`.
3. Add Settings UI: "Add teacher role" / "Add student role" button.
4. Header: render role switcher only when `roles.length > 1`.
5. Today view / Students list: read `activeRole` from local state, default to first role.

**Cost estimate:** ~half a day. The schema change is one migration; the UI work is the bulk of it.
