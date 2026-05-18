# apps/server/src/auth/

## Index

| File | What | When to read |
|---|---|---|
| `verifyUser.ts` | `verifyUser(req)` reads `Authorization: Bearer <jwt>`, calls `supabaseAdmin.auth.getUser(token)`, returns `{ id, email }` or throws `AuthError(401)` | Every protected endpoint should call this first — copy the pattern from `routes/onboarding.ts` |
