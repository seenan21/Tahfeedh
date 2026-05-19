import type {
  ErrorLocationStatsRow,
  ErrorType,
  QuranIndex,
} from '@tahfeedh/shared';
import type { OverlayMode } from './MushafPage';

/**
 * ADR 0011 — errors merge at render time. Given the student's
 * `error_location_stats` (which is the canonical aggregate) filtered down to
 * a page's ayahs, produce one marker per visual location. Word-scope errors
 * (word_position != null) pin to that word; verse-scope errors (word_position
 * null) pin to the ayah-end marker.
 *
 * Single overlay style: intensity-weighted heatmap with a count badge. The
 * per-error-type palette below stays exported for the right-pane error log
 * and the future error detail modal (M7) — the mushaf marker color itself is
 * recency-weighted, not type-based.
 */

export type OverlayScope = 'word' | 'verse';

export interface OverlayMarker {
  scope: OverlayScope;
  surah: number;
  ayah: number;
  /** word_position when scope='word'; undefined when scope='verse'. */
  wordPosition?: number;
  /** Number of stats rows merged into this marker. */
  count: number;
  /** Max intensity across merged rows = max(occurrence_count / (1 + tests_since_last_occurrence)). */
  intensity: number;
  /** Most-recent error_type at this location (used by the modal, not the marker color). */
  dominantType: ErrorType;
  /** CSS color string for the marker pip. */
  color: string;
  /** Stats signatures merged into this marker (for getErrorsAtLocation lookup). */
  signatures: string[];
}

// Distinct colors per error type. Used by the modal / log pane only — NOT by
// the mushaf marker color. Tuned from DESIGN-SYSTEM §15.1.
export const ERROR_TYPE_COLOR: Record<ErrorType, string> = {
  tajweed: '#c2410c', // amber-red
  pronunciation: '#9333ea', // violet
  omission: '#dc2626', // red
  addition: '#0891b2', // cyan
  mismatch: '#ea580c', // orange
  wrong_verse: '#7c3aed', // deep purple — the differentiator
  forgotten_verse: '#b91c1c', // brick
  hesitation: '#ca8a04', // honey
};

// Heatmap ramp: 5 bands keyed off intensity. Anything < 0.2 → faint yellow,
// 1.0+ → saturated red. DESIGN-SYSTEM §15.2 mentions a ramp; this is the MVP.
function heatmapColor(intensity: number): string {
  if (intensity < 0.2) return '#fde68a'; // pale honey
  if (intensity < 0.5) return '#fbbf24'; // honey
  if (intensity < 1.0) return '#f97316'; // orange
  if (intensity < 2.0) return '#dc2626'; // red
  return '#7f1d1d'; // dark crimson
}

function colorFor(mode: OverlayMode, intensity: number): string {
  if (mode === 'none') return 'transparent';
  return heatmapColor(intensity);
}

function intensityOf(row: ErrorLocationStatsRow): number {
  // DESIGN.md §9.5 — recency-weighted occurrence count.
  return row.occurrence_count / (1 + row.tests_since_last_occurrence);
}

/**
 * Filter the student's stats to rows whose (surah, ayah) lies on this page,
 * using the static quran-index for bounds lookup. Cheap because each page's
 * window is at most ~20 ayahs.
 */
function statsOnPage(
  stats: ErrorLocationStatsRow[],
  pageNumber: number,
  index: QuranIndex,
): ErrorLocationStatsRow[] {
  const page = index.pages[String(pageNumber)];
  if (!page) return [];
  return stats.filter((s) => {
    if (s.cleared) return false;
    if (s.surah_number < page.surah_start || s.surah_number > page.surah_end) return false;
    if (s.surah_number === page.surah_start && s.ayah_number < page.ayah_start) return false;
    if (s.surah_number === page.surah_end && s.ayah_number > page.ayah_end) return false;
    return true;
  });
}

