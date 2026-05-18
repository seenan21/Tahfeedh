# apps/server

Express backend. Two reasons it exists (DESIGN.md §4):
1. **Service-role writes** to derived tables (`ayah_review_state`, `error_location_stats`) that client RLS denies. Onboarding finish (ADR 0008) is the first; post-test pipeline (Phase D) is next.
2. **QF API proxy** to keep `QF_CLIENT_SECRET` off the browser and centralize OAuth.

## Index

| Path | What | When to read |
|---|---|---|
| `src/` | All server source | Any backend work |
| `package.json` | Server deps (`express`, `@supabase/supabase-js`, `openid-client`, `zod`, …) | Adding a runtime dep |
| `tsconfig.json` | TS config (`NodeNext` ESM) | Adjusting compile target |
| `.env.example` | Documents required + optional env vars | Setting up a fresh checkout |

## Operational

```
npm run dev --workspace=@tahfeedh/server         # tsx watch on :3001
npm run typecheck --workspace=@tahfeedh/server
```
