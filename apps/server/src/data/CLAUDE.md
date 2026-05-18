# apps/server/src/data/

Server-side copy of the derived Quran index (ADR 0007). Kept inside the server's `rootDir` so TypeScript's `resolveJsonModule` can import it without crossing workspace boundaries.

## Index

| File | What | When to read |
|---|---|---|
| `quran-index.json` | **Generated.** Identical to `apps/web/src/data/quran-index.json` — emitted to both locations by `scripts/build-quran-data.ts` and `scripts/build-quran-index.ts` | Don't hand-edit. Regenerate via `npm run build:quran-index` |
