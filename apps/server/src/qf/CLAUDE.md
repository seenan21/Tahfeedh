# apps/server/src/qf/

Quran Foundation API integration. QF Content API auth uses `x-auth-token` + `x-client-id` headers (NOT `Authorization: Bearer`).

## Index

| File | What | When to read |
|---|---|---|
| `tokens.ts` | In-memory `client_credentials` token cache for QF Content API. Refreshes 60s before expiry | Debugging QF auth or extending to QF User API tokens |
| `content.ts` | Content API fetchers: `listChapters`, `searchAyahs(q, size)`. Wraps `qfContentFetch` which injects QF headers | Calling a new QF Content endpoint — copy the wrapper pattern |
