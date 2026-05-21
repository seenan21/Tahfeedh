-- 0028_add_simplified_enum_values.sql
-- ADR 0048 (collapse test ratings). Standalone migration because Postgres
-- forbids using an enum value in the same transaction that ADDed it. The
-- companion 0029_simplify_algorithm.sql does the data + function rewrites.
--
-- The pre-existing enum values (strong_pass, pass_needs_practice, excellent,
-- good, needs_work, fail) stay defined — Postgres doesn't support DROP VALUE,
-- and we don't want to swap the whole type. They are mapped to the new
-- pass/repeat domain by the UPDATE in 0029 and never written again.

alter type test_rating add value if not exists 'pass';
alter type test_rating add value if not exists 'repeat';
