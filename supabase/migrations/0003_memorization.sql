-- 0003_memorization.sql
-- Page- and verse-level memorization state, and ayah-level review state
-- (the algorithm's input).

create table memorization_page (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references app_user(id) on delete cascade,
  page_number int not null check (page_number between 1 and 604),
  status memorization_status not null default 'in_progress',
  memorized_at timestamptz,
  mastered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, page_number)
);

create index memorization_page_student_idx on memorization_page(student_id);

create table memorization_verse (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references app_user(id) on delete cascade,
  surah_number int not null check (surah_number between 1 and 114),
  ayah_number int not null check (ayah_number >= 1),
  page_number int not null check (page_number between 1 and 604),
  memorized_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (student_id, surah_number, ayah_number)
);

create index memorization_verse_student_page_idx on memorization_verse(student_id, page_number);

create table ayah_review_state (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references app_user(id) on delete cascade,
  surah_number int not null check (surah_number between 1 and 114),
  ayah_number int not null check (ayah_number >= 1),
  last_reviewed_at timestamptz,
  last_reviewed_session_number int,
  consecutive_clean_tests int not null default 0,
  recent_stage int check (recent_stage between 1 and 3),
  ready_at timestamptz,
  graduated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, surah_number, ayah_number)
);

create index ayah_review_state_student_idx on ayah_review_state(student_id);
create index ayah_review_state_ready_idx
  on ayah_review_state(student_id, ready_at)
  where recent_stage is not null;
