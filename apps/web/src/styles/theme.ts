import { createTheme, MantineColorsTuple, rem } from '@mantine/core';

/* =========================================================================
 * Color tokens
 *
 * Two anchors carry the app:
 *   - mihrab.9  (#15351E) — primary surface, primary button bg, body text on cream
 *   - parchment.0 (#FFFFC1) — card backgrounds, primary button text
 *
 * Mantine requires 10-stop tuples (index 0 = lightest, 9 = darkest).
 * Anchors are positioned at the index where Mantine looks them up by default
 * for `primaryColor` semantics (filled bg = .6, hover = .7), but we override
 * Button colors explicitly below so the anchor at .9 is preserved.
 * ========================================================================= */

export const mihrab: MantineColorsTuple = [
  '#eef3ef',
  '#d4e0d8',
  '#a8c0b1',
  '#7aa088',
  '#548166',
  '#3a6a4d',
  '#2a533b',
  '#1f4530',
  '#193b27',
  '#15351E', // anchor
];

export const parchment: MantineColorsTuple = [
  '#FFFFC1', // anchor
  '#fafab0',
  '#f2f29c',
  '#e8e887',
  '#dcdc72',
  '#cccc5d',
  '#b0b04b',
  '#8b8b3a',
  '#66662a',
  '#43431b',
];

/* Sage — desaturated olive-green for "memorized" status; harmonizes with mihrab
 * better than Mantine's stock green.4 which reads too neon next to #15351E. */
export const sage: MantineColorsTuple = [
  '#eef4ef',
  '#d6e3d9',
  '#b7ccbd',
  '#97b59f',
  '#7ea087', // .4 — memorized
  '#658a6e',
  '#507459',
  '#3d6b4c', // .7 — memorized (deep)
  '#2f5a3d',
  '#234830',
];

/* Honey — for "in-progress" status; warmer than Mantine yellow.3 and reads on cream. */
export const honey: MantineColorsTuple = [
  '#fdf6e3',
  '#f8e9bf',
  '#f2d98f',
  '#ecc85e',
  '#e5b836', // .4 — in-progress
  '#cf9f23',
  '#a87f1b',
  '#7f5f14',
  '#56400d',
  '#2d2207',
];

/* Brick — muted red for omission / forgotten-verse error types and destructive UI.
 * Stock Mantine red.6 vibrates against cream; this is dialed down. */
export const brick: MantineColorsTuple = [
  '#fbeeec',
  '#f1d2cd',
  '#e2a89f',
  '#d27c70',
  '#c25647',
  '#a8412f',
  '#8b3325', // .6 — omission
  '#6b271c', // .7 — forgotten-verse
  '#4b1b14',
  '#2d100c',
];

/* Eight error-type tokens. Picked to read on parchment.0 at body sizes
 * without vibrating. Use as filled chips/pills, not as text colors on cream
 * (they all pass AA on white when ≥14px bold; brick/teal pass AA on cream). */
export const errorTypeColors = {
  tajweed:         'indigo.7',   // slate-blue, scholarly
  pronunciation:   'honey.5',    // warm, attention-getting but not alarming
  omission:        'brick.6',    // muted brick red
  addition:        'grape.6',    // restrained violet
  mismatch:        'orange.7',   // terracotta
  wrongVerse:      'pink.7',     // muted rose
  forgottenVerse:  'brick.8',    // deepest red — most severe
  hesitation:      'gray.6',     // neutral; not really an "error"
} as const;

export const statusColors = {
  untouched:   'gray.2',
  inProgress:  'honey.4',
  memorized:   'sage.7',
} as const;

/* =========================================================================
 * Typography
 *
 * Six fonts, each with one job:
 *   Playfair Display 700  → English display/h1
 *   Montserrat 500        → English card headers / h2-h3
 *   Roboto 400            → English body / UI
 *   Cairo 700             → Arabic display/h1
 *   Amiri 700             → Arabic card headers / h2-h3
 *   Scheherazade New 400  → Quranic quotations OUTSIDE the mushaf
 *
 * QPC Hafs V2 is loaded separately in fonts.css and scoped to .mushaf-word
 * — never referenced from theme tokens.
 * ========================================================================= */

export const fontStacks = {
  bodyEn:    "'Roboto', system-ui, sans-serif",
  headingEn: "'Montserrat', system-ui, sans-serif",
  displayEn: "'Playfair Display', Georgia, serif",
  bodyAr:    "'Amiri', 'Scheherazade New', serif",
  headingAr: "'Amiri', serif",
  displayAr: "'Cairo', system-ui, sans-serif",
  quranicAr: "'Scheherazade New', serif", // for non-mushaf Quranic quotations
} as const;

/* =========================================================================
 * Spacing, radius, shadow
 * ========================================================================= */

export const radii = {
  xs: rem(6),   // selector buttons
  sm: rem(8),   // inner selectable items
  md: rem(12),  // inner cards
  lg: rem(16),  // outer cards
  xl: rem(24),  // hero surfaces
} as const;

