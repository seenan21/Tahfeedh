# decisions/

Architecture Decision Records. Numbered, append-only. See `CLAUDE.md` at repo root for the ADR ritual.

## Index

| File | What | When to read |
|---|---|---|
| `0001-using-adr-format.md` | Establishes the ADR convention | Answering "why do we capture decisions at all?" |
| `0002-mushaf-data-source.md` | Picks api.quran.com v4 (open) over QUL SQLite | Touching `scripts/build-quran-data.ts` or page-data shape |
| `0003-per-page-qpc-v2-fonts.md` | 604 page-scoped fonts, one per mushaf page | Touching font loading, `quran-fonts.css`, or `MushafPage` font wiring |
| `0004-guest-witnessed-tests.md` | Adds guest_teacher test_mode + student-write RLS path | Building the test creation flow, RLS work on `test` |
| `0005-authed-layout-route.md` | Pathless `_authed` layout owns the gate + AppShell | Adding a protected route, changing the auth gate |
| `0006-half-page-numeric.md` | `pages_per_session_new` is NUMERIC(3,1), bounded 0.5–20 | Touching session-size settings or half-page algorithm |
| `0007-quran-index-build-artifact.md` | `quran-index.json` is the derived lookup for ranges | Touching range-expansion logic, juz-progress, or the index shape |
| `0008-onboarding-bulk-write-via-express.md` | Onboarding finish goes through Express + SQL function | Touching `commit_onboarding`, the finish endpoint, or RLS on derived tables |
| `0009-silkbackground-entry-points-only.md` | SilkBackground only on /login, /signup, / | Adding R3F surfaces or deciding where motion belongs |
| `0010-modernize-shell-visuals.md` | Allows same-anchor gradients + glass header inside the app shell | Reaching for a new gradient/depth treatment in app-shell screens |
| `0011-error-overlay-merge-at-render-time.md` | Errors merge at marker computation, not at storage — `error_log` stays an immutable occurrence list | Touching mushaf overlay rendering, marker computation, or the error detail modal |
| `0012-memorization-marking-endpoint.md` | **Superseded by 0015.** The marking endpoint was built then removed; the SQL fn is reserved for the post-M8 Edit Memorization flow | Wiring the future Settings recalibrate flow |
| `0013-next-new-lesson-rpc.md` | Queue 1 lives in Postgres as `next_new_lesson(uuid)` RPC | Touching the new-lesson slot on Today or the algorithm in M5 |
| `0014-hifz-direction-preference.md` | `hifz_direction` ('forward' Baqarah-first vs 'backward' Juz-Amma-first) on `student_settings`; `next_new_lesson` honors it | Touching Queue 1, onboarding step 1, or settings page direction toggle |
| `0015-memorization-status-test-driven.md` | Post-onboarding, `memorization_page.status` only changes via the post-test pipeline; the marking UI was removed | Resisting "let me just mark this page" UI temptations; planning the future Edit-Memorization flow |
| `0016-mushaf-rendering-fix.md` | Mushaf line layout uses `direction: rtl` + justified flex; no `row-reverse` (it caused a BiDi double-reversal that rendered LTR) | Touching `MushafPage` layout, debugging RTL/justification issues |
| `0017-post-test-pipeline-one-fat-fn.md` | Post-test pipeline is one SECURITY DEFINER PL/pgSQL function `submit_test(uuid, jsonb)` invoked by Express, mirroring `commit_onboarding` | Touching the post-test pipeline, mastery promotion (M5), or fail-downgrade |
| `0018-streaming-error-inserts.md` | Errors stream via `POST /api/tests/:id/error` per tap (not batched on finish) — durable against tab crashes | Touching the live-test session hook or error_log write path |
| `0019-overlay-client-side-merge.md` | `getOverlayMarkers` runs client-side from cached `error_location_stats`; no dedicated RPC | Touching overlay rendering, heatmap/colored modes, error detail modal |
| `0020-frozen-daily-session.md` | Today's session plan is persisted in `daily_session` and frozen for the day; explicit "Load next session" CTA inserts the next index | Touching the session machine, Today plan card, or revision ordering |
| `0021-tests-landing-shows-recent-history.md` | Tests landing shows a 30-day activity sparkline + the last 15 completed tests as clickable rows | Touching the tests landing layout or history surfaces |
| `0022-test-recap-route-and-persisted-summary.md` | `/tests/:id/recap` read-only route + `test.summary jsonb` persisted by `submit_test` so historical NEW/RECURRING/CLEARED stays truthful (extends ADR 0017) | Touching the recap surface, the post-test pipeline, or the live-test "already completed" redirect |
| `0023-error-detail-modal-design.md` | M7 error detail modal lists every individual `error_log` occurrence at the tapped location; `cleared = true` rows are hidden by default behind a "ghost errors — show" reveal | Building the error detail modal in M7, touching ghost-error visibility |
