# 0040 — QF User API OAuth (PKCE) + Bookmarks + Goals + Streak Swap

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M8

## Context
The hackathon's "Effective Use of APIs" criterion (15 pts) requires at least
one Content + one User API integration. We already had Content (`/chapters`,
`/search` proxies). M8 lights up the User side: connect via OAuth2 +
Authorization Code + PKCE, store tokens server-side, and surface multiple
distinct scopes in visible places. Tokens already had a table
(`qf_user_token`, migration 0005) and `openid-client` was installed but
unused; this ADR records how we finally wired it.

## Decision

**Scopes requested at /authorize:**
`openid offline_access profile bookmark goal streak.read reading_session.create`

(`reading_session.create` was requested for future activity-day-back-to-QF
work; this ADR ships read of streak + write of bookmarks + write of goals.)

**Stateless OAuth state.** The PKCE verifier travels in the `state` query
parameter, HMAC-signed with `SESSION_SECRET` and including
`{ userId, verifier, exp, nonce }`. Cookies were rejected — cross-origin
cookies between the web app (`:5173`) and the server (`:3001`) require
`SameSite=None; Secure`, which fails over HTTP in dev. The signed-state
trick avoids cookies entirely while still binding the round-trip to the
caller's userId (extracted server-side after verifyUser at `/authorize`).
The HMAC's 10-minute `exp` and `nonce` provide replay protection.

**Endpoints (`apps/server/src/routes/qfAuth.ts`):**
- `POST /api/qf-auth/authorize` — bearer-protected; returns the QF authorize URL.
- `GET  /api/qf-auth/callback` — public; verifies signed state, exchanges
  the code + verifier via the `authorization_code` grant, UPSERTs into
  `qf_user_token`, redirects browser to `/today?qf=connected|error`.
- `GET  /api/qf-auth/status` — bearer-protected; returns
  `{ connected, expires_at?, scope? }`. Avoids granting client-side
  SELECT on `qf_user_token` so the original 0008 RLS posture
  ("service-role only") stays intact.
- `POST /api/qf-auth/disconnect` — bearer-protected; DELETEs the row.

**Token persistence + refresh.** `apps/server/src/qf/userTokens.ts`:
- `readUserTokenRow`, `writeUserTokenRow` (UPSERT on user_id), `deleteUserTokenRow`.
- `getUserAccessToken(userId)` — returns a fresh token, calling the
  `refresh_token` grant when the stored token is within 60 seconds of
  expiry. Writes the refreshed pair back. Mirrors the in-memory cache
  pattern in `apps/server/src/qf/tokens.ts` (client-credentials), adapted
  for per-user DB-persisted tokens.

**Streak swap.** When connected, the Today `StreakBadge` replaces the local
`daily_streak()` value with the QF QURAN streak (`days` field from
`GET /streaks`). The QF accent color (`#0E7C5C`) and a "via quran.com"
sublabel tell the user the number's source. If the QF call errors or
returns no streak, the badge silently falls back to local. Two parallel
`useQuery` keys (`['daily_streak', studentId]` + `['qf-streak', studentId]`)
keep the local read warm so disconnect/error never strands the user
without a number.

**Bookmarks write-through.** `apps/server/src/qf/bookmarks.ts`:
`pushBookmark(userId, {surah, ayah})` is fire-and-forget — silently no-ops
if the user isn't connected, catches and logs all HTTP errors.
- Called after `commit_onboarding` for the `inProgress` marker (if set).
- Called after `submit_test` for the highest-numbered covered ayah —
  represents "the student's frontier after this test." One call per
  test finish, regardless of how many pages were exercised.
- Per DESIGN.md §13.6: errors here must never fail the transaction. The
  fire-and-forget pattern uses `void` to mark the unawaited promise so
  linting catches accidental awaits.

**Goals page.** `apps/web/src/routes/_authed.goals.tsx` (replaces the
EmptyState placeholder). Local `goal` table is the source of truth;
QF is a secondary write-through:
- Create: INSERT locally → if connected, `POST /api/qf-user/goals` →
  PATCH local row with returned `qf_goal_id`.
- Delete: DELETE locally → if `qf_goal_id`, fire-and-forget
  `DELETE /api/qf-user/goals/:id`.
- The local UI shows a "Quran.com" badge when `qf_goal_id IS NOT NULL`.

**Today CTA banner.** `ConnectQuranComBanner.tsx` mounts above the hero on
`/today` for disconnected students. Quran.com-brand-aligned styling
(`#0E7C5C` accent against parchment). Per-session dismissible via
`sessionStorage.qfBannerDismissed='1'` — re-prompts on next visit so the
prompt isn't a permanent annoyance but also isn't easily forgotten.

**Settings card.** `ConnectQuranCom.tsx` is the management surface:
disconnected → same Connect button as the banner; connected → status pill,
scope chips (Bookmarks · Goals · Streak), token-expiry hint, Disconnect
button. Connect/disconnect both invalidate the shared `['qf-auth-status']`
query so the banner + StreakBadge + Goals page sync hint all update
simultaneously.

## Consequences
- ✅ Three QF User API scopes wired (`bookmark`, `goal`, `streak.read`).
  Combined with the existing Content API (`/chapters`, `/search`), the
  submission honestly claims dual-API integration.
- ✅ User-visible integration in three places (Today banner + Today streak
  badge + Goals page) — judges/demo viewers can see the connection working.
- ✅ Zero new migrations. `qf_user_token` and `goal.qf_goal_id` were
  already there; `qf_user_token` RLS stays service-role-only via the
  status endpoint pattern.
- ✅ Stateless state encoding makes the OAuth flow work in dev over HTTP.
- ⚠️ Bookmarks / Goals payload shapes are best-effort. The public QF docs
  don't surface exact JSON schemas for these endpoints; we send a
  reasonable set of fields, log non-OK responses, and don't surface
  failures to the user (per fire-and-forget). To be verified against the
  live QF account during demo prep.
- ⚠️ `state` JWT-like format is custom (HMAC + base64url). It's
  effectively a stripped-down JWS. Standard libraries (`jose`) would be
  cleaner; left as-is to avoid a new dep.
- ⚠️ Streak swap is a hard replace, not a merge. If a student's QF streak
  is 0 but their Tahfeedh streak is 7, the badge shows 0 with "via
  quran.com." Documented as acceptable: the streak swap conveys "this is
  what your connected Quran.com account thinks." Future iteration could
  ship a merged view (e.g. `max(local, qf)`).

## Reverses
(none — extends 0008, 0017, and DESIGN.md §11.2 — the §11.2 endpoint table
will be patched to add `streak` and `reading_session` rows during wrap-up.)
