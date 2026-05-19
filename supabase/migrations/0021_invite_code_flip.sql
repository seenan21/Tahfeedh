-- 0021_invite_code_flip.sql
-- ADR 0028 — flip the enrollment direction. Previously the teacher entered the
-- student's 6-digit code (`student_code` table). New model: the teacher
-- generates an invite code; the student enters it.
--
-- Schema:
--   * Drop `student_code` table + `ensure_student_code` trigger + `generate_invite_code` helper.
--   * New `teacher_invite_code` table — one active row per teacher at a time.
--     8-char Crockford-ish alphabet (no 0/O/1/I/L). Reusable, 24h TTL.
--   * Rewrite `enroll_via_code(p_code)` semantics: caller is now the student,
--     code resolves to the teacher.
--   * New `get_or_create_teacher_invite_code()` + `rotate_teacher_invite_code()` RPCs.
--   * New `leave_teacher(p_teacher_id)` RPC — student-only, flips enrollment to 'paused'.

-- ---------------------------------------------------------------------------
-- 1. Drop the old student_code surface.
-- ---------------------------------------------------------------------------

drop trigger if exists ensure_student_code_trg on app_user;
drop function if exists ensure_student_code();
drop policy  if exists code_self_select on student_code;
drop table   if exists student_code;
drop function if exists generate_invite_code();

-- ---------------------------------------------------------------------------
-- 2. New table + index + RLS for teacher_invite_code.
-- ---------------------------------------------------------------------------

create table teacher_invite_code (
  code         text primary key check (length(code) = 8),
  teacher_id   uuid not null references app_user(id) on delete cascade,
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index teacher_invite_code_teacher_idx
  on teacher_invite_code(teacher_id, revoked_at, expires_at desc);

alter table teacher_invite_code enable row level security;

-- Teacher reads + writes their own codes. Students never touch this table
-- directly — they reach it through the SECURITY DEFINER `enroll_via_code` RPC.
create policy tic_owner
  on teacher_invite_code for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Internal helper: 8-char Crockford-ish code minter.
--    Alphabet excludes 0, O, 1, I, L for unambiguous voice / WhatsApp sharing.
-- ---------------------------------------------------------------------------

create or replace function _mint_invite_code() returns text
language plpgsql
volatile
set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 chars
  result   text := '';
  i        int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

revoke execute on function _mint_invite_code() from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC: get_or_create_teacher_invite_code()
--    Returns the teacher's current active+non-expired code. Mints one if none.
-- ---------------------------------------------------------------------------

create or replace function get_or_create_teacher_invite_code()
returns table(code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public as $$
declare
  v_teacher uuid := auth.uid();
  v_code    text;
  v_exp     timestamptz;
begin
  if not exists (
    select 1 from app_user
     where id = v_teacher and role = 'teacher'
  ) then
    raise exception 'only teachers can mint invite codes';
  end if;

  -- Existing live code wins.
  select tic.code, tic.expires_at
    into v_code, v_exp
    from teacher_invite_code tic
   where tic.teacher_id = v_teacher
     and tic.revoked_at is null
     and tic.expires_at > now()
   order by tic.created_at desc
   limit 1;

  if v_code is not null then
    return query select v_code, v_exp;
    return;
  end if;

  -- Mint a fresh code. Retry on (vanishingly unlikely) PK collision.
  for i in 1..5 loop
    begin
      v_code := _mint_invite_code();
      v_exp  := now() + interval '24 hours';
      insert into teacher_invite_code (code, teacher_id, expires_at)
        values (v_code, v_teacher, v_exp);
      return query select v_code, v_exp;
      return;
    exception when unique_violation then
      -- try again
      v_code := null;
    end;
  end loop;

  raise exception 'could not generate a unique invite code (5 attempts)';
end;
$$;

revoke execute on function get_or_create_teacher_invite_code() from anon, public;
grant  execute on function get_or_create_teacher_invite_code() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC: rotate_teacher_invite_code()
--    Revokes any active code and mints a new one. Returns the new code.
-- ---------------------------------------------------------------------------

create or replace function rotate_teacher_invite_code()
returns table(code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public as $$
declare
  v_teacher uuid := auth.uid();
  v_code    text;
  v_exp     timestamptz;
begin
  if not exists (
    select 1 from app_user
     where id = v_teacher and role = 'teacher'
  ) then
    raise exception 'only teachers can rotate invite codes';
  end if;

  update teacher_invite_code
     set revoked_at = now()
   where teacher_id = v_teacher
     and revoked_at is null;

  for i in 1..5 loop
    begin
      v_code := _mint_invite_code();
      v_exp  := now() + interval '24 hours';
      insert into teacher_invite_code (code, teacher_id, expires_at)
        values (v_code, v_teacher, v_exp);
      return query select v_code, v_exp;
      return;
    exception when unique_violation then
      v_code := null;
    end;
  end loop;

  raise exception 'could not generate a unique invite code (5 attempts)';
end;
$$;

revoke execute on function rotate_teacher_invite_code() from anon, public;
grant  execute on function rotate_teacher_invite_code() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Rewrite enroll_via_code(p_code) — caller is now the student.
--    Resolves code → teacher_id. Inserts (or unpauses) the enrollment row.
--    New students land in 'Ungrouped' (group_id = NULL).
-- ---------------------------------------------------------------------------

create or replace function enroll_via_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_student  uuid := auth.uid();
  v_teacher  uuid;
  v_code     text := upper(trim(p_code));
  v_enroll   uuid;
begin
  if not exists (
    select 1 from app_user
     where id = v_student and role = 'student'
  ) then
    raise exception 'only students can join via code';
  end if;

  select tic.teacher_id into v_teacher
    from teacher_invite_code tic
   where tic.code = v_code
     and tic.revoked_at is null
     and tic.expires_at > now();

  if v_teacher is null then
    raise exception 'invalid or expired invite code';
  end if;

  if v_teacher = v_student then
    raise exception 'cannot enroll with your own code';
  end if;

  -- Insert OR reactivate. Existing UNIQUE (teacher_id, student_id) means
  -- a re-join after 'paused' or 'completed' just flips back to 'active'.
  insert into enrollment (teacher_id, student_id, status, group_id)
  values (v_teacher, v_student, 'active', null)
  on conflict (teacher_id, student_id) do update
    set status     = 'active',
        updated_at = now()
  returning id into v_enroll;

  return v_enroll;
end;
$$;

revoke execute on function enroll_via_code(text) from anon, public;
grant  execute on function enroll_via_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC: leave_teacher(p_teacher_id)
--    Student-side: flips the caller's enrollment with this teacher to 'paused'.
--    RLS is_my_student() gates on status='active', so paused teachers
--    immediately lose read access to the student's data.
-- ---------------------------------------------------------------------------

create or replace function leave_teacher(p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_student uuid := auth.uid();
begin
  if v_student is null then
    raise exception 'leave_teacher: not authenticated';
  end if;

  update enrollment
     set status     = 'paused',
         updated_at = now()
   where student_id = v_student
     and teacher_id = p_teacher_id
     and status     = 'active';

  if not found then
    raise exception 'no active enrollment with that teacher';
  end if;
end;
$$;

revoke execute on function leave_teacher(uuid) from anon, public;
grant  execute on function leave_teacher(uuid) to authenticated;
