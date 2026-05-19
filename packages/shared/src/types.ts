// Enums mirroring supabase schema (see DESIGN.md §12.2)

export type UserRole = 'student' | 'teacher';

export type MemorizationStatus = 'in_progress' | 'memorized' | 'mastered';

export type TestType = 'newly_memorized' | 'revision';

export type TestStatus = 'in_progress' | 'completed' | 'abandoned';

export type TestRating =
  | 'strong_pass'
  | 'pass_needs_practice'
  | 'excellent'
  | 'good'
  | 'needs_work'
  | 'fail';

export type ErrorType =
  | 'tajweed'
  | 'pronunciation'
  | 'omission'
  | 'addition'
  | 'mismatch'
  | 'wrong_verse'
  | 'forgotten_verse'
  | 'hesitation';

export type ErrorSeverity = 'minor' | 'moderate' | 'major';

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

// Marking endpoint (Phase C — ADR 0012)

export type MemorizationMarkStatus = 'memorized' | 'in_progress' | 'untouched';

// Wire payload to POST /api/memorization/mark. The server expands `pageNumber`
// into the page's full ayah set before calling mark_memorization SQL fn.
export interface MarkMemorizationInput {
  pageNumber: number;
  status: MemorizationMarkStatus;
  // Required when status === 'in_progress'. Each entry must be an ayah that
  // lives on `pageNumber` (validated server-side against quran-index.json).
  verses?: Array<{ surah: number; ayah: number }>;
}

// Queue 1 RPC return shape (next_new_lesson, ADR 0013)
export type NextNewLessonKind = 'continue' | 'begin';

export interface NextNewLesson {
  page_number: number;
  kind: NextNewLessonKind;
}

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
