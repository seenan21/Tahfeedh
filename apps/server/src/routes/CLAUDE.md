# apps/server/src/routes/

Express routers mounted by `apps/server/src/index.ts` under `/api/*`. Convention: each router uses `next(err)` for unexpected errors; auth errors are short-circuited inline.

## Index

| File | Mount | What | When to read |
|---|---|---|---|
| `qf.ts` | `/api/qf` | Proxies to QF Content API: `GET /chapters`, `GET /search?q=…&size=…` | Adding a QF endpoint, debugging QF auth |
| `onboarding.ts` | `/api/onboarding` | `POST /finish` — verifies bearer token, expands selections, RPCs `commit_onboarding` (ADR 0008) | Touching onboarding finish behavior or adding related endpoints |
| `tests.ts` | `/api/tests` | `POST /create` (inserts in_progress test), `POST /:id/error` (streaming per-tap `error_log` insert, ADR 0018), `POST /:id/finish` (resolves ranges, RPCs `submit_test`, ADR 0017) | Touching the live-test creation, error logging, or post-test pipeline orchestration |
