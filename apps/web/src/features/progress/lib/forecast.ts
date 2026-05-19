import type { HifzDirection, QuranIndex } from '@tahfeedh/shared';

export interface ForecastInput {
  memorizedPageNumbers: Set<number>;
  pagesPerSessionNew: number;
  hifzDirection: HifzDirection;
  quranIndex: QuranIndex;
  /** Optional reference date for tests / SSR. Defaults to `new Date()`. */
  now?: Date;
}

export interface ForecastResult {
  /** True when every page is memorized. nextJuzDate / fullQuranDate are null. */
  hasCompletedHifz: boolean;
  /** Total memorized pages out of 604. */
  pagesMemorized: number;
  /** The juz containing the next unmemorized page (null if completed). */
  nextJuzNumber: number | null;
  /** Projected calendar date when nextJuzNumber will be fully memorized. */
  nextJuzDate: Date | null;
  /** Pages still unmemorized inside nextJuzNumber. */
  pagesLeftInNextJuz: number;
  /** Days until next juz completion at current pace. */
  daysToNextJuz: number;
  /** Projected calendar date when all 604 pages will be memorized. */
  fullQuranDate: Date | null;
  /** Days until full Quran completion at current pace. */
  daysToFullQuran: number;
}

/**
 * Configured-pace forecast. "If the student does `pagesPerSessionNew` pages per
 * day starting today, when will they finish the next juz / the full Quran?"
 * Deterministic. No rolling-pace math (ADR 0025).
 */
export function computeForecast({
  memorizedPageNumbers,
  pagesPerSessionNew,
  hifzDirection,
  quranIndex,
  now,
}: ForecastInput): ForecastResult {
  const totalPages = quranIndex.total_pages;
  const pagesMemorized = memorizedPageNumbers.size;
  const today = now ?? new Date();

  if (pagesMemorized >= totalPages) {
    return {
      hasCompletedHifz: true,
      pagesMemorized,
      nextJuzNumber: null,
      nextJuzDate: null,
      pagesLeftInNextJuz: 0,
      daysToNextJuz: 0,
      fullQuranDate: null,
      daysToFullQuran: 0,
    };
  }

  const pace = Math.max(0.1, pagesPerSessionNew); // guard against div by zero / negatives
  const remainingPages = totalPages - pagesMemorized;
  const daysToFullQuran = Math.ceil(remainingPages / pace);

  const nextUnmemorized = nextUnmemorizedPage(
    memorizedPageNumbers,
    hifzDirection,
    totalPages,
  );

  if (nextUnmemorized == null) {
    return {
      hasCompletedHifz: true,
      pagesMemorized,
      nextJuzNumber: null,
      nextJuzDate: null,
      pagesLeftInNextJuz: 0,
      daysToNextJuz: 0,
      fullQuranDate: null,
      daysToFullQuran: 0,
    };
  }

  const juzNumber = juzContainingPage(nextUnmemorized, quranIndex);
  const [juzStart, juzEnd] = juzNumber != null
    ? (quranIndex.juzs[String(juzNumber)]?.pages ?? [nextUnmemorized, nextUnmemorized])
    : [nextUnmemorized, nextUnmemorized];

  let pagesLeftInNextJuz = 0;
  for (let p = juzStart; p <= juzEnd; p++) {
    if (!memorizedPageNumbers.has(p)) pagesLeftInNextJuz += 1;
  }
  const daysToNextJuz = Math.ceil(pagesLeftInNextJuz / pace);

  return {
    hasCompletedHifz: false,
    pagesMemorized,
    nextJuzNumber: juzNumber,
    nextJuzDate: addDays(today, daysToNextJuz),
    pagesLeftInNextJuz,
    daysToNextJuz,
    fullQuranDate: addDays(today, daysToFullQuran),
    daysToFullQuran,
  };
}

function nextUnmemorizedPage(
  memorized: Set<number>,
  direction: HifzDirection,
  totalPages: number,
): number | null {
  if (direction === 'forward') {
    for (let p = 1; p <= totalPages; p++) {
      if (!memorized.has(p)) return p;
    }
  } else {
    for (let p = totalPages; p >= 1; p--) {
      if (!memorized.has(p)) return p;
    }
  }
  return null;
}

function juzContainingPage(pageNumber: number, quranIndex: QuranIndex): number | null {
  for (const [juzStr, info] of Object.entries(quranIndex.juzs)) {
    const [start, end] = info.pages;
    if (pageNumber >= start && pageNumber <= end) return Number(juzStr);
  }
  return null;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
