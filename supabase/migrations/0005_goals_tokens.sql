-- 0005_goals_tokens.sql
-- Long-term hifz goals (mirrored to QF Goals API) and QF OAuth token storage.

create table goal (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references app_user(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  status goal_status not null default 'active',
  qf_goal_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goal_student_idx on goal(student_id);

-- QF OAuth tokens. RLS denies all client access (see 0008_rls.sql).
-- Only the Express service-role client reads/writes here.
create table qf_user_token (
  user_id uuid primary key references app_user(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
