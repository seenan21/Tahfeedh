# Tahfeedh — Design System

> Source of truth for tokens, type, components, and bilingual rules. The Mantine theme in `apps/web/src/styles/theme.ts` is the runtime expression of this doc — if they diverge, update both.

## 1. Design DNA (the one-paragraph version)

Cream cards float on a dark, mihrab-green ground. Primary actions invert the palette: dark-green pill buttons with cream text. Selection has three explicit states (rest → hover → selected) and selectable surfaces always show their affordance (a checkbox, not just a color change). Six fonts are used with discipline — each has exactly one job, English and Arabic kept on parallel typographic tracks. No gradients, no decorative icons, no emoji. Quranic content appears in two distinct modes: **quotations** (Scheherazade New) for hadith/ayah references in the UI, and the **mushaf** (QPC Hafs V2) scoped strictly to the renderer.

## 2. Color tokens

All colors are defined as Mantine 10-stop tuples in `theme.ts`. Reference them as `mihrab.9`, `parchment.0`, etc.

| Token | Hex | Use |
|---|---|---|
| `mihrab.9` | `#15351E` | App background, body text on cream, primary button bg |
| `mihrab.7/8` | `#1f4530` / `#193b27` | Hover / pressed for dark surfaces |
| `mihrab.0-3` | tints | Subtle borders, dividers on cream cards |
| `parchment.0` | `#FFFFC1` | Card backgrounds, primary button text |
| `parchment.5-7` | `#cccc5d` → `#8b8b3a` | Muted text on cream, faded labels |
| `white` | `#FFFFFF` | Inner/nested cards on top of cream |
| `sage.4` | `#7ea087` | "Memorized" status |
| `sage.7` | `#3d6b4c` | "Mastered" status (pair with star icon) |
| `honey.4` | `#e5b836` | "In-progress" status |
| `brick.6` | `#8b3325` | Omission errors, destructive UI |
| `gray.2` | (Mantine) | "Untouched" status, unselected borders |

### Error-type palette (8 tokens)

Mapped in `errorTypeColors`. All chosen to read on `parchment.0` without vibrating.

| Type | Token | Note |
|---|---|---|
| Tajweed | `indigo.7` | Scholarly slate-blue |
| Pronunciation | `honey.5` | Warm, attention without alarm |
| Omission | `brick.6` | Muted brick (not Mantine red) |
| Addition | `grape.6` | Restrained violet |
| Mismatch | `orange.7` | Terracotta |
| Wrong verse | `pink.7` | Muted rose |
| Forgotten verse | `brick.8` | Deepest red — most severe |
| Hesitation | `gray.6` | Neutral; treat as soft signal |

### The three-color rule

Any given screen should show **mihrab + parchment + one accent**. The accent is either selection-green, a single status color, or a single error-type color. If three accent colors appear in the same viewport you've broken the discipline — collapse two of them into a single category or move one offscreen.

## 3. Typography

| Role | Font | Weight | Size | Use |
|---|---|---|---|---|
| `h1` display EN | Playfair Display | 700 | 36px | Page hero titles |
| `h1` display AR | Cairo | 700 | 36px | Arabic pairing for hero titles |
| `h2/h3` header EN | Montserrat | 500 | 24/20px | Card titles, section headers |
| `h2/h3` header AR | Amiri | 700 | 24/20px | Arabic card titles |
| body EN | Roboto | 400 | 14–16px | All UI text |
| body AR | Amiri | 700 | 14–16px | Arabic UI text in mixed contexts |
| Quranic quote AR | Scheherazade New | 400 | 22–26px | Hadith/ayah quoted **outside** the mushaf |
| Mushaf | QPC Hafs V2 | — | 28px desktop / 22px mobile, line-height 2 | Mushaf renderer **only**, scoped to `.mushaf-word` |

Each font has one job. **Never** use QPC Hafs outside the mushaf; never use Scheherazade New inside it. The mushaf surface is the only place QPC Hafs ever appears, and that is what makes it feel like a mushaf rather than another card.

## 4. Spacing, radius, shadow

| Token | Value | Use |
|---|---|---|
| `radius.xs` | 6px | Selector buttons (chapter, group) |
| `radius.sm` | 8px | Inner selectable items |
| `radius.md` | 12px | Inner cards, inputs |
| `radius.lg` | 16px | Outer cards (default) |
| `radius.xl` | 24px | Hero surfaces, **pills** (buttons use `xl`) |
| `shadow.sm` | inner cards |
| `shadow.md` | buttons at rest |
| `shadow.lg` | primary CTAs |
| `shadow.xl` | top-level floating cards |

Default card padding is `xl` (32px) for ceremonial surfaces; data-dense surfaces (timeline rows, students list) drop to `md` (16px).

## 5. Background treatment

**Decision: animated silk on auth/landing/empty states only. App-shell screens get flat `mihrab.9`.**

Why: the silk shader is the soul of the brand but it competes with the mushaf and with data-dense screens. Reserving it for entry points (login, splash, "no students yet" empty state) keeps it as a moment of arrival rather than ambient noise. App-shell screens stay readable and let the cream cards do the work.

Implementation: build `<SilkBackground />` as a self-contained component (R3F + custom shader, parameters from the previous project) and render it conditionally via the route — not in `__root.tsx`. The mushaf renderer should sit on a paper-textured cream (`parchment.0` plus a subtle `<svg>` noise pattern at ~4% opacity) so it visually reads as a page, not as a card.

