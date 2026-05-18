# apps/web/src/styles/

Global CSS. Mantine theme tokens live in `apps/web/src/styles/theme.ts` — this directory is just the CSS imports that drive font loading and a few utility classes.

## Index

| File | What | When to read |
|---|---|---|
| `fonts.css` | Google Fonts (Playfair, Cairo, Montserrat, Amiri, Roboto, Scheherazade New) + import of `quran-fonts.css` + utility classes (`title-en/ar`, `quranic-ar`, `.mushaf-word`, body background) | Adding a new font or bilingual utility class |
| `quran-fonts.css` | **Generated.** 604 `@font-face` rules, one per mushaf page (`QPC V2 P{N}`) — output of `scripts/download-fonts.ts` (ADR 0003) | Don't hand-edit. Regenerate via `npm run download:fonts` |
| `theme.ts` | (Sibling to this dir, in `apps/web/src/styles/theme.ts`) Mantine theme with `mihrab/parchment/sage/honey/brick` color tuples, font stacks, component defaults | Adding or changing a design token; aligns with DESIGN-SYSTEM.md |
