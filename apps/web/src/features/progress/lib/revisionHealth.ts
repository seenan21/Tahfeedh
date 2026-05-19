import type { QuranIndex } from '@tahfeedh/shared';

export type StalenessBand = 'fresh' | 'aging' | 'stale' | 'overdue' | 'never' | 'untouched';

export interface JuzRevisionHealth {
  juzNumber: number;
  /** Stalest ayah's last-reviewed-at across memorized pages in this juz. */
  stalestAt: Date | null;
  /** Days since stalestAt. -1 when juz has memorized pages but no review state row. */
  daysSinceStalest: number;
  /** Total memorized pages in this juz. */
  memorizedPages: number;
  /** Pages in juz (full). */
  totalPages: number;
  band: StalenessBand;
}

export interface AyahReviewRow {
  surah_number: number;
  ayah_number: number;
  last_reviewed_at: string | null;
}

export interface MemorizedPageRow {
  page_number: number;
  status: 'in_progress' | 'memorized' | 'mastered';
}

export interface RevisionHealthInput {
  ayahReviewRows: AyahReviewRow[];
  memorizedPageRows: MemorizedPageRow[];
  quranIndex: QuranIndex;
  now?: Date;
}

const FRESH_DAYS = 7;
const AGING_DAYS = 14;
const STALE_DAYS = 30;

export function computeRevisionHealth({
  ayahReviewRows,
  memorizedPageRows,
  quranIndex,
  now,
}: RevisionHealthInput): JuzRevisionHealth[] {
  const today = now ?? new Date();
  const memorizedPages = new Set<number>();
  for (const r of memorizedPageRows) {
    if (r.status === 'memorized' || r.status === 'mastered') memorizedPages.add(r.page_number);
  }

  // (surah,ayah) → last_reviewed_at
  const ayahFreshness = new Map<string, string | null>();
  for (const r of ayahReviewRows) {
    ayahFreshness.set(`${r.surah_number}:${r.ayah_number}`, r.last_reviewed_at);
  }

  const out: JuzRevisionHealth[] = [];
  for (let j = 1; j <= 30; j++) {
    const juzInfo = quranIndex.juzs[String(j)];
    if (!juzInfo) {
      out.push(emptyJuz(j, 0));
      continue;
    }
    const [pageStart, pageEnd] = juzInfo.pages;
    let memorizedInJuz = 0;
    let stalestIso: string | null = null;
    let memorizedHasUnreviewed = false;

    // Walk every ayah that belongs to this juz via ayah_ranges, but only count
    // freshness for pages that are memorized.
    for (const [surahStr, [firstAyah, lastAyah]] of Object.entries(juzInfo.ayah_ranges)) {
      const surah = Number(surahStr);
      for (let a = firstAyah; a <= lastAyah; a++) {
        const reviewedAt = ayahFreshness.get(`${surah}:${a}`);
        // We need to know which page this ayah lives on. The cheapest accurate
        // way is to walk pages in juz range and inspect their (surah, ayah)
        // bounds — but for the juz-level stalest we don't actually need
        // exact page mapping, just "is any memorized page in this juz holding
        // an ayah with this freshness?" Since memorized-ness is page-level,
        // we approximate by counting reviewed ayahs that fall inside a
        // memorized page. We check via per-page bounds.
        const page = pageForAyah(quranIndex, pageStart, pageEnd, surah, a);
        if (page == null) continue;
        if (!memorizedPages.has(page)) continue;
        if (reviewedAt === undefined || reviewedAt === null) {
          memorizedHasUnreviewed = true;
          continue;
        }
        if (stalestIso == null || reviewedAt < stalestIso) {
          stalestIso = reviewedAt;
        }
      }
    }

    // Count memorized pages in this juz.
    for (let p = pageStart; p <= pageEnd; p++) {
      if (memorizedPages.has(p)) memorizedInJuz += 1;
    }

    const totalPages = pageEnd - pageStart + 1;

    if (memorizedInJuz === 0) {
      out.push({
        juzNumber: j,
        stalestAt: null,
        daysSinceStalest: -1,
        memorizedPages: 0,
        totalPages,
        band: 'untouched',
      });
      continue;
    }

    if (stalestIso == null) {
      // memorized pages exist but no ayah_review_state rows match.
      out.push({
        juzNumber: j,
        stalestAt: null,
        daysSinceStalest: -1,
        memorizedPages: memorizedInJuz,
        totalPages,
        band: 'never',
      });
      continue;
    }

    const stalestDate = new Date(stalestIso);
    let days = Math.floor((today.getTime() - stalestDate.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) days = 0;

    let band: StalenessBand;
    if (memorizedHasUnreviewed) {
      // Treat a juz with any never-reviewed memorized ayah as "never" so the
      // student sees the worst signal, not the freshest.
      band = 'never';
    } else if (days < FRESH_DAYS) band = 'fresh';
    else if (days < AGING_DAYS) band = 'aging';
    else if (days < STALE_DAYS) band = 'stale';
    else band = 'overdue';

    out.push({
      juzNumber: j,
      stalestAt: stalestDate,
      daysSinceStalest: days,
      memorizedPages: memorizedInJuz,
      totalPages,
      band,
    });
  }
  return out;
}

function emptyJuz(juzNumber: number, totalPages: number): JuzRevisionHealth {
  return {
    juzNumber,
    stalestAt: null,
    daysSinceStalest: -1,
    memorizedPages: 0,
    totalPages,
    band: 'untouched',
  };
}

function pageForAyah(
  quranIndex: QuranIndex,
  pageStart: number,
  pageEnd: number,
  surah: number,
  ayah: number,
): number | null {
  for (let p = pageStart; p <= pageEnd; p++) {
    const info = quranIndex.pages[String(p)];
    if (!info) continue;
    if (surah < info.surah_start || surah > info.surah_end) continue;
    if (surah === info.surah_start && ayah < info.ayah_start) continue;
    if (surah === info.surah_end && ayah > info.ayah_end) continue;
    return p;
  }
  return null;
}

export const BAND_COLOR: Record<StalenessBand, { bg: string; fg: string }> = {
  fresh:     { bg: 'var(--mantine-color-sage-7)',    fg: 'var(--mantine-color-parchment-0)' },
  aging:     { bg: 'var(--mantine-color-sage-4)',    fg: 'var(--mantine-color-mihrab-9)' },
  stale:     { bg: 'var(--mantine-color-honey-4)',   fg: 'var(--mantine-color-mihrab-9)' },
  overdue:   { bg: 'var(--mantine-color-brick-6)',   fg: 'var(--mantine-color-parchment-0)' },
  never:     { bg: 'var(--mantine-color-brick-9, #7f1d1d)', fg: 'var(--mantine-color-parchment-0)' },
  untouched: { bg: 'rgba(255,255,255,0.65)',         fg: 'rgba(21,53,30,0.45)' },
};

export const BAND_LABEL: Record<StalenessBand, string> = {
  fresh: 'fresh (< 7d)',
  aging: 'aging (7–14d)',
  stale: 'stale (14–30d)',
  overdue: 'overdue (30d+)',
  never: 'never reviewed',
  untouched: 'no memorized pages',
};
