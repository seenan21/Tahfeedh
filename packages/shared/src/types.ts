// Enums mirroring supabase schema (see DESIGN.md §12.2)

export type UserRole = 'student' | 'teacher';

export type MemorizationStatus = 'in_progress' | 'memorized';

export type TestType = 'newly_memorized' | 'revision';

export type TestStatus = 'in_progress' | 'completed' | 'abandoned';

// Collapsed to pass | repeat (ADR 0046). The DB enum still contains the legacy
// values (strong_pass, excellent, good, pass_needs_practice, needs_work, fail)
// because Postgres can't DROP VALUE, but historical rows were migrated to
// pass/repeat in migration 0029 and no new code writes the legacy values.
export type TestRating = 'pass' | 'repeat';

export type ErrorType =
  | 'tajweed'
  | 'pronunciation'
  | 'omission'
  | 'addition'
  | 'mismatch'
  | 'wrong_verse'
  | 'forgotten_verse'
  | 'hesitation';

// Scope partitioning per ADR 0034. Word-scope types must carry word_position;
// verse-scope types must have word_position = NULL. Enforced by logErrorSchema.
export type ErrorScope = 'word' | 'verse';

export const WORD_SCOPE_ERROR_TYPES = [
  'tajweed',
  'pronunciation',
  'omission',
  'addition',
  'mismatch',
] as const satisfies readonly ErrorType[];

export const VERSE_SCOPE_ERROR_TYPES = [
  'wrong_verse',
  'forgotten_verse',
  'hesitation',
] as const satisfies readonly ErrorType[];

export function scopeOfErrorType(t: ErrorType): ErrorScope {
  return (VERSE_SCOPE_ERROR_TYPES as readonly ErrorType[]).includes(t) ? 'verse' : 'word';
}

// Test mode (ADR 0004). enrolled_teacher = teacher_id is set; guest_teacher =
// teacher_id is null, optional guest_tester_name captured for the record.
export type TestMode = 'enrolled_teacher' | 'guest_teacher';

export type EnrollmentStatus = 'active' | 'paused' | 'completed';

export type GoalStatus = 'active' | 'completed' | 'abandoned';

// Test ranges (DESIGN.md §8.4)

export type TestRange =
  | { type: 'page'; start: number; end: number }
  | { type: 'surah'; surah: number }
  | { type: 'ayah'; surah: number; start_ayah: number; end_ayah: number }
  | { type: 'juz'; juz: number }
  | { type: 'hizb'; hizb: number }
  | { type: 'rub'; rub: number };

// Mushaf page data (emitted by scripts/build-quran-data.ts)
// Words carry a Private Use Area code point (`code_v2`) that only renders
// correctly against the matching per-page QPC V2 font — see ADR 0003.

export type LineType = 'ayah' | 'surah_name' | 'basmallah';

export type WordCharType = 'word' | 'end' | 'pause' | 'rub-el-hizb' | 'sajdah';

export interface MushafWord {
  id: string;
  surah: number;
  ayah: number;
  position: number;
  code_v2: string;
  char_type: WordCharType;
}

export interface MushafLine {
  line_number: number;
  line_type: LineType;
  is_centered: boolean;
  surah_number?: number;
  words: MushafWord[];
}

export interface MidpointAyahBreak {
  first_half_last_ayah: { surah: number; ayah: number };
  second_half_first_ayah: { surah: number; ayah: number };
  first_half_line_count: number;
  second_half_line_count: number;
}

export interface MushafPageData {
  page_number: number;
  lines: MushafLine[];
  midpoint_ayah_break: MidpointAyahBreak;
}

// Queue 1 RPC return shape (next_new_lesson, ADR 0013)
export type NextNewLessonKind = 'continue' | 'begin';

export interface NextNewLesson {
  page_number: number;
  kind: NextNewLessonKind;
}

// Today's session plan (ADR 0020 frozen-per-index model; ADR 0048 unified
// revision scoring). Returned by the `today_session` SQL RPC and by
// `load_next_session`. The plan itself is persisted in daily_session; the
// `attempted` flag is derived at read time from completed tests today whose
// page-typed ranges include the row's page (pass or fail).
//
// `kind` ('recent' | 'older') is present on revision rows only — it lets the
// UI render Recent/Older sub-headers without re-deriving from ayah_review_state.
// New-lesson rows omit it.
export interface TodaySessionNewRow {
  page_number: number;
  attempted: boolean;
}

export type RevisionRowKind = 'recent' | 'older';

export interface TodaySessionRevisionRow {
  page_number: number;
  attempted: boolean;
  kind: RevisionRowKind;
}

// Back-compat alias — pre-ADR 0048 callers that only typed the new-lesson shape.
export type TodaySessionRow = TodaySessionNewRow;

export interface TodaySession {
  session_id: string;
  session_date: string;
  session_index: number;
  new_lesson_pages: TodaySessionNewRow[];
  revision_pages: TodaySessionRevisionRow[];
  all_attempted: boolean;
}

// Hifz direction preference (ADR 0014). 'forward' = Baqarah-first (page 1 → 604),
// 'backward' = Juz-Amma-first (page 604 → 1). Used by next_new_lesson and the
// post-test pipeline (Phase D / M5) when picking the next page to suggest.
export type HifzDirection = 'forward' | 'backward';

// Quran index (emitted by scripts/build-quran-data.ts → quran-index.json)

export interface PageIndexEntry {
  surah_start: number;
  ayah_start: number;
  surah_end: number;
  ayah_end: number;
}

export interface SurahIndexEntry {
  start_page: number;
  end_page: number;
  ayah_count: number;
  // Sparse map: ayah_number → first page on which that ayah appears.
  first_ayah_page_map: Record<string, number>;
}

export interface JuzIndexEntry {
  pages: [number, number];
  // Surah number → [first_ayah, last_ayah] within this juz.
  ayah_ranges: Record<string, [number, number]>;
}

export interface QuranIndex {
  pages: Record<string, PageIndexEntry>;
  surahs: Record<string, SurahIndexEntry>;
  juzs: Record<string, JuzIndexEntry>;
  total_pages: number;
}

// Phase D — live tests + errors (DESIGN.md §8, §9, §13, §14.5, §14.6).
// Server endpoints: POST /api/tests/create, POST /api/tests/:id/error,
// POST /api/tests/:id/finish (calls submit_test SQL fn from migration 0016).
// Request input types are inferred from Zod in schema.ts (TestCreateInput,
// LogErrorInput, FinishTestInput); response types live here.

export interface PostTestSummaryRow {
  signature: string;
  surah: number;
  ayah: number;
  wordPosition: number | null;
  errorType: ErrorType;
  occurrenceCount: number;
}

export interface PostTestSummary {
  testId: string;
  new: PostTestSummaryRow[];
  recurring: PostTestSummaryRow[];
  cleared: PostTestSummaryRow[];
}

// Read shape for client overlay computation (ADR 0011). Mirrors the
// error_location_stats table; populate via direct Supabase select under RLS.
export interface ErrorLocationStatsRow {
  id: string;
  student_id: string;
  signature: string;
  surah_number: number;
  ayah_number: number;
  word_position: number | null;
  error_type: ErrorType;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  tests_since_last_occurrence: number;
  cleared: boolean;
  updated_at: string;
}

// QF API response shapes (minimal — expand as needed)

export interface QfChapter {
  id: number;
  revelation_place: string;
  revelation_order: number;
  bismillah_pre: boolean;
  name_simple: string;
  name_complex: string;
  name_arabic: string;
  verses_count: number;
  pages: [number, number];
  translated_name: { language_name: string; name: string };
}
