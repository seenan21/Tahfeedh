# apps/web/src/lib/

Browser-side utilities. No JSX, no React — pure modules.

## Index

| File | What | When to read |
|---|---|---|
| `supabase.ts` | `createClient` instance using Vite env vars; `persistSession: true` | Anywhere you need to query Supabase directly from the browser |
| `auth.ts` | `getCurrentUser`, `signUpWithRole`, `signIn`, `signOut`, `homeRouteForRole`, `landingRouteForUser`, `formatAuthError`, `CurrentUser` type | Anywhere you touch the session, sign someone in/out, or route based on user state |
| `numerals.ts` | `toArabicIndic(n)` — converts integers to `٠١٢٣٤٥٦٧٨٩` per DESIGN-SYSTEM §8 (Quranic numerals only; UI counts stay Western) | Rendering a juz/surah/ayah/page number in an Arabic context |
