# apps/server/src/qf/

Quran Foundation API integration. QF Content API auth uses `x-auth-token` + `x-client-id` headers (NOT `Authorization: Bearer`). QF User API tokens are per-user OAuth2 + PKCE; storage lives in `qf_user_token` table, never in the browser.

## Index

| File | What | When to read |
|---|---|---|
| `tokens.ts` | In-memory `client_credentials` token cache for QF Content API. Refreshes 60s before expiry | Debugging QF Content auth or extending the cache pattern |
| `content.ts` | Content API fetchers: `listChapters`, `searchAyahs(q, size)`. Wraps `qfContentFetch` which injects QF headers | Calling a new QF Content endpoint — copy the wrapper pattern |
| `userTokens.ts` | DB-persisted per-user OAuth2 token cache (`qf_user_token` table). `getUserAccessToken(userId)` refreshes via the `refresh_token` grant when within 60s of expiry. Mirrors the in-memory cache pattern from `tokens.ts` (ADR 0040) | Adding a QF User-API call that needs a bearer token; debugging refresh-flow failures |
| `bookmarks.ts` | `addBookmark(userId, {surah, ayah})` — resolves/creates a per-user `Tahfeedh` collection on QF (in-memory cache; falls back to `__default__`), then POSTs the bookmark. Fire-and-forget; errors swallowed. Used only by the explicit-bookmark button per ADR 0045 (auto-pushes from onboarding + tests were removed) | Touching the bookmark write path, the Tahfeedh-collection resolver, or wiring a new explicit-bookmark surface |

> `notes.ts` was deleted (ADR 0044) — `note.create` scope is not granted by the QF app config. Teacher notes stay local-only on `error_log.teacher_note`. Restore from git history if/when the scope is granted.
