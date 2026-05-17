-- 0009_hardening.sql
-- Address Supabase security advisor warnings from the initial schema.
--   - Pin search_path on functions to prevent search-path injection.
--   - Revoke anon EXECUTE on SECURITY DEFINER functions (only authenticated
--     callers should reach them; RLS policies still work because Postgres
--     evaluates them in the authenticated role's session).

-- Pin search_path on every function we own.
alter function touch_updated_at()           set search_path = public;
alter function generate_invite_code()       set search_path = public;
alter function current_session_number(uuid) set search_path = public;
alter function session_status_today(uuid, date) set search_path = public;
alter function daily_streak(uuid)           set search_path = public;
alter function ensure_student_settings()    set search_path = public;
alter function ensure_student_code()        set search_path = public;
alter function error_signature(int, int, int, error_type) set search_path = public;

-- Lock SECURITY DEFINER functions to authenticated users only.
revoke execute on function is_my_student(uuid)    from anon, public;
revoke execute on function enroll_via_code(text)  from anon, public;
grant  execute on function is_my_student(uuid)    to authenticated;
grant  execute on function enroll_via_code(text)  to authenticated;
