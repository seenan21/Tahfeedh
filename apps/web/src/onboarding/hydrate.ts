import type { HifzDirection } from '@tahfeedh/shared';
import { supabase } from '../lib/supabase';
import quranIndex from '../data/quran-index.json';
import type { OnboardingState } from './state';

interface QuranIndex {
  juzs: Record<string, { pages: [number, number] }>;
  surahs: Record<string, { start_page: number; end_page: number; ayah_count: number }>;
}

const idx = quranIndex as unknown as QuranIndex;

interface HydrationResult {
  patch: Partial<OnboardingState>;
}

/**
 * Pre-populates the onboarding reducer with the student's current claims so
 * Edit Memorization (Settings → /onboarding?edit=1) opens onto Step 2 with
 * juz/surah selections that match the DB. Derivation rules:
 * - A juz is "selected" when every page in its range has memorization_page
 *   status memorized.
 * - A surah is "selected" when every page covering it is fully memorized.
 *   Partial surahs (some-but-not-all pages memorized) are deliberately not
 *   surfaced as upToAyah selections — the student can re-tick them via the
 *   surah list. (Documented in ADR 0039.)
 * - inProgress marker is left undefined; the underlying memorization_verse
 *   rows survive untouched, and commit_onboarding is idempotent.
 */
export async function hydrateOnboardingFromDb(studentId: string): Promise<HydrationResult> {
  const [settingsRes, pagesRes] = await Promise.all([
    supabase
      .from('student_settings')
      .select('pages_per_session_new, pages_per_session_revision, hifz_direction')
      .eq('student_id', studentId)
      .maybeSingle(),
    supabase
      .from('memorization_page')
      .select('page_number, status')
      .eq('student_id', studentId)
      .eq('status', 'memorized'),
  ]);

  if (settingsRes.error) throw settingsRes.error;
  if (pagesRes.error) throw pagesRes.error;

  const memorizedSet = new Set<number>(
    ((pagesRes.data ?? []) as Array<{ page_number: number }>).map((r) => r.page_number),
  );

  const juzs: number[] = [];
  for (let j = 1; j <= 30; j++) {
    const meta = idx.juzs[String(j)];
    if (!meta) continue;
    const [from, to] = meta.pages;
    let allMemorized = true;
    for (let p = from; p <= to; p++) {
      if (!memorizedSet.has(p)) {
        allMemorized = false;
        break;
      }
    }
    if (allMemorized) juzs.push(j);
  }

  // Surahs: only fully-memorized surahs surface. Partial-surah upToAyah is
  // not reconstructed (see ADR 0039 — degraded for hackathon scope).
  const surahs: { surah: number }[] = [];
  for (let s = 1; s <= 114; s++) {
    const meta = idx.surahs[String(s)];
    if (!meta) continue;
    let allMemorized = true;
    for (let p = meta.start_page; p <= meta.end_page; p++) {
      if (!memorizedSet.has(p)) {
        allMemorized = false;
        break;
      }
    }
    if (allMemorized) surahs.push({ surah: s });
  }

  const settings = settingsRes.data as
    | { pages_per_session_new: number | string; pages_per_session_revision: number; hifz_direction: HifzDirection }
    | null;

  return {
    patch: {
      step: 2,
      path: 'partial',
      juzs,
      surahs,
      inProgress: undefined,
      newPerDay: settings ? Number(settings.pages_per_session_new) : 1,
      revisionPerDay: settings?.pages_per_session_revision ?? 3,
      direction: settings?.hifz_direction ?? 'forward',
    },
  };
}
