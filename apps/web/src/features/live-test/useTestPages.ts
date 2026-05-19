import { useMemo } from 'react';
import type { QuranIndex, TestRange } from '@tahfeedh/shared';
import { quranIndex } from '../../data/quran-data';

/**
 * Given the test's ranges array, return the sorted list of mushaf pages to
 * navigate through during the live test. Mirrors the server's
 * resolveTestRanges page-collection logic but only returns candidate pages,
 * not the fully-covered subset (the live view shows partial pages too).
 */
export function useTestPages(ranges: TestRange[] | null | undefined): number[] {
  return useMemo(() => {
    if (!ranges || ranges.length === 0) return [];
    return collectCandidatePages(ranges, quranIndex);
  }, [ranges]);
}

export function collectCandidatePages(ranges: TestRange[], index: QuranIndex): number[] {
  const set = new Set<number>();
  for (const r of ranges) {
    switch (r.type) {
      case 'page': {
        for (let p = r.start; p <= r.end; p++) set.add(p);
        break;
      }
      case 'surah': {
        const info = index.surahs[String(r.surah)];
        if (!info) break;
        for (let p = info.start_page; p <= info.end_page; p++) set.add(p);
        break;
      }
      case 'ayah': {
        const info = index.surahs[String(r.surah)];
        if (!info) break;
        const startPage = info.first_ayah_page_map[String(r.start_ayah)];
        const endPage = info.first_ayah_page_map[String(r.end_ayah)] ?? info.end_page;
        if (startPage !== undefined) {
          for (let p = startPage; p <= endPage; p++) set.add(p);
        }
        break;
      }
      case 'juz': {
        const juz = index.juzs[String(r.juz)];
        if (!juz) break;
        for (let p = juz.pages[0]; p <= juz.pages[1]; p++) set.add(p);
        break;
      }
      case 'hizb':
      case 'rub':
        // Not supported in Phase D.
        break;
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}
