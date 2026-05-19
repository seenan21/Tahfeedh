import type { QuranIndex } from '@tahfeedh/shared';

export interface AyahKey {
  surah: number;
  ayah: number;
}

/**
 * Expand a mushaf page number into the full set of (surah, ayah) keys that
 * appear on it. Reads only the static quran-index.json — no per-page JSON file
 * is loaded — so this is cheap to call from a request handler.
 *
 * Algorithm: walk the per-page index entry's [surah_start, ayah_start] →
 * [surah_end, ayah_end] window. Most pages fall within a single surah; when
 * a page straddles two (or three) surahs, fill each surah's contributing
 * range from `index.surahs[surah].ayah_count`.
 */
export function expandPageAyahs(pageNumber: number, index: QuranIndex): AyahKey[] {
  const page = index.pages[String(pageNumber)];
  if (!page) return [];

  const out: AyahKey[] = [];

  if (page.surah_start === page.surah_end) {
    for (let a = page.ayah_start; a <= page.ayah_end; a++) {
      out.push({ surah: page.surah_start, ayah: a });
    }
    return out;
  }

  // First surah: ayah_start → end of that surah
  const firstSurahInfo = index.surahs[String(page.surah_start)];
  if (firstSurahInfo) {
    for (let a = page.ayah_start; a <= firstSurahInfo.ayah_count; a++) {
      out.push({ surah: page.surah_start, ayah: a });
    }
  }

  // Whole surahs in between
  for (let s = page.surah_start + 1; s < page.surah_end; s++) {
    const mid = index.surahs[String(s)];
    if (!mid) continue;
    for (let a = 1; a <= mid.ayah_count; a++) {
      out.push({ surah: s, ayah: a });
    }
  }

  // Last surah: 1 → ayah_end
  for (let a = 1; a <= page.ayah_end; a++) {
    out.push({ surah: page.surah_end, ayah: a });
  }

  return out;
}

/** True iff (surah, ayah) appears in the given page's ayah set. */
export function isAyahOnPage(
  pageNumber: number,
  surah: number,
  ayah: number,
  index: QuranIndex,
): boolean {
  const page = index.pages[String(pageNumber)];
  if (!page) return false;

  // Inside the bounding surah window?
  if (surah < page.surah_start || surah > page.surah_end) return false;

  if (surah === page.surah_start && ayah < page.ayah_start) return false;
  if (surah === page.surah_end && ayah > page.ayah_end) return false;

  return true;
}
