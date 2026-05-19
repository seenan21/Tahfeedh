import type { QuranIndex, TestRange } from '@tahfeedh/shared';
import { expandPageAyahs, type AyahKey } from '../../memorization/pageAyahs.js';

export interface ResolvedRanges {
  coveredAyahs: AyahKey[];
  coveredPages: number[];
}

/**
 * Expand a test's range JSONB into the (coveredAyahs, coveredPages) pair the
 * `submit_test` SQL function consumes. Mirrors the onboarding/expand.ts pattern:
 * pure function, no I/O, easy to unit-test.
 *
 *  - coveredAyahs: every (surah, ayah) tuple the test exercises. Drives the
 *    ayah_review_state touch step and the per-ayah error decay step.
 *  - coveredPages: pages whose entire ayah set lies inside coveredAyahs.
 *    Used by the in_progress → memorized promotion (a page can only promote
 *    when the test fully covered it).
 *
 * hizb / rub ranges are not supported in Phase D (the static index doesn't
 * carry hizb/rub boundaries). The function throws so the caller can return a
 * 400 instead of silently dropping coverage.
 */
export function resolveTestRanges(ranges: TestRange[], index: QuranIndex): ResolvedRanges {
  const ayahSet = new Set<string>();

  const addAyah = (surah: number, ayah: number) => {
    ayahSet.add(`${surah}:${ayah}`);
  };

  for (const r of ranges) {
    switch (r.type) {
      case 'page': {
        for (let p = r.start; p <= r.end; p++) {
          for (const k of expandPageAyahs(p, index)) addAyah(k.surah, k.ayah);
        }
        break;
      }
      case 'surah': {
        const info = index.surahs[String(r.surah)];
        if (!info) break;
        for (let a = 1; a <= info.ayah_count; a++) addAyah(r.surah, a);
        break;
      }
      case 'ayah': {
        for (let a = r.start_ayah; a <= r.end_ayah; a++) addAyah(r.surah, a);
        break;
      }
      case 'juz': {
        const juz = index.juzs[String(r.juz)];
        if (!juz) break;
        for (const [surahStr, [start, end]] of Object.entries(juz.ayah_ranges)) {
          const surah = Number(surahStr);
          for (let a = start; a <= end; a++) addAyah(surah, a);
        }
        break;
      }
      case 'hizb':
      case 'rub':
        throw new Error(`range type '${r.type}' is not supported yet`);
    }
  }

  const coveredAyahs: AyahKey[] = [];
  for (const key of ayahSet) {
    const [s, a] = key.split(':');
    coveredAyahs.push({ surah: Number(s), ayah: Number(a) });
  }

  // A page is fully covered iff every (surah, ayah) on it lies in ayahSet.
  // Iterate the candidate set of pages touched by ranges to avoid scanning all 604.
  const candidatePages = new Set<number>();
  for (const r of ranges) {
    if (r.type === 'page') {
      for (let p = r.start; p <= r.end; p++) candidatePages.add(p);
    } else if (r.type === 'surah') {
      const info = index.surahs[String(r.surah)];
      if (!info) continue;
      for (let p = info.start_page; p <= info.end_page; p++) candidatePages.add(p);
    } else if (r.type === 'ayah') {
      const info = index.surahs[String(r.surah)];
      if (!info) continue;
      const startPage = info.first_ayah_page_map[String(r.start_ayah)];
      const endPage = info.first_ayah_page_map[String(r.end_ayah)] ?? info.end_page;
      if (startPage !== undefined) {
        for (let p = startPage; p <= endPage; p++) candidatePages.add(p);
      }
    } else if (r.type === 'juz') {
      const juz = index.juzs[String(r.juz)];
      if (!juz) continue;
      for (let p = juz.pages[0]; p <= juz.pages[1]; p++) candidatePages.add(p);
    }
  }

  const coveredPages: number[] = [];
  for (const p of candidatePages) {
    const pageAyahs = expandPageAyahs(p, index);
    if (pageAyahs.length === 0) continue;
    const allCovered = pageAyahs.every((k) => ayahSet.has(`${k.surah}:${k.ayah}`));
    if (allCovered) coveredPages.push(p);
  }
  coveredPages.sort((a, b) => a - b);

  return { coveredAyahs, coveredPages };
}
