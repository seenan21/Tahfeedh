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
