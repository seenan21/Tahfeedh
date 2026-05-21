import type { QuranIndex, OnboardingFinishInput } from '@tahfeedh/shared';
import { expandPageAyahs } from '../memorization/pageAyahs.js';

export interface AyahKey {
  surah: number;
  ayah: number;
}

export interface MemorizedVerseRow {
  surah: number;
  ayah: number;
  page: number;
}

/**
 * The payload shape the commit_onboarding SQL function consumes. See
 * supabase/migrations/0031_onboarding_memorization_verse.sql for the
 * latest function body.
 */
export interface CommitOnboardingPayload {
  memorizedPages: number[];
  /**
   * Per-ayah expansion of `memorizedPages`. `commit_onboarding` inserts these
   * into `memorization_verse` so the new revision-queue algorithm (ADR 0050 /
   * migration 0029) — which JOINs through `memorization_verse` — can see
   * onboarding-memorized pages immediately. Without this, pages stay invisible
   * to the queue until a test happens to upsert them (ADR 0038 path).
   */
  memorizedVerses: MemorizedVerseRow[];
  inProgress?: {
    page: number;
    verses: AyahKey[];
  };
  ayahReviewStates: AyahKey[];
  newPerDay: number;
  revisionPerDay: number;
  hasCompletedQuran: boolean;
  hifzDirection: 'forward' | 'backward';
}

/**
 * Expand a user's onboarding selections into the row-level payload the SQL
 * commit function consumes. Pure (no I/O), so it's easy to unit-test.
 *
 * Rules (DESIGN.md §6.3):
 *  - `fresh`    → no memorization, no ayah review state.
 *  - `complete` → all 604 pages + every ayah; hasCompletedQuran = true.
 *  - `partial`  → juz/surah selections drive `memorizedPages` and ayah keys;
 *                 an optional `inProgress` marker drives the in-progress page
 *                 and its memorization_verse rows.
 *
 * Partial-surah ("upToAyah") only adds pages whose every ayah within this
 * surah is ≤ upToAyah AND that don't continue into a later surah. Anything
 * murkier (cross-surah mid-page) is handled by the explicit inProgress marker.
 */
export function expandSelections(
  input: OnboardingFinishInput,
  index: QuranIndex,
): CommitOnboardingPayload {
  const baseSession = {
    newPerDay: input.session.newPerDay,
    revisionPerDay: input.session.revisionPerDay,
    hifzDirection: input.hifzDirection,
  };

  if (input.path === 'fresh') {
    return {
      memorizedPages: [],
      memorizedVerses: [],
      ayahReviewStates: [],
      hasCompletedQuran: false,
      ...baseSession,
    };
  }

  if (input.path === 'complete') {
    const memorizedPages: number[] = [];
    for (let p = 1; p <= index.total_pages; p++) memorizedPages.push(p);

    const ayahReviewStates: AyahKey[] = [];
    for (const [surahStr, info] of Object.entries(index.surahs)) {
      const surah = Number(surahStr);
      for (let a = 1; a <= info.ayah_count; a++) {
        ayahReviewStates.push({ surah, ayah: a });
      }
    }

    const memorizedVerses: MemorizedVerseRow[] = [];
    for (const page of memorizedPages) {
      for (const { surah, ayah } of expandPageAyahs(page, index)) {
        memorizedVerses.push({ surah, ayah, page });
      }
    }

    return {
      memorizedPages,
      memorizedVerses,
      ayahReviewStates,
      hasCompletedQuran: true,
      ...baseSession,
    };
  }

  // path === 'partial'
  const memorizedPages = new Set<number>();
  const ayahKeys = new Set<string>();

  for (const juzNum of input.selections.juzs) {
    const juz = index.juzs[String(juzNum)];
    if (!juz) continue;
    for (let p = juz.pages[0]; p <= juz.pages[1]; p++) memorizedPages.add(p);
    for (const [surahStr, range] of Object.entries(juz.ayah_ranges)) {
      const surah = Number(surahStr);
      const [start, end] = range;
      for (let a = start; a <= end; a++) ayahKeys.add(`${surah}:${a}`);
    }
  }

  for (const sel of input.selections.surahs) {
    const surahInfo = index.surahs[String(sel.surah)];
    if (!surahInfo) continue;
    const lastAyah = sel.upToAyah ?? surahInfo.ayah_count;
    for (let a = 1; a <= lastAyah; a++) ayahKeys.add(`${sel.surah}:${a}`);

    for (let p = surahInfo.start_page; p <= surahInfo.end_page; p++) {
      const pageInfo = index.pages[String(p)];
      if (!pageInfo) continue;
      if (sel.upToAyah === undefined) {
        memorizedPages.add(p);
      } else if (
        pageInfo.surah_end === sel.surah &&
        pageInfo.ayah_end <= lastAyah
      ) {
        memorizedPages.add(p);
      }
    }
  }

  let inProgress: CommitOnboardingPayload['inProgress'];
  if (input.selections.inProgress) {
    const { surah, ayah } = input.selections.inProgress;
    const surahInfo = index.surahs[String(surah)];
    const page = surahInfo?.first_ayah_page_map[String(ayah)];
    if (page !== undefined) {
      const pageInfo = index.pages[String(page)];
      const firstOnPage =
        pageInfo && pageInfo.surah_start === surah ? pageInfo.ayah_start : 1;
      const verses: AyahKey[] = [];
      for (let a = firstOnPage; a <= ayah; a++) {
        verses.push({ surah, ayah: a });
        ayahKeys.add(`${surah}:${a}`);
      }
      memorizedPages.delete(page);
      inProgress = { page, verses };
    }
  }

  const ayahReviewStates: AyahKey[] = [];
  for (const key of ayahKeys) {
    const [s, a] = key.split(':');
    ayahReviewStates.push({ surah: Number(s), ayah: Number(a) });
  }

  const sortedPages = Array.from(memorizedPages).sort((a, b) => a - b);
  const memorizedVerses: MemorizedVerseRow[] = [];
  for (const page of sortedPages) {
    for (const { surah, ayah } of expandPageAyahs(page, index)) {
      memorizedVerses.push({ surah, ayah, page });
    }
  }

  return {
    memorizedPages: sortedPages,
    memorizedVerses,
    inProgress,
    ayahReviewStates,
    hasCompletedQuran: false,
    ...baseSession,
  };
}
