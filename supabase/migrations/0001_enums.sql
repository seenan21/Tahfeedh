-- 0001_enums.sql
-- All enum types used across the schema.

create type user_role as enum ('student', 'teacher');

create type memorization_status as enum ('in_progress', 'memorized', 'mastered');

create type test_type as enum ('newly_memorized', 'revision');

create type test_status as enum ('in_progress', 'completed', 'abandoned');

create type test_rating as enum (
  'strong_pass',
  'pass_needs_practice',
  'excellent',
  'good',
  'needs_work',
  'fail'
);

create type error_type as enum (
  'tajweed',
  'pronunciation',
  'omission',
  'addition',
  'mismatch',
  'wrong_verse',
  'forgotten_verse',
  'hesitation'
);

create type error_severity as enum ('minor', 'moderate', 'major');

create type enrollment_status as enum ('active', 'paused', 'completed');

create type goal_status as enum ('active', 'completed', 'abandoned');
