import metadataJson from './metadata.json';
import quranIndexJson from './quran-index.json';
import type { QuranIndex } from '@tahfeedh/shared';

export interface ChapterMeta {
  id: number;
  name_simple: string;
  name_arabic: string;
  name_complex: string;
  revelation_place: 'makkah' | 'madinah';
  bismillah_pre: boolean;
  verses_count: number;
  pages: [number, number];
}

export interface JuzMeta {
  juz_number: number;
  verses_count: number;
  verse_mapping: Record<string, string>;
}

interface Metadata {
  chapters: ChapterMeta[];
  juzs: JuzMeta[];
  total_pages: number;
}

export const metadata = metadataJson as unknown as Metadata;
export const quranIndex = quranIndexJson as unknown as QuranIndex;

export const CHAPTERS: ChapterMeta[] = metadata.chapters;
export const JUZS: JuzMeta[] = metadata.juzs;

const CHAPTER_BY_ID = new Map<number, ChapterMeta>(CHAPTERS.map((c) => [c.id, c]));

export function chapter(id: number): ChapterMeta | undefined {
  return CHAPTER_BY_ID.get(id);
}

/** Surahs that have at least one ayah inside the given juz. */
export function surahsInJuz(juzNumber: number): number[] {
  const juz = metadata.juzs.find((j) => j.juz_number === juzNumber);
  if (!juz) return [];
  return Object.keys(juz.verse_mapping)
    .map(Number)
    .sort((a, b) => a - b);
}

/** Ayah range [start, end] of the given surah inside the given juz, if any. */
export function juzAyahRange(juzNumber: number, surahNumber: number): [number, number] | null {
  const juz = metadata.juzs.find((j) => j.juz_number === juzNumber);
  if (!juz) return null;
  const raw = juz.verse_mapping[String(surahNumber)];
  if (!raw) return null;
  const parts = raw.split('-').map(Number);
  const s = parts[0] ?? 1;
  const e = parts[1] ?? s;
  return [s, e];
}
