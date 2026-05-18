# 0008 — Onboarding Bulk-Write via Express + Postgres Function

**Date:** 2026-05-18
**Status:** Implemented
**Milestone:** M3

## Context
Finishing onboarding writes to four tables: `memorization_page`, `memorization_verse`, `ayah_review_state`, `student_settings`. It also flips `app_user.has_completed_quran` for the "I've memorized the whole Qur'an" path.

Two constraints push the write off the browser:
1. **RLS.** `ayah_review_state` exposes only a SELECT policy to authenticated clients (0008_rls.sql); inserts must come from the service role. Adding a per-row INSERT policy would lose the protection that derived state is server-computed.
2. **Atomicity.** A partial failure across four tables leaves the student in a broken state where, say, `onboarding_complete = true` but no `memorization_page` rows exist. A single transaction is required.

DESIGN.md §6.3 line 397 also drifted from the implemented schema by writing `has_completed_quran` to `student_settings`; the column actually lives on `app_user` (0002_identity.sql line 8) and is read from there by `session_status_today` (0006_functions.sql line 89). DESIGN.md is patched to match the schema rather than the schema being migrated to match DESIGN.md.

## Decision
Two-tier handler:

1. **Express endpoint** `POST /api/onboarding/finish` (`apps/server/src/routes/onboarding.ts`). Verifies the Supabase access token via `supabaseAdmin.auth.getUser(token)` (helper at `apps/server/src/auth/verifyUser.ts`), runs `expandSelections()` against the static `quran-index.json` to turn user-friendly selections into row-level arrays, then calls a single Postgres function.
2. **Postgres function** `commit_onboarding(p_student_id uuid, p_payload jsonb)` — `SECURITY DEFINER`, `set search_path = public`, granted only to `service_role` (migration 0013). Performs all four-table writes in one PL/pgSQL block. All inserts use `on conflict do nothing` so the function is safe to retry.

Selection expansion happens server-side because the canonical `quran-index.json` lives next to the function call site; the web app may surface a UI preview later but the server is authoritative.

## Consequences
- ✅ Single transaction across `memorization_page`, `memorization_verse`, `ayah_review_state`, `student_settings`, `app_user`.
- ✅ Service-role write to `ayah_review_state` without weakening client RLS.
- ✅ DESIGN.md §6.3 patched in same commit so future drift doesn't reappear.
- ⚠️ The Express server is now a required dependency of onboarding — the web app cannot complete onboarding offline (it never could write `ayah_review_state` anyway, but the dependency is now an external HTTP hop).
- ⚠️ Selection expansion logic exists only on the server; if a future "preview your selections" UI lands client-side, the expansion code will need to live in `@tahfeedh/shared` to avoid drift.
