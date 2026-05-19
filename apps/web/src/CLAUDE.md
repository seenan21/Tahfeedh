# apps/web/src/

## Index

| Path | What | When to read |
|---|---|---|
| `main.tsx` | App entry, MantineProvider + router init | Wiring providers, changing the router root |
| `routes/` | TanStack file-based routes (public + `_authed` layout) | Adding a page, changing auth gating, role-based redirects |
| `components/` | Cross-route reusable components (sidebar, hero, empty state, silk) | Reaching for a shared UI primitive |
| `onboarding/` | The 3-step onboarding flow (state reducer + step components) | Touching onboarding UX |
| `today/` | Today-view-specific components (streak, juz grid, slot card, new-lesson card) | Touching the Today layout |
| `mushaf/` | Mushaf renderer, 604-page grid, marking modal | Touching the mushaf surface (Phase C) |
| `lib/` | Browser-side utilities (Supabase client, auth helpers, numerals) | Adding a low-level utility |
| `api/` | Backend API client (`apiFetch` with Supabase bearer-token injection) | Calling `apps/server` from the web |
| `data/` | Static Quran data + accessor helpers (`metadata.json`, `quran-index.json`, `pages/`) | Reading mushaf data or the derived index |
| `styles/` | Global CSS: Google Fonts + per-page QPC fonts + bilingual utility classes | Touching fonts or global styles |
