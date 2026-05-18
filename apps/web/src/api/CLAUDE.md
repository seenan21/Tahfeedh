# apps/web/src/api/

Thin client for the Express backend at `apps/server`. Reads `VITE_API_BASE_URL` (default `http://localhost:3001`).

## Index

| File | What | When to read |
|---|---|---|
| `client.ts` | `apiFetch<T>(path, init)` — auto-injects `Authorization: Bearer <supabase access token>` so the server can verify the caller via `supabaseAdmin.auth.getUser(token)` | Calling any `/api/*` endpoint from the web |
