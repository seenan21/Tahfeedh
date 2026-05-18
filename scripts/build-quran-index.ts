/**
 * Fast rebuild of apps/web/src/data/quran-index.json from existing local page
 * JSONs + metadata.json. Skips the 604-page API fetch; use this when only the
 * index shape changes and the pages themselves are already on disk.
 *
 * Run:  npm run build:quran-index
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PAGES_DIR = join(ROOT, 'apps', 'web', 'src', 'data', 'pages');
const META_PATH = join(ROOT, 'apps', 'web', 'src', 'data', 'metadata.json');
// Written to both web and server so each side can import locally without
// crossing workspace boundaries.
const OUT_PATHS = [
  join(ROOT, 'apps', 'web', 'src', 'data', 'quran-index.json'),
  join(ROOT, 'apps', 'server', 'src', 'data', 'quran-index.json'),
];

const TOTAL_PAGES = 604;

interface Word {
  surah: number;
  ayah: number;
  position: number;
  char_type: 'word' | 'end';
}
interface Line {
  line_number: number;
  line_type: 'ayah' | 'surah_name' | 'basmallah';
  words: Word[];
}
interface PageJson {
  page_number: number;
  lines: Line[];
}
interface Chapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  verses_count: number;
  pages: [number, number];
}
interface Juz {
  juz_number: number;
  verses_count: number;
  verse_mapping: Record<string, string>;
}
interface Metadata {
  chapters: Chapter[];
  juzs: Juz[];
}

async function main(): Promise<void> {
  const metadata: Metadata = JSON.parse(await readFile(META_PATH, 'utf8'));

  const pageBoundaries = new Map<number, {
    surah_start: number; ayah_start: number;
    surah_end: number; ayah_end: number;
  }>();
  const ayahFirstPage = new Map<string, number>();

  for (let n = 1; n <= TOTAL_PAGES; n++) {
    const path = join(PAGES_DIR, `${n}.json`);
    let raw: string;
    try {
      raw = await readFile(path, 'utf8');
    } catch {
      console.error(`[quran-index] missing ${path} — run build:quran-data first.`);
      process.exit(1);
    }
    const page: PageJson = JSON.parse(raw);

    let first: Word | null = null;
    let last: Word | null = null;
    for (const line of page.lines) {
      for (const w of line.words) {
        if (w.char_type !== 'word') continue;
        if (first === null) first = w;
        last = w;
        const key = `${w.surah}:${w.ayah}`;
        const prior = ayahFirstPage.get(key);
        if (prior === undefined || n < prior) ayahFirstPage.set(key, n);
      }
    }
    if (first && last) {
      pageBoundaries.set(n, {
        surah_start: first.surah, ayah_start: first.ayah,
        surah_end:   last.surah,  ayah_end:   last.ayah,
      });
    }
  }

  const pages: Record<string, ReturnType<typeof pageBoundaries.get>> = {};
  for (const [n, b] of pageBoundaries) pages[String(n)] = b;

  const surahs: Record<string, {
    start_page: number; end_page: number;
    ayah_count: number;
    first_ayah_page_map: Record<string, number>;
  }> = {};
  for (const c of metadata.chapters) {
    const map: Record<string, number> = {};
    for (let a = 1; a <= c.verses_count; a++) {
      const page = ayahFirstPage.get(`${c.id}:${a}`);
      if (page !== undefined) map[String(a)] = page;
    }
    surahs[String(c.id)] = {
      start_page: c.pages[0],
      end_page: c.pages[1],
      ayah_count: c.verses_count,
      first_ayah_page_map: map,
    };
  }

  const juzs: Record<string, {
    pages: [number, number];
    ayah_ranges: Record<string, [number, number]>;
  }> = {};
  for (const j of metadata.juzs) {
    const ayahRanges: Record<string, [number, number]> = {};
    let pageMin = Number.POSITIVE_INFINITY;
    let pageMax = 0;
    for (const [surahStr, range] of Object.entries(j.verse_mapping)) {
      const [startStr, endStr] = range.split('-');
      const start = Number(startStr);
      const end = Number(endStr ?? startStr);
      ayahRanges[surahStr] = [start, end];
      const startPage = ayahFirstPage.get(`${surahStr}:${start}`);
      const endPage = ayahFirstPage.get(`${surahStr}:${end}`);
      if (startPage !== undefined && startPage < pageMin) pageMin = startPage;
      if (endPage !== undefined && endPage > pageMax) pageMax = endPage;
    }
    juzs[String(j.juz_number)] = {
      pages: [pageMin === Number.POSITIVE_INFINITY ? 0 : pageMin, pageMax],
      ayah_ranges: ayahRanges,
    };
  }

  const json = JSON.stringify({ pages, surahs, juzs, total_pages: TOTAL_PAGES }, null, 2);
  for (const out of OUT_PATHS) {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, json);
    console.log(`[quran-index] wrote ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