export const shadows = {
  xs: '0 1px 2px rgba(21, 53, 30, 0.06)',
  sm: '0 1px 3px rgba(21, 53, 30, 0.10), 0 1px 2px rgba(21, 53, 30, 0.06)', // inner cards
  md: '0 4px 6px rgba(21, 53, 30, 0.10), 0 2px 4px rgba(21, 53, 30, 0.06)', // buttons
  lg: '0 10px 15px rgba(21, 53, 30, 0.12), 0 4px 6px rgba(21, 53, 30, 0.06)', // CTAs
  xl: '0 20px 25px rgba(21, 53, 30, 0.15), 0 8px 10px rgba(21, 53, 30, 0.08)', // top-level cards
} as const;

/* =========================================================================
 * Motion
 * ========================================================================= */

export const motion = {
  durations: { fast: 150, base: 300, slow: 500, fade: 700 },
  easings:   { standard: 'cubic-bezier(0.4, 0, 0.2, 1)', emphasized: 'cubic-bezier(0.2, 0, 0, 1)' },
} as const;

/* =========================================================================
 * Mantine theme
 * ========================================================================= */

export const theme = createTheme({
  primaryColor: 'mihrab',
  primaryShade: { light: 9, dark: 9 },

  colors: {
    mihrab,
    parchment,
    sage,
    honey,
    brick,
  },

  white: '#FFFFFF',
  black: '#15351E',

  defaultRadius: 'lg',
  radius: radii,
  shadows,

  fontFamily: fontStacks.bodyEn,
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  headings: {
    fontFamily: fontStacks.headingEn,
    fontWeight: '500',
    sizes: {
      h1: { fontWeight: '700', fontSize: rem(36), lineHeight: '1.2' },
      h2: { fontWeight: '500', fontSize: rem(24), lineHeight: '1.3' },
      h3: { fontWeight: '500', fontSize: rem(20), lineHeight: '1.4' },
      h4: { fontWeight: '500', fontSize: rem(16), lineHeight: '1.5' },
    },
  },

  components: {
    Button: {
      defaultProps: { radius: 'xl' }, // pill-shaped — signature
      styles: {
        root: {
          fontFamily: fontStacks.headingEn,
          fontWeight: 500,
          transition: `transform ${motion.durations.fast}ms ${motion.easings.standard}`,
          '&:hover:not(:disabled)': { transform: 'translateY(-1px)' },
          '&:active:not(:disabled)': { transform: 'translateY(0)' },
        },
      },
    },

    Card: {
      defaultProps: { radius: 'lg', shadow: 'xl', padding: 'xl', bg: 'parchment.0' },
      styles: { root: { color: 'var(--mantine-color-mihrab-9)' } },
    },

    Paper: {
      defaultProps: { radius: 'lg', bg: 'parchment.0' },
    },

    Modal: {
      defaultProps: { radius: 'lg', centered: true, overlayProps: { backgroundOpacity: 0.55, blur: 3 } },
      styles: {
        content: { backgroundColor: 'var(--mantine-color-parchment-0)' },
        header:  { backgroundColor: 'var(--mantine-color-parchment-0)' },
        title:   { fontFamily: fontStacks.headingEn, fontWeight: 500, color: 'var(--mantine-color-mihrab-9)' },
      },
    },

    Notification: {
      defaultProps: { radius: 'xl' },
      styles: {
        root: {
          backgroundColor: 'var(--mantine-color-mihrab-9)',
          color: 'var(--mantine-color-parchment-0)',
        },
        title: { color: 'var(--mantine-color-parchment-0)' },
      },
    },

    Input: {
      defaultProps: { radius: 'md' },
    },
    TextInput:   { defaultProps: { radius: 'md' } },
    Select:      { defaultProps: { radius: 'md' } },
    Textarea:    { defaultProps: { radius: 'md' } },
    NumberInput: { defaultProps: { radius: 'md' } },
    PasswordInput: { defaultProps: { radius: 'md' } },

    Tooltip: {
      defaultProps: { color: 'mihrab.9', radius: 'sm', withArrow: true },
    },

    Badge: {
      defaultProps: { radius: 'sm' },
      styles: { root: { fontFamily: fontStacks.headingEn, fontWeight: 500, textTransform: 'none' } },
    },

    AppShell: {
      styles: {
        main:    { backgroundColor: 'var(--mantine-color-mihrab-9)' },
        navbar:  {
          backgroundColor: 'var(--mantine-color-parchment-0)',
          color: 'var(--mantine-color-mihrab-9)',
          borderRight: 'none',
        },
        header:  {
          backgroundColor: 'var(--mantine-color-parchment-0)',
          color: 'var(--mantine-color-mihrab-9)',
          borderBottom: 'none',
        },
      },
    },
  },
});

export type Theme = typeof theme;
