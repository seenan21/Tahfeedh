# apps/web/src/components/

Cross-route components. Route-specific components live next to their route (e.g. `today/`, `onboarding/`).

## Index

| File | What | When to read |
|---|---|---|
| `AppSidebar.tsx` | Role-aware icon-rail nav. 64px collapsed (icons + tooltips); hover/focus expands to 268px overlay panel positioned over the main content (no resize, no push). CSS module + `useMatchRoute` drive active state via `[data-active]` (ADR 0010) | Adding a nav item, changing active styling, debugging hover-sticks |
| `AppSidebar.module.css` | `.railWrap` reserves 64px in AppShell.Navbar; `.rail` grows from 64px → 268px on `:hover` / `:focus-within` with z-index 50 + box-shadow so it overlays content. Brand mark, label fade-in transitions, three-state nav item rules | Tweaking sidebar visuals, hover-expand timing, or the rail-overlay overlap |
| `BilingualHero.tsx` | Paired Arabic-above-English heading (Cairo + Playfair) | Adding a hero on a new screen (DESIGN-SYSTEM §8) |
| `IntroHadith.tsx` | Hadith on Quran retention (Bukhari 5033) in Scheherazade New + English citation | Reusing on entry-point screens |
| `EmptyState.tsx` | Hero empty-state card: iconHalo, tag chip, bilingual title, helper. Used on every stub route | Building a route that has no data yet, or a moment-of-arrival surface |
| `EmptyState.module.css` | iconHalo glow, fade-in scale, halo card styling | Tweaking empty-state visuals |
| `SilkBackground.tsx` | R3F + custom shader silk for entry-point routes only (login/signup/index) (ADR 0009) | Adding a new entry-point surface |