export function getOverlayMarkers(
  pageNumber: number,
  stats: ErrorLocationStatsRow[],
  mode: OverlayMode,
  index: QuranIndex,
): OverlayMarker[] {
  if (mode === 'none') return [];
  const rows = statsOnPage(stats, pageNumber, index);
  if (rows.length === 0) return [];

  // Group by (surah, ayah, word_position-or-verse).
  const buckets = new Map<string, ErrorLocationStatsRow[]>();
  for (const row of rows) {
    const scope: OverlayScope = row.word_position == null ? 'verse' : 'word';
    const key = `${row.surah_number}:${row.ayah_number}:${scope === 'verse' ? 'end' : row.word_position}`;
    const list = buckets.get(key);
    if (list) list.push(row);
    else buckets.set(key, [row]);
  }

  const markers: OverlayMarker[] = [];
  for (const [key, list] of buckets) {
    // Most-recent error type by last_seen_at.
    const dominant = [...list].sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))[0]
      ?.error_type;
    const intensity = list.reduce((m, r) => Math.max(m, intensityOf(r)), 0);
    const totalCount = list.reduce((sum, r) => sum + r.occurrence_count, 0);
    const [, , posKey] = key.split(':');
    const scope: OverlayScope = posKey === 'end' ? 'verse' : 'word';
    const first = list[0];
    if (!first || !dominant) continue;
    markers.push({
      scope,
      surah: first.surah_number,
      ayah: first.ayah_number,
      wordPosition: scope === 'word' ? Number(posKey) : undefined,
      count: totalCount,
      intensity,
      dominantType: dominant,
      color: colorFor(mode, intensity),
      signatures: list.map((r) => r.signature),
    });
  }
  return markers;
}

/**
 * Returns the merged-marker key matching a word at (surah, ayah, position).
 * Helper used by MushafPage's WordSpan to look up its marker in O(1).
 */
export function markerKeyForWord(surah: number, ayah: number, position: number): string {
  return `${surah}:${ayah}:${position}`;
}
export function markerKeyForVerse(surah: number, ayah: number): string {
  return `${surah}:${ayah}:end`;
}
export function markerKey(m: OverlayMarker): string {
  return m.scope === 'verse'
    ? markerKeyForVerse(m.surah, m.ayah)
    : markerKeyForWord(m.surah, m.ayah, m.wordPosition!);
}

/**
 * Phase D stub for the error detail modal (M7). Filters a list of ErrorLog
 * occurrences down to those at a given location. The live-test pane uses this
 * to show the running list of errors so far in the current test.
 */
export interface ErrorAtLocationInput {
  surah_number: number;
  ayah_number: number;
  word_position: number | null;
}
export function getErrorsAtLocation<T extends ErrorAtLocationInput>(
  errors: T[],
  surah: number,
  ayah: number,
  wordPosition?: number,
): T[] {
  return errors.filter((e) => {
    if (e.surah_number !== surah || e.ayah_number !== ayah) return false;
    if (wordPosition == null) return e.word_position == null;
    return e.word_position === wordPosition;
  });
}

/**
 * Adapter — convert the live-test session's in-memory `LoggedError`-shaped
 * rows into stats-row shape so `getOverlayMarkers` can render them on the
 * mushaf during the test, before any submission to `error_location_stats`.
 *
 * Groups by (surah, ayah, word, error_type). `tests_since_last_occurrence`
 * is 0 (we're inside the test), `cleared` is false. The count is the number
 * of times the same signature was logged in this session.
 */
export interface LoggedErrorLike {
  surah: number;
  ayah: number;
  word_position: number | null;
  error_type: ErrorType;
  created_at: string;
}
export function loggedErrorsToStats(errors: LoggedErrorLike[]): ErrorLocationStatsRow[] {
  const buckets = new Map<string, { e: LoggedErrorLike; count: number; latest: string }>();
  for (const e of errors) {
    const key = `${e.surah}:${e.ayah}:${e.word_position ?? 'end'}:${e.error_type}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      if (e.created_at > existing.latest) existing.latest = e.created_at;
    } else {
      buckets.set(key, { e, count: 1, latest: e.created_at });
    }
  }
  const out: ErrorLocationStatsRow[] = [];
  for (const { e, count, latest } of buckets.values()) {
    out.push({
      id: '',
      student_id: '',
      signature: `${e.surah}:${e.ayah}:${e.word_position ?? ''}:${e.error_type}`,
      surah_number: e.surah,
      ayah_number: e.ayah,
      word_position: e.word_position,
      error_type: e.error_type,
      occurrence_count: count,
      first_seen_at: latest,
      last_seen_at: latest,
      tests_since_last_occurrence: 0,
      cleared: false,
      updated_at: latest,
    });
  }
  return out;
}
