# supabase/

Supabase project assets. Currently just migrations — `supabase/config.toml` and seed files are not yet in repo (managed via the hosted dashboard + the MCP server).

## Index

| Path | What | When to read |
|---|---|---|
| `migrations/` | Numbered SQL migrations 0001–0013 | Adding a schema change, debugging RLS, looking up a table or function definition |

## Operational

Apply a new migration via the Supabase MCP server (`mcp__supabase__apply_migration`) or, for local dev, `supabase db push`. Migrations are numbered and applied in order. See `decisions/0008-onboarding-bulk-write-via-express.md` for the convention around SECURITY DEFINER functions called from Express.
