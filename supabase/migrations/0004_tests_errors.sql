-- 0004_tests_errors.sql
-- Teacher-administered tests, individual errors, and the rollup stats table.

create table test (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references app_user(id) on delete cascade,
  teacher_id uuid not null references app_user(id) on delete cascade,
  test_type test_type not null,
  status test_status not null default 'in_progress',
  rating test_rating,
  ranges jsonb not null,
  notes text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'completed' or rating is not null),
  check (status <> 'completed' or ended_at is not null),
  check (teacher_id <> student_id)
);

-- only one open test per student at a time
create unique index test_one_open_per_student
  on test(student_id)
  where status = 'in_progress';

create index test_student_idx on test(student_id);
create index test_teacher_idx on test(teacher_id);
create index test_student_ended_idx
  on test(student_id, ended_at desc)
  where status = 'completed';

-- Immutable wrapper to build the error signature inside a GENERATED column.
-- The enum->text cast is STABLE by default (enum labels could theoretically
-- be renamed), which Postgres rejects for GENERATED. We don't rename enum
-- labels in practice, so declaring the wrapper IMMUTABLE is safe.
create or replace function error_signature(
  p_surah int,
  p_ayah int,
  p_word int,
  p_type error_type
)
returns text
language sql
immutable as $$
  select p_surah::text || ':' ||
         p_ayah::text || ':' ||
         coalesce(p_word::text, '') || ':' ||
         p_type::text;
$$;

create table error_log (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references test(id) on delete cascade,
  student_id uuid not null references app_user(id) on delete cascade,
  surah_number int not null check (surah_number between 1 and 114),
  ayah_number int not null check (ayah_number >= 1),
  word_position int check (word_position >= 1),
  word_position_end int check (word_position_end >= 1),
  error_type error_type not null,
  severity error_severity not null default 'moderate',
  teacher_note text,
  related_surah int check (related_surah between 1 and 114),
  related_ayah int check (related_ayah >= 1),
  signature text generated always as (
    error_signature(surah_number, ayah_number, word_position, error_type)
  ) stored,
  created_at timestamptz not null default now(),
  check (word_position_end is null or word_position is not null),
  check (word_position_end is null or word_position_end >= word_position)
);

create index error_log_test_idx on error_log(test_id);
create index error_log_student_idx on error_log(student_id);
create index error_log_student_signature_idx on error_log(student_id, signature);

create table error_location_stats (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references app_user(id) on delete cascade,
  signature text not null,
  surah_number int not null,
  ayah_number int not null,
  word_position int,
  error_type error_type not null,
  occurrence_count int not null default 1 check (occurrence_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  tests_since_last_occurrence int not null default 0,
  cleared boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (student_id, signature)
);

create index error_location_stats_student_idx on error_location_stats(student_id);
create index error_location_stats_location_idx
  on error_location_stats(student_id, surah_number, ayah_number);
