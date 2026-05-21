# apps/server/src/routes/

Express routers mounted by `apps/server/src/index.ts` under `/api/*`. Convention: each router uses `next(err)` for unexpected errors; auth errors are short-circuited inline.

## Index

| File | Mount | What | When to read |
|---|---|---|---|
| `qf.ts` | `/api/qf` | Proxies to QF Content API: `GET /chapters`, `GET /search?q=…&size=…` | Adding a QF Content endpoint or debugging Content-API auth |
| `qfAuth.ts` | `/api/qf-auth` | OAuth2 + PKCE flow against `oauth2.quran.foundation`: `POST /authorize` (returns auth URL + HMAC-signed state holding `{userId, verifier, exp, nonce}`), `GET /callback` (exchanges code + persists tokens), `GET /status`, `POST /disconnect`. Stateless state encoding avoids cross-origin cookie issues in dev (ADR 0040). Scopes per ADR 0044: `bookmark`, `goal`, `streak.read` | Touching the OAuth round-trip, the state encoding, or the scope set |
| `qfUser.ts` | `/api/qf-user` | Per-user QF API proxies: `GET /streak` (QURAN streak), `POST /goals` + `DELETE /goals/:qfGoalId` (write-through to QF Goals), `POST /bookmarks` (explicit bookmark add per ADR 0045 — invokes `qf/bookmarks.addBookmark`). All routes verify the Supabase bearer + look up the user's QF token via `qf/userTokens` | Adding a User-API endpoint, debugging streak/goals/bookmark proxy behavior |
| `onboarding.ts` | `/api/onboarding` | `POST /finish` — verifies bearer token, expands selections, RPCs `commit_onboarding` (ADR 0008). Per ADR 0045, no longer auto-pushes a bookmark | Touching onboarding-finish behavior or adding related endpoints |
| `tests.ts` | `/api/tests` | `POST /create` (inserts in_progress test), `POST /:id/error` (streaming per-tap `error_log` insert, ADR 0018), `POST /:id/finish` (resolves ranges, RPCs `submit_test`, ADR 0017). Per ADR 0045, no longer auto-pushes a bookmark on finish. Per ADR 0044, no longer round-trips the teacher note to QF | Touching test creation, error logging, or post-test orchestration |
