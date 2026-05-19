# 0012 — Memorization Marking via Express + SQL Function

**Date:** 2026-05-18
**Status:** Superseded by ADR 0015 (memorization status is test-driven). The SQL function `mark_memorization(uuid, jsonb)` remains in the DB from migration 0014 but no route or UI exposes it; it is reserved for the post-M8 "Edit Memorization / Recalibrate" settings flow.
**Milestone:** M2 / M3 (Phase C — endpoint built and then removed)

## Context
Phase C (PLAN.md task 9) adds an in-app way to mark a mushaf page as memorized, in-progress (with partial verses), or untouched. Three tables must move together:

1. `memorization_page` — upsert / delete the page row with the new `status`.
2. `memorization_verse` — for `in_progress` half-page state, the chosen ayah set is written here.
3. `ayah_review_state` — newly-memorized pages need a row per covered ayah so the algorithm sees them (RLS denies client writes here; see 0008_rls.sql:99).

`memorization_page` and `memorization_verse` are client-writable under RLS (`mp_modify` and `mv_modify` policies), but `ayah_review_state` is not. The instant marking touches a "memorized" page we cross into service-role territory. Doing two of the three writes client-side and one server-side splits the transaction across the network boundary and breaks atomicity.

This is the same shape we solved at onboarding-finish: ADR 0008's two-tier handler (Express endpoint + SECURITY DEFINER SQL fn). The marking path reuses that pattern verbatim.

## Decision
Add a single endpoint `POST /api/memorization/mark` and a single SQL function `mark_memorization(p_student_id uuid, p_payload jsonb)`.

Endpoint shape (one call per page; payload describes the target state, not a diff):

```jsonc
{
  "pageNumber": 50,
  "status": "memorized" | "in_progress" | "untouched",
  // Required when status === 'in_progress'; ignored otherwise.
  // The client picks "first half" / "second half" / "custom" and resolves the
  // explicit ayah list against the page's midpoint_ayah_break before sending.
  "verses": [{ "surah": 2, "ayah": 142 }, ...]
}
```

SQL function behavior, in one PL/pgSQL transaction:

- `memorized`: upsert `memorization_page` to `memorized`; delete any `memorization_verse` rows for the page (a fully memorized page does not carry partial state); insert `ayah_review_state` for every ayah on the page (`on conflict do nothing`, recent_stage NULL — pre-graduated, same as `commit_onboarding`).
- `in_progress`: upsert `memorization_page` to `in_progress`; replace `memorization_verse` rows for the page (delete then insert the provided set); insert `ayah_review_state` for the provided ayahs (`on conflict do nothing`).
- `untouched`: delete the `memorization_page` row and any `memorization_verse` rows for the page. **Do NOT delete `ayah_review_state`** — the algorithm treats those as historical signal even if a page is later un-marked; this matches `commit_onboarding`'s "stale_ts = now() − 30d" convention.

Set of ayahs on a page is derived server-side from `quran-index.json` (the same data source onboarding uses). The client sends only `pageNumber + status [+ verses]` — it does not know the full ayah set.

Grants: `revoke … from anon, public, authenticated; grant execute … to service_role;` — mirrors `commit_onboarding` (0013).

## Consequences
- ✅ One transaction across all three tables; partial failures impossible.
- ✅ Service-role write to `ayah_review_state` without weakening client RLS.
- ✅ Endpoint contract is forward-compatible: post-test pipeline (Phase D) can call the same SQL function when a `strong_pass` graduates a page to `memorized` — the marking endpoint just becomes the user-facing entry point.
- ⚠️ The Express server is now also required to mark pages; no offline marking. Acceptable for hackathon timeline.
- ⚠️ The ayah-set-for-page expansion lives only on the server. If the UI later wants to preview what will be written, the page-ayah expander needs to move to `@tahfeedh/shared` (same caveat as ADR 0008).
