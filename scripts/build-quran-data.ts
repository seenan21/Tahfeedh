/**
 * Build-time pipeline: convert QUL SQLite → static JSON for the web app.
 *
 * Per DESIGN.md §10.2:
 *   1. Download QUL SQLite (mushaf-layout/10, quran-script/61) + metadata JSON
 *   2. Read SQLite via better-sqlite3
 *   3. Emit apps/web/src/data/pages/{1..604}.json
 *   4. Emit apps/web/src/data/metadata.json
 *   5. Copy QPC Hafs woff2 → apps/web/public/fonts/
 *
 * To implement in M2.
 */

async function main(): Promise<void> {
  console.log('TODO: implement QUL → static JSON pipeline (M2)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