## 6. Component recipes

All recipes assume Mantine v7 components with the theme override applied.

### Primary CTA
```tsx
<Button color="mihrab" size="lg">Start today's review</Button>
```
Renders as: `bg mihrab.9`, `text parchment.0`, `radius xl` (pill), `shadow lg`, slight lift on hover.

### Secondary CTA
```tsx
<Button color="sage" variant="filled">Begin</Button>
```
For affirmative but non-final actions (mirrors the old "Begin" button in shadcn green).

### Selector button (chapter, group, option)
```tsx
<UnstyledButton className={selected ? 'selected' : ''}>
  <Checkbox checked={selected} readOnly />
  <Text>Juz 12 — جُزْء ١٢</Text>
</UnstyledButton>
```
States: `bg white border gray.2` (rest) → `bg sage.0` (hover) → `bg sage.1 border sage.4` (selected). Always show the checkbox even on touch.

### Card (outer)
Default Mantine `<Card>` already inherits `bg parchment.0`, `radius lg`, `shadow xl`, `padding xl`, body color `mihrab.9`.

### Card (inner / data)
```tsx
<Paper bg="white" radius="md" shadow="sm" p="md">…</Paper>
```
White-on-cream, tighter padding — used for the per-juz group cards nested inside an outer cream card, and for data rows (timeline entries, student list rows).

### Status pill
```tsx
<Badge color={statusColors.memorized} variant="filled" size="sm">Memorized</Badge>
```

### Toast / notification
Use Mantine `notifications.show` — the theme override paints the root `mihrab.9` with `parchment.0` text, pill-shaped.

### AppShell + sidebar
Navbar uses `parchment.0` on the dark main area — a cream panel rising out of the mihrab ground. Nav items are unstyled buttons that show the same three-state selection pattern (rest → sage.0 hover → sage.1 selected with a 3px `mihrab.9` left border).

### Mushaf overlay heatmap
On a paper-cream substrate, Mantine's `yellow.3 → orange.6 → red.9` ramp loses contrast at the low end. Override to: `honey.3 → orange.6 → brick.8`. Test at 1.5× zoom on cream before shipping.

## 7. Motion

| Token | Value | Use |
|---|---|---|
| `fast` | 150ms | Button hover lift, checkbox tick |
| `base` | 300ms | Toast in/out, modal open |
| `slow` | 500ms | Toast dismiss with translate-y |
| `fade` | 700ms | Stage transitions (route changes) |

Easing default: `cubic-bezier(0.4, 0, 0.2, 1)`. Primary CTAs use a 1px lift on hover (not scale) — the old `scale-105` over-amplifies at larger widths.

## 8. Bilingual rules

- **Page hero headers** show paired Arabic-above-English, both centered. (Not every page — only routes that are user-facing surfaces; admin/settings pages can be English-only.)
- **Quranic numerals** (juz, hizb, surah, ayah, page numbers within Arabic strings) use Arabic-Indic (`٠١٢٣٤٥٦٧٨٩`).
- **UI counts** (streak days, error counts, "23 students") stay in Western numerals.
- **Quranic quotations** outside the mushaf always include citation (e.g. *Bukhari 5033*) and use the `.quranic-ar` class for the Arabic and Roboto italic for the English translation.
- The landing/login screen should open with a hadith on Quran retention (carry the IntroCard pattern forward). This is deliberate: the app cites itself into the tradition before functioning as a tool.

## 9. Don'ts

- No gradients (the silk shader is the only "movement").
- No drop shadows on text.
- No radius < 6px.
- No more than three colors on screen at once (see §2 three-color rule).
- No decorative icons. Lucide icons only where they do work.
- No emoji in UI text, ever.

## 10. First screen to build

Build the **student Today view**. It is the highest-leverage test of the system because it exercises:

- AppShell with sidebar nav (`parchment.0` panel on `mihrab.9`)
- Bilingual page hero (English + Arabic stacked)
- An outer cream card for "Today's review"
- Inner white cards for each item in the review queue (data-card pattern)
- A primary mihrab CTA ("Start today's review") on the cream card
- Status pills for memorization state
- Streak counter (Western numerals) and juz counter (Arabic-Indic numerals) side by side — validates the bilingual numeral rule
- An empty-state path that drops the silk background back in for moments of arrival

If this screen feels coherent the system holds; if it feels cramped or noisy the spacing/three-color rules need to be tightened before more screens land.

## 11. Rationale — where this departs from the previous project

- **Pill buttons via `radius.xl` instead of `rounded-full`.** Mantine's `radius` token system rounds correctly for any height; hard-coding `rounded-full` produces oversized pills on tall buttons.
- **Sage green for "memorized" instead of Mantine `green.4`.** Stock `green.4` reads neon next to `#15351E`; sage harmonizes and keeps the palette feeling hand-mixed rather than off-the-shelf.
- **Brick instead of stock red.** Bright red on cream vibrates. Brick reads as serious without shouting.
- **Silk confined to entry points** instead of every screen. The old project had 3 screens, all ceremonial. Tahfeedh has dashboards and live test mode where motion is a distraction.
- **A separate `quranic-ar` class** (Scheherazade New) distinct from the mushaf font (QPC Hafs). The old project had only one Quranic context; Tahfeedh has two and the distinction is load-bearing.
- **Hover uses 1px lift, not 5% scale.** Scale-based hover at wider button widths translates into noticeable layout shifts in dense data tables; a small Y translate stays subtle at any width.
