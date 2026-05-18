-- 0010_fix_signup_triggers.sql
-- The ensure_student_code() trigger inserts into student_code, but the table's
-- only RLS policy is SELECT for the owning student. With no INSERT policy, the
-- trigger fails during signup with a 403, rolling back the entire app_user
-- insert.
--
-- Fix: mark both auto-provisioning triggers as SECURITY DEFINER so they bypass
-- RLS. Students should never insert into student_code directly — it's a
-- system-managed identifier. Same for student_settings, for consistency and
-- robustness against future RLS changes.

create or replace function ensure_student_settings()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if new.role = 'student' then
    insert into student_settings (student_id)
    values (new.id)
    on conflict (student_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function ensure_student_code()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  attempt int := 0;
  new_code text;
begin
  if new.role <> 'student' then
    return new;
  end if;

  loop
    new_code := generate_invite_code();
    begin
      insert into student_code (code, student_id)
      values (new_code, new.id);
      exit;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 10 then
        raise exception 'failed to generate unique invite code after % attempts', attempt;
      end if;
    end;
  end loop;
  return new;
end;
$$;
