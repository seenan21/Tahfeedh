/**
 * Build-time pipeline: emit static mushaf data for the web app.
 *
 * Per DESIGN.md §10.2 — pulls Madani 15-line per-page word layout from
 * api.quran.com v4 (the same data QUL ships as SQLite, exposed as REST,
 * no auth required). Emits one JSON per page + metadata.json.
 *
 * Run:  npm run build:quran-data
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT_PAGES = join(ROOT, 'apps', 'web', 'src', 'data', 'pages');
const OUT_META = join(ROOT, 'apps', 'web', 'src', 'data', 'metadata.json');

const API = 'https://api.quran.com/api/v4';
const TOTAL_PAGES = 604;
const CONCURRENCY = 10;

type LineType = 'ayah' | 'surah_name' | 'basmallah';

interface MushafWord {
  id: string;
  surah: number;
  ayah: number;
  position: number;
  code_v2: string;
  char_type: 'word' | 'end';
}

interface MushafLine {
  line_number: number;
  line_type: LineType;
  is_centered: boolean;
  surah_number?: number;
  words: MushafWord[];
}

interface MidpointBreak {
  first_half_last_ayah: { surah: number; ayah: number };
  second_half_first_ayah: { surah: number; ayah: number };
  first_half_line_count: number;
  second_half_line_count: number;
}

interface PageData {
  page_number: number;
  lines: MushafLine[];
  midpoint_ayah_break: MidpointBreak | null;
}

interface ApiWord {
  position: number;
  char_type_name: 'word' | 'end';
  code_v2: string;
  line_number: number;
  location: string;
}

interface ApiVerse {
  verse_key: string;
  verse_number: number;
  page_number: number;
  juz_number: number;
  hizb_number: number;
  rub_el_hizb_number: number;
  words: ApiWord[];
}

interface ApiChapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  name_complex: string;
  revelation_place: 'makkah' | 'madinah';
  bismillah_pre: boolean;
  verses_count: number;
  pages: [number, number];
}

interface ApiJuz {
  juz_number: number;
  verses_count: number;
  verse_mapping: Record<string, string>;
}

async function jget<T>(url: string, attempt = 0): Promise<T> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${url}`);
    return (await res.json()) as T;
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      return jget<T>(url, attempt + 1);
    }
    throw err;
  }
}

function buildPage(
  pageNumber: number,
  verses: ApiVerse[],
  chapters: Map<number, ApiChapter>,
): PageData {
  const lineWords: Map<number, MushafWord[]> = new Map();
  for (const verse of verses) {
    const [surahStr, ayahStr] = verse.verse_key.split(':');
    const surah = Number(surahStr);
    const ayah = Number(ayahStr);
    for (const w of verse.words) {
      const word: MushafWord = {
        id: `${surah}:${ayah}:${w.position}`,
        surah,
        ayah,
        position: w.position,
        code_v2: w.code_v2,
        char_type: w.char_type_name,
      };
      const bucket = lineWords.get(w.line_number) ?? [];
      bucket.push(word);
      lineWords.set(w.line_number, bucket);
    }
  }

  const headerLines: Map<number, MushafLine> = new Map();
  const seenSurahs = new Set<number>();
  for (const verse of verses) {
    const surah = Number(verse.verse_key.split(':')[0]);
    if (seenSurahs.has(surah)) continue;
    seenSurahs.add(surah);
    if (verse.verse_number !== 1) continue;
    const firstWordLine = verse.words[0]?.line_number;
    if (!firstWordLine || firstWordLine < 1) continue;

    const chapter = chapters.get(surah);
    const hasBasmallah = chapter?.bismillah_pre ?? false;
    const headerHeight = hasBasmallah ? 2 : 1;
    const surahNameLine = firstWordLine - headerHeight;
    if (surahNameLine < 1) continue;

    headerLines.set(surahNameLine, {
      line_number: surahNameLine,
      line_type: 'surah_name',
      is_centered: true,
      surah_number: surah,
      words: [],
    });
    if (hasBasmallah) {
      headerLines.set(surahNameLine + 1, {
        line_number: surahNameLine + 1,
        line_type: 'basmallah',
        is_centered: true,
        words: [],
      });
    }
  }

  const lines: MushafLine[] = [];
  for (let n = 1; n <= 15; n++) {
    const header = headerLines.get(n);
    if (header) {
      lines.push(header);
      continue;
    }
    const words = lineWords.get(n) ?? [];
    // A short line ending in an ayah-end glyph is typically centered (end of surah).
    const hasEnd = words.some((w) => w.char_type === 'end');
    const isCentered = hasEnd && words.length > 0 && words.length <= 5;
    lines.push({
      line_number: n,
      line_type: 'ayah',
      is_centered: isCentered,
      words,
    });
  }

  return {
    page_number: pageNumber,
    lines,
    midpoint_ayah_break: computeMidpoint(verses),
  };
}

function computeMidpoint(verses: ApiVerse[]): MidpointBreak | null {
  type AyahEnd = { surah: number; ayah: number; endLine: number };
  const ends: AyahEnd[] = [];
  for (const v of verses) {
    const [s, a] = v.verse_key.split(':').map(Number);
    const lastLine = v.words.at(-1)?.line_number;
    if (!lastLine) continue;
    ends.push({ surah: s, ayah: a, endLine: lastLine });
  }
  if (ends.length < 2) return null;

  const TARGET = 7.5;
  let best = 0;
  let bestDist = Infinity;
  for (let k = 0; k < ends.length - 1; k++) {
    const dist = Math.abs(ends[k].endLine - TARGET);
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
    }
  }

  const firstHalf = ends[best];
  const secondHalf = ends[best + 1];
  return {
    first_half_last_ayah: { surah: firstHalf.surah, ayah: firstHalf.ayah },
    second_half_first_ayah: { surah: secondHalf.surah, ayah: secondHalf.ayah },
    first_half_line_count: firstHalf.endLine,
    second_half_line_count: 15 - firstHalf.endLine,
  };
}

async function fetchPage(pageNumber: number): Promise<ApiVerse[]> {
  const url = `${API}/verses/by_page/${pageNumber}`
    + `?words=true`
    + `&word_fields=code_v2,line_number,position,location,char_type_name`
    + `&per_page=300`;
  const data = await jget<{ verses: ApiVerse[] }>(url);
  return data.verses;
}

async function fetchChapters(): Promise<ApiChapter[]> {
  const data = await jget<{ chapters: ApiChapter[] }>(`${API}/chapters`);
  return data.chapters;
}

async function fetchJuzs(): Promise<ApiJuz[]> {
  const data = await jget<{ juzs: ApiJuz[] }>(`${API}/juzs`);
  // The v4 endpoint returns each juz twice; dedupe by juz_number.
  const byNumber = new Map<number, ApiJuz>();
  for (const j of data.juzs) {
    if (!byNumber.has(j.juz_number)) byNumber.set(j.juz_number, j);
  }
  return Array.from(byNumber.values()).sort((a, b) => a.juz_number - b.juz_number);
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const total = items.length;

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= total) return;
      results[i] = await fn(items[i], i);
      done++;
      if (onProgress && (done % 25 === 0 || done === total)) onProgress(done, total);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, total) }, () => worker()));
  return results;
}

async function main(): Promise<void> {
  console.log('[quran-data] fetching chapters + juzs…');
  const [chaptersArr, juzs] = await Promise.all([fetchChapters(), fetchJuzs()]);
  const chapters = new Map(chaptersArr.map((c) => [c.id, c]));
  console.log(`[quran-data] ${chaptersArr.length} chapters, ${juzs.length} juzs`);

  await mkdir(OUT_PAGES, { recursive: true });
  await mkdir(dirname(OUT_META), { recursive: true });

  console.log(`[quran-data] fetching ${TOTAL_PAGES} pages @ concurrency ${CONCURRENCY}…`);
  const pageNumbers = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

  let writeFailures = 0;
  await mapLimit(
    pageNumbers,
    CONCURRENCY,
    async (n) => {
      try {
        const verses = await fetchPage(n);
        const page = buildPage(n, verses, chapters);
        await writeFile(join(OUT_PAGES, `${n}.json`), JSON.stringify(page));
      } catch (err) {
        writeFailures++;
        console.error(`[quran-data] page ${n} failed:`, (err as Error).message);
      }
    },
    (done, total) => console.log(`[quran-data] pages ${done}/${total}`),
  );

  const metadata = {
    chapters: chaptersArr.map((c) => ({
      id: c.id,
      name_simple: c.name_simple,
      name_arabic: c.name_arabic,
      name_complex: c.name_complex,
      revelation_place: c.revelation_place,
      bismillah_pre: c.bismillah_pre,
      verses_count: c.verses_count,
      pages: c.pages,
    })),
    juzs: juzs.map((j) => ({
      juz_number: j.juz_number,
      verses_count: j.verses_count,
      verse_mapping: j.verse_mapping,
    })),
    total_pages: TOTAL_PAGES,
    layout: 'KFGQPC V2 Madani 15-line',
    source: 'api.quran.com v4',
    generated_at: new Date().toISOString(),
  };
  await writeFile(OUT_META, JSON.stringify(metadata, null, 2));

  console.log(`[quran-data] done. wrote ${TOTAL_PAGES - writeFailures}/${TOTAL_PAGES} pages.`);
  if (writeFailures > 0) {
    console.error(`[quran-data] ${writeFailures} page(s) failed — rerun to retry.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
