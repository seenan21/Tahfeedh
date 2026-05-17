-- 0002_identity.sql
-- Identity hub + per-student config + invite codes + teacher groups + enrollments.

create table app_user (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  display_name text,
  has_completed_quran boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table student_settings (
  student_id uuid primary key references app_user(id) on delete cascade,
  pages_per_session_new int not null default 1 check (pages_per_session_new >= 0),
  pages_per_session_revision int not null default 5 check (pages_per_session_revision >= 0),
  max_review_interval_sessions int not null default 60 check (max_review_interval_sessions > 0),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table student_code (
  code text primary key check (length(code) = 6),
  student_id uuid not null unique references app_user(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table student_group (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references app_user(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, name)
);

create table enrollment (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references app_user(id) on delete cascade,
  student_id uuid not null references app_user(id) on delete cascade,
  group_id uuid references student_group(id) on delete set null,
  status enrollment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, student_id),
  check (teacher_id <> student_id)
);

create index enrollment_teacher_idx on enrollment(teacher_id);
create index enrollment_student_idx on enrollment(student_id);
create index student_group_teacher_idx on student_group(teacher_id);
