# 0044 — QF OAuth Scope Set Trimmed to What the Client Is Granted

**Date:** 2026-05-20
**Status:** Implemented
**Milestone:** M8

## Context
The OAuth flow started failing with
`error=invalid_scope … client is not allowed to request scope 'note.create'`.
`note.create` had been added to SCOPES when teacher-note sync was wired in,
but the QF app config tied to this `client_id` doesn't grant it.

To find out which scopes actually work, we probed `/oauth2/auth?scope=…`
one scope at a time against this client_id and parsed the redirect's
`error` query param.

## Decision

**Empirical scope grants for this client_id:**

| Scope | Result |
|---|---|
| `bookmark` | granted |
| `goal` | granted |
| `streak.read` | granted |
| `openid` | granted |
| `offline_access` | granted |
| `content` | granted |
| `note.create` | **denied** |
| `reading_session.create` | **denied** |
| `profile` | **denied** |

Trim SCOPES in `apps/server/src/routes/qfAuth.ts` to the three granted
user scopes we actually use: `bookmark`, `goal`, `streak.read`. OIDC
scopes (`openid`, `offline_access`) aren't added back — refresh tokens
already arrive without them on this OAuth server, and adding them would
expand the consent screen without functional benefit.

Remove the `pushNote` invocation from `apps/server/src/routes/tests.ts`
and delete `apps/server/src/qf/notes.ts`. The teacher-note column on
`error_log` remains intact and is still surfaced in `ErrorDetailModal`
and the recap view — it's just local-only until `note.create` is granted.

## Consequences
- ✅ OAuth flow unblocked. The user's previously-failing connect attempt
  now redirects to the QF consent screen.
- ✅ ADR 0040's three-User-API claim (bookmark + goal + streak.read)
  still holds — those were always the demonstrable user-API integrations.
- ⚠️ Teacher notes no longer round-trip to Quran.com. If/when the QF app
  config is updated to grant `note.create`, restore `qf/notes.ts` from
  git history and re-wire the `pushNote(...)` call at `tests.ts` around
  the `error_log` insert.
- ⚠️ `reading_session.create` and `profile` are similarly off the table;
  any feature design that depended on them needs the scope grant first.

## Reverses
(extends 0040 — the scope list there is the original superset; this ADR
records the empirically-allowed subset.)
