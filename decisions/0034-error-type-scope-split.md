# 0034 — Error Types Have a Fixed Scope (Word or Verse)

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M7 (polish)

## Context

DESIGN.md §9.2 listed the 8 error types as a flat enum with no scope restriction; §9.7 Case 3 even gave a hesitation-on-word-5 example. In practice the picker presented all 8 types regardless of whether the tester tapped a word or a verse number, which led to two problems:

- A teacher could log `forgotten_verse` with a `word_position` set — semantically nonsense.
- "Mixing up verses" (`wrong_verse`) and "long pause before continuing" (`hesitation`) are inherently about the whole ayah, not a single word. Letting them anchor to one word loses information for the algorithm and confuses the overlay.

## Decision

Partition the 8 error types by scope. The scope is now a property of the type itself, enforced both by the log-error Zod schema and by the live-test UI.

- **Word-scope** (`word_position` required): `tajweed`, `pronunciation`, `omission`, `addition`, `mismatch`.
- **Verse-scope** (`word_position` must be NULL): `wrong_verse`, `forgotten_verse`, `hesitation`.

The picker in `ErrorLogModal` only shows the types valid for the tap scope:
- Word tap → word-scope chips only, `word_position` set.
- Verse-number (۝) tap → verse-scope chips only, `word_position = null`.

`packages/shared` exports `WORD_SCOPE_ERROR_TYPES` and `VERSE_SCOPE_ERROR_TYPES` so the server schema, the client modal, and any future consumer share one source of truth. `logErrorSchema` gains a refinement: error_type must match scope or the insert is rejected.

Historical rows that pre-date this split (e.g. `hesitation` with `word_position = 5`) stay in the DB untouched — the refinement only blocks new inserts. The signature column doesn't change.

## Reverses / patches

Patches DESIGN.md §9.2 (adds scope column to the error-type table) and §9.7 Case 3 example (now uses two word-scope types instead of tajweed + hesitation).

## Consequences

- ✅ Pickers stop showing meaningless options for the current tap scope.
- ✅ `error_log` rows are semantically consistent — verse-scope types never carry a `word_position`.
- ✅ Algorithm gets cleaner signals — verse-level vs word-level errors are now distinguishable at the type level, not just by the nullable `word_position` field.
- ⚠️ Historical rows can violate the new rule; queries that segment by scope must still handle the legacy mix until a backfill (not planned for MVP).
- ⚠️ If we later add a new error type, the scope decision must be made up-front — there is no "ambiguous" bucket.
