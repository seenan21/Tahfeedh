# 0009 — SilkBackground Confined to Entry-Point Routes

**Date:** 2026-05-18
**Status:** Implemented
**Milestone:** M3

## Context
DESIGN-SYSTEM.md §5 mandates that the animated silk shader appears only on entry points (login, signup, landing) so it reads as a "moment of arrival" rather than ambient noise that competes with the mushaf and dense screens. Phase A shipped auth pages on flat mihrab; the silk was deferred.

## Decision
- Build `apps/web/src/components/SilkBackground.tsx` as a self-contained R3F component: orthographic camera, single full-screen plane, custom fragment shader with layered noise + vignette in mihrab/sage tones. Fixed-position, `pointer-events: none`, `z-index: 0`.
- Mount it explicitly on `/login`, `/signup`, and `/` only. Do **not** mount in `__root.tsx` or `_authed.tsx`.
- Pair with the bilingual hero pattern (`BilingualHero`) and `IntroHadith` quote on the auth screens per DESIGN-SYSTEM §8.
- `/onboarding` and `_authed/*` routes keep a flat `mihrab.9` background — onboarding is a working flow, not arrival; app-shell screens need the cream cards to do the visual work.

Dependencies: `three`, `@react-three/fiber@^8` (the 8.x line is the React 18-compatible release; 9.x requires React 19), `lucide-react`.

## Consequences
- ✅ Auth screens carry the brand's "soul" without imposing motion on data-dense surfaces.
- ✅ Component is self-contained; future entry-point routes (e.g., empty-state landing for a brand-new teacher) opt in with a single import.
- ⚠️ Adds three.js + R3F to the web bundle (~150 kB gzipped). Acceptable for entry routes; if it ever loads on a route that doesn't render it, we'll switch to lazy import.
- ⚠️ R3F 8.x is locked until we move to React 19; the major bump is tracked but not scheduled.
