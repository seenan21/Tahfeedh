# apps/web

Vite + React + Mantine v7 + TanStack Router frontend. Imports `@tahfeedh/shared`. Uses Supabase JS for direct DB reads under RLS; reaches Express only for service-role-required writes (currently just `/api/onboarding/finish`).

## Index

| Path | What | When to read |
|---|---|---|
| `src/` | All app source (routes, components, lib, data, styles) | Any frontend work |
| `public/` | Static assets served as-is, including downloaded QPC V2 fonts under `fonts/v2/` | Adding a top-level static file or debugging font 404s |
| `package.json` | Web app dependencies | Adding a runtime dep |
| `tsconfig.json` | TS config (extends `tsconfig.base.json`) | Adjusting compile target for web |
| `vite.config.ts` | Vite + React plugin + TanStack Router plugin | Adjusting the dev server port, build options |
| `.env.example` | Documents the Vite env vars the app reads | Setting up a fresh checkout |

## Operational

```
npm run dev --workspace=@tahfeedh/web   # dev server on :5173 (auto-falls through to :5174 if taken)
npm run typecheck --workspace=@tahfeedh/web
```
