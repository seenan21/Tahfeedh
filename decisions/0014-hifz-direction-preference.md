# 0014 — Hifz Direction Preference (Baqarah-First vs Juz-Amma-First)

**Date:** 2026-05-18
**Status:** Implemented
**Milestone:** M3 (Phase C follow-up)

## Context
The Phase C `next_new_lesson(uuid)` RPC walks pages 1 → 604 in numeric order and returns the lowest non-memorized page. That hard-codes a single direction: forward from Al-Baqarah toward An-Nas.

Two memorization traditions are widely practiced:

1. **Forward (Baqarah-first):** start at page 1 / Surah Al-Baqarah and move toward Juz 30. Common in adult-onset hifz.
2. **Backward (Juz-Amma-first):** start at page 604 / Surah An-Nas and move toward Al-Baqarah. The traditional path for children — short surahs first, easier to memorize, builds momentum.

A student who memorized Juz 30 first under the current code is told "begin page 1" — useless. A student with a mixed-bag of juzs has no way to express which direction their frontier should advance.

This is a per-student preference; settings already exist for session sizes (DESIGN.md §6.3), so this fits the same shape. The choice also gates onboarding for a "fresh" student — they need to indicate where their start is even before they've memorized anything.

## Decision
Add `hifz_direction hifz_direction NOT NULL DEFAULT 'forward'` to `student_settings` (new enum: `'forward' | 'backward'`). Captured in migration 0015.

Behavior changes:

1. **`next_new_lesson`** reads `hifz_direction` and picks:
   - `forward`  → lowest page where status NOT IN (memorized, mastered)
   - `backward` → highest page where status NOT IN (memorized, mastered)
   In both directions the `kind = 'continue'` branch still fires when the chosen page already has an `in_progress` row.

2. **`commit_onboarding`** accepts an optional `hifzDirection` in the payload (defaults to `'forward'` if absent). The function writes it onto `student_settings` in the same transaction as the other onboarding writes.

3. **Onboarding Step 1** adds a bilingual two-card direction picker below the path picker:
   - "From Al-Baqarah forward" / "من البقرة"
   - "From Juz Amma first" / "من جزء عمّ"
   Shown for every path (including `fresh` — the choice still matters for the very first page).

4. **Settings page** (deferred to M7) will expose this for later changes. For now it's an onboarding-only capture; advanced students can edit it via SQL in the meantime.

## Consequences
- ✅ Queue 1 honors the student's actual journey, not the page numbering.
- ✅ Forward-compatible with M5 — the full algorithm's "next new lesson" slot already routes through `next_new_lesson`.
- ✅ Default `'forward'` keeps current users (the test fixtures + any pre-existing rows) on their current behavior — no data migration risk.
- ⚠️ Direction is one-shot in onboarding for now. A backward-direction student who later wants to switch can't until the settings page lands.
- ⚠️ The `complete` onboarding path still writes the field but `has_completed_quran = true` short-circuits `next_new_lesson` — direction has no effect for them today. Keeping the field captured anyway so it's available when the algorithm starts using it for revision-side priorities (M5 may consider direction when filling the revision bucket).
