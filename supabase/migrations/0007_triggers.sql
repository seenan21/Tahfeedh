-- 0007_triggers.sql
-- updated_at maintenance triggers + auto-provision triggers for new students.

-- updated_at triggers on every table that has the column.
create trigger touch_app_user
  before update on app_user
  for each row execute function touch_updated_at();

create trigger touch_student_settings
  before update on student_settings
  for each row execute function touch_updated_at();

create trigger touch_student_group
  before update on student_group
  for each row execute function touch_updated_at();

create trigger touch_enrollment
  before update on enrollment
  for each row execute function touch_updated_at();

create trigger touch_memorization_page
  before update on memorization_page
  for each row execute function touch_updated_at();

create trigger touch_ayah_review_state
  before update on ayah_review_state
  for each row execute function touch_updated_at();

create trigger touch_test
  before update on test
  for each row execute function touch_updated_at();

create trigger touch_error_location_stats
  before update on error_location_stats
  for each row execute function touch_updated_at();

create trigger touch_goal
  before update on goal
  for each row execute function touch_updated_at();

create trigger touch_qf_user_token
  before update on qf_user_token
  for each row execute function touch_updated_at();

-- Auto-create student_settings when a student account is created.
create or replace function ensure_student_settings()
returns trigger
language plpgsql as $$
begin
  if new.role = 'student' then
    insert into student_settings (student_id)
    values (new.id)
    on conflict (student_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger ensure_student_settings_trg
  after insert on app_user
  for each row execute function ensure_student_settings();

-- Auto-generate a unique 6-char invite code when a student account is created.
-- Retries up to 10 times on collision.
create or replace function ensure_student_code()
returns trigger
language plpgsql as $$
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

create trigger ensure_student_code_trg
  after insert on app_user
  for each row execute function ensure_student_code();
