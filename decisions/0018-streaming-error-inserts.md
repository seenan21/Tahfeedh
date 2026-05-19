# 0018 — Streaming Error Inserts (Per-Tap POST)

**Date:** 2026-05-19
**Status:** Implemented
**Milestone:** M4 (Phase D)

## Context
During a live test, every tap on a mushaf word produces an `error_log` row. Two shapes:
- (a) **Batch on submit:** keep all errors in client React state until the user ends the test; `POST /api/tests/:id/finish` writes them transactionally.
- (b) **Stream per error:** each modal submit hits `POST /api/tests/:id/error` immediately, inserting one row.

Batching is one fewer network round-trip per error and avoids any half-written test, but it loses every error if the browser crashes mid-test (a real risk on phones during long revision tests). Streaming sacrifices some chattiness for durability and lets the right-pane error list be sourced from the DB if needed.

## Decision
Stream per error. The live-test session hook (`apps/web/src/features/live-test/useTestSession.ts`) calls `POST /api/tests/:id/error` per modal submit. The endpoint verifies bearer + ownership + that the test is `in_progress`, then inserts a single `error_log` row using the service-role client (which bypasses RLS — the route is the gate). The submit/finish endpoint (`POST /api/tests/:id/finish`) reads from `error_log` directly via the `submit_test` SQL function; no error payload travels in the finish body.

## Consequences
- ✅ Errors survive tab crashes / network blips. A reopened test continues where it left off.
- ✅ The right-pane list and the future error-detail modal can both read from the same canonical source (`error_log`) if local state is lost.
- ✅ The `error_log.signature` GENERATED column computes once at insert time.
- ⚠️ N+1 HTTP requests per test (one per error). For a typical 5–15 errors per test that's well within budget. Bulk endpoint would only help at extreme densities — not worth the duplication of validation logic.
- ⚠️ An abandoned test leaves orphan `error_log` rows. They're scoped to that test by FK; cleaning up abandoned tests later in M5 sweeps them with cascade delete or `status='abandoned'`.
