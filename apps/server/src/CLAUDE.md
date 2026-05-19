# apps/server/src/

## Index

| Path | What | When to read |
|---|---|---|
| `index.ts` | Express bootstrap: CORS, JSON, cookie-parser, `/health`, route mounting, error middleware, listen | Mounting a new router, changing top-level middleware |
| `env.ts` | dotenv loader + `required()` / `optional()` env helpers; exports a typed `env` object | Adding a new env var |
| `supabase.ts` | `supabaseAdmin` client using `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS; never expose to the browser | Anywhere you need to write derived tables or verify a user token |
| `routes/` | Express routers mounted under `/api/*` | Adding a new endpoint |
| `auth/` | Helpers that consume the caller's Supabase bearer token | Verifying who's calling an endpoint |
| `onboarding/` | Pure expansion logic — selections → row-level payload for the SQL function | Touching how onboarding selections become rows (ADR 0008) |
| `memorization/` | Pure expansion logic — pageNumber → ayahs-on-page, isAyahOnPage validator. Reserved for the Phase D post-test pipeline and the future Edit-Memorization flow (ADR 0015) | Touching page → ayah expansion or wiring the post-test pipeline |
| `qf/` | Quran Foundation API client (token cache + Content API fetchers) | Calling QF endpoints from the server |
| `data/` | Generated `quran-index.json` copy for server-side range expansion (ADR 0007) | Don't hand-edit. Regenerate via `npm run build:quran-index` |
| `algorithm/` | **Stub** — session plan / queue logic lands in M5 | Building the algorithm in M5 |
| `pipelines/` | **Stub** — post-test pipeline lands in Phase D / M4 | Building the post-test transaction in Phase D |
