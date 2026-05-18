# scripts/

Build-time scripts run from the repo root via npm.

## Index

| File | What | When to read |
|---|---|---|
| `build-quran-data.ts` | Fetches Madani 15-line page layout + chapters + juzs from api.quran.com v4, writes 604 per-page JSONs, `metadata.json`, and `quran-index.json` to web + server data dirs | Changing the source data shape, regenerating mushaf data, or modifying the index emit (ADR 0002, 0007) |
| `build-quran-index.ts` | Fast index-only rebuild from existing local page JSONs — skips the API fetch | Iterating on `quran-index.json` shape without re-fetching 604 pages |
| `download-fonts.ts` | Downloads the 604 page-scoped QPC V2 mushaf fonts and generates `quran-fonts.css` | Regenerating mushaf fonts after a source change (ADR 0003) |

## Operational

```
npm run build:quran-data    # full refetch + write pages + metadata + index
npm run build:quran-index   # local-only index rebuild (fast)
npm run download:fonts      # fetch QPC V2 fonts + emit quran-fonts.css
npm run build:assets        # build:quran-data + download:fonts
```
