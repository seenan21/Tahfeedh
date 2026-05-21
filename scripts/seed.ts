/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * scripts/seed.ts
 *
 * Demo seed for the Quran Foundation Hackathon submission. Three accounts:
 *
 *   hassan@tahfeedh.app / password123  — Ustaadh Hassan Jameel (teacher)
 *   ahmad@tahfeedh.app  / password123  — Ahmad, junior student
 *                                          (memorized surahs 105–114; many errors)
 *   yusuf@tahfeedh.app  / password123  — Yusuf, senior student
 *                                          (memorized juz 1 + 28 + 29 + 30; mostly clean)
 *
 * Both students enrolled with Hassan in a group called "Halaqa A".
 *
 * Runs as `npm run seed` from the repo root. Reads SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY from the root `.env`. Cleans up the three demo
 * accounts by email before re-creating, so re-running is idempotent.
 */
import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import quranIndexJson from '../apps/web/src/data/quran-index.json';

// -------------------------------------------------------------------------
// Types matching the slice of @tahfeedh/shared we need (kept inline to avoid
// pulling the package into the script's tsconfig path).
// -------------------------------------------------------------------------
interface QuranIndex {
  total_pages: number;
  pages: Record<string, {
    surah_start: number;
    ayah_start: number;
    surah_end: number;
    ayah_end: number;
  }>;
  surahs: Record<string, {
    start_page: number;
    end_page: number;
    ayah_count: number;
    first_ayah_page_map: Record<string, number>;
  }>;
  juzs: Record<string, {
    pages: [number, number];
    ayah_ranges: Record<string, [number, number]>;
  }>;
}
const idx = quranIndexJson as unknown as QuranIndex;

type ErrorType =
  | 'tajweed'
  | 'pronunciation'
  | 'omission'
  | 'addition'
  | 'mismatch'
  | 'wrong_verse'
  | 'forgotten_verse'
  | 'hesitation';

type Rating = 'fail' | 'needs_work' | 'pass_needs_practice' | 'good' | 'strong_pass' | 'excellent';

// -------------------------------------------------------------------------
// Env + client
// -------------------------------------------------------------------------
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// -------------------------------------------------------------------------
// Demo constants
// -------------------------------------------------------------------------
const PASSWORD = 'password123';
const TEACHER = {
  email: 'hassan@tahfeedh.app',
  display: 'Ustaadh Hassan Jameel',
  role: 'teacher' as const,
};
const JUNIOR = {
  email: 'ahmad@tahfeedh.app',
  display: 'Ahmad',
  role: 'student' as const,
};
const SENIOR = {
  email: 'yusuf@tahfeedh.app',
  display: 'Yusuf',
  role: 'student' as const,
};

const GROUP_NAME = 'Halaqa A';

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------
function isoDaysAgo(days: number, hour = 10, minute = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}
function addMinutes(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString();
}
function errorSignature(surah: number, ayah: number, word: number | null, type: ErrorType): string {
  return `${surah}:${ayah}:${word ?? ''}:${type}`;
}

// Tiny deterministic PRNG so the seed is reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260520);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;
const between = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

// -------------------------------------------------------------------------
// 1. Cleanup any pre-existing demo users.
// -------------------------------------------------------------------------
async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  let page = 1;
  // perPage max is 1000 in Supabase JS v2
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return { id: found.id };
    if (data.users.length < 1000) return null;
    page++;
  }
}

async function cleanup(): Promise<void> {
  const emails = [TEACHER.email, JUNIOR.email, SENIOR.email];
  for (const email of emails) {
    const u = await findUserByEmail(email);
    if (u) {
      const { error } = await supabase.auth.admin.deleteUser(u.id);
      if (error) throw error;
      console.log(`  • cleaned up ${email}`);
    }
  }
}

// -------------------------------------------------------------------------
// 2. Create auth user + app_user row.
// -------------------------------------------------------------------------
async function createAccount(acc: typeof TEACHER | typeof JUNIOR | typeof SENIOR): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: acc.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: acc.display },
  });
  if (error) throw error;
  const id = data.user!.id;

  const profile: Record<string, unknown> = {
    id,
    role: acc.role,
    display_name: acc.display,
  };
  if (acc.role === 'teacher') profile.has_completed_quran = true;

  const { error: pErr } = await supabase.from('app_user').insert(profile);
  if (pErr) throw pErr;
  return id;
}

// -------------------------------------------------------------------------
// 3. Onboarding payload builder + commit_onboarding RPC.
// -------------------------------------------------------------------------
interface AyahKey { surah: number; ayah: number }
interface CommitOnboardingPayload {
  memorizedPages: number[];
  inProgress?: { page: number; verses: AyahKey[] };
  ayahReviewStates: AyahKey[];
  newPerDay: number;
  revisionPerDay: number;
  hasCompletedQuran: boolean;
  hifzDirection: 'forward' | 'backward';
}

function buildJuniorOnboarding(): CommitOnboardingPayload {
  // Surahs 105–114 → pages 601–604 (all fully memorized; the boundary is
  // clean — each surah is whole). Direction is backward (frontier moves
  // from 600 toward page 1) — matches the traditional Juz Amma first path.
  const memorizedPages = new Set<number>();
  const ayahKeys = new Set<string>();
  for (let s = 105; s <= 114; s++) {
    const surahInfo = idx.surahs[String(s)];
    if (!surahInfo) continue;
    for (let p = surahInfo.start_page; p <= surahInfo.end_page; p++) memorizedPages.add(p);
    for (let a = 1; a <= surahInfo.ayah_count; a++) ayahKeys.add(`${s}:${a}`);
  }
  const ayahReviewStates: AyahKey[] = Array.from(ayahKeys).map((k) => {
    const [s, a] = k.split(':');
    return { surah: Number(s), ayah: Number(a) };
  });
  return {
    memorizedPages: Array.from(memorizedPages).sort((a, b) => a - b),
    ayahReviewStates,
    newPerDay: 0.5,
    revisionPerDay: 3,
    hasCompletedQuran: false,
    hifzDirection: 'backward',
  };
}

function buildSeniorOnboarding(): CommitOnboardingPayload {
  // Juz 1 + 28 + 29 + 30 fully memorized.
  const memorizedPages = new Set<number>();
  const ayahKeys = new Set<string>();
  for (const j of [1, 28, 29, 30]) {
    const juz = idx.juzs[String(j)];
    if (!juz) continue;
    for (let p = juz.pages[0]; p <= juz.pages[1]; p++) memorizedPages.add(p);
    for (const [surahStr, range] of Object.entries(juz.ayah_ranges)) {
      const surah = Number(surahStr);
      const [start, end] = range;
      for (let a = start; a <= end; a++) ayahKeys.add(`${surah}:${a}`);
    }
  }
  const ayahReviewStates: AyahKey[] = Array.from(ayahKeys).map((k) => {
    const [s, a] = k.split(':');
    return { surah: Number(s), ayah: Number(a) };
  });
  return {
    memorizedPages: Array.from(memorizedPages).sort((a, b) => a - b),
    ayahReviewStates,
    newPerDay: 1,
    revisionPerDay: 5,
    hasCompletedQuran: false,
    hifzDirection: 'backward',
  };
}

async function commitOnboarding(studentId: string, payload: CommitOnboardingPayload): Promise<void> {
  const { error } = await supabase.rpc('commit_onboarding', {
    p_student_id: studentId,
    p_payload: payload as unknown as Record<string, unknown>,
  });
  if (error) throw error;
}

// -------------------------------------------------------------------------
// 4. Group + enrollment
// -------------------------------------------------------------------------
async function createGroup(teacherId: string, name: string): Promise<string> {
  const { data, error } = await supabase
    .from('student_group')
    .insert({ teacher_id: teacherId, name })
    .select('id')
    .single();
  if (error) throw error;
  return data!.id as string;
}

async function enroll(teacherId: string, studentId: string, groupId: string | null): Promise<void> {
  const { error } = await supabase
    .from('enrollment')
    .insert({ teacher_id: teacherId, student_id: studentId, group_id: groupId, status: 'active' });
  if (error) throw error;
}

// -------------------------------------------------------------------------
// 5. Test seeding.
// -------------------------------------------------------------------------

interface TestSpec {
  studentId: string;
  teacherId: string;
  testType: 'newly_memorized' | 'revision';
  pageStart: number;
  pageEnd: number;
  startedAt: string; // ISO
  durationMinutes: number;
  rating: Rating;
  notes: string | null;
  errors: ErrorSpec[];
}

interface ErrorSpec {
  surah: number;
  ayah: number;
  word_position: number | null;
  error_type: ErrorType;
  teacher_note: string | null;
  related_surah?: number;
  related_ayah?: number;
}

function pageToAyahKeys(page: number): AyahKey[] {
  const p = idx.pages[String(page)];
  if (!p) return [];
  // Approximate: iterate surahs covered by this page and emit each ayah on the page.
  const out: AyahKey[] = [];
  for (let s = p.surah_start; s <= p.surah_end; s++) {
    const surahInfo = idx.surahs[String(s)];
    if (!surahInfo) continue;
    const startA = s === p.surah_start ? p.ayah_start : 1;
    const endA = s === p.surah_end ? p.ayah_end : surahInfo.ayah_count;
    for (let a = startA; a <= endA; a++) out.push({ surah: s, ayah: a });
  }
  return out;
}

// Random word position for a marker — most words on a Mushaf line are 3–6 words,
// so 1–8 is a safe range. Some errors are verse-scope (word_position null).
function randomWord(scope: 'word' | 'verse'): number | null {
  if (scope === 'verse') return null;
  return between(1, 8);
}

// -------------- Junior test generator (Ahmad) --------------
function buildAhmadTests(studentId: string, teacherId: string): TestSpec[] {
  const tests: TestSpec[] = [];
  // 12 tests over 14 days. All newly_memorized on pages 601–604.
  // Ratings progress from 'needs_work' to 'good' over time.
  const arc: { daysAgo: number; rating: Rating; page: number; errors: number }[] = [
    { daysAgo: 14, rating: 'needs_work',         page: 604, errors: 7 },
    { daysAgo: 13, rating: 'needs_work',         page: 604, errors: 6 },
    { daysAgo: 12, rating: 'pass_needs_practice',page: 604, errors: 4 },
    { daysAgo: 11, rating: 'fail',               page: 603, errors: 8 },
    { daysAgo: 10, rating: 'needs_work',         page: 603, errors: 6 },
    { daysAgo: 8,  rating: 'pass_needs_practice',page: 603, errors: 4 },
    { daysAgo: 7,  rating: 'good',               page: 602, errors: 3 },
    { daysAgo: 6,  rating: 'pass_needs_practice',page: 602, errors: 5 },
    { daysAgo: 4,  rating: 'good',               page: 602, errors: 3 },
    { daysAgo: 3,  rating: 'good',               page: 601, errors: 3 },
    { daysAgo: 2,  rating: 'pass_needs_practice',page: 601, errors: 4 },
    { daysAgo: 1,  rating: 'good',               page: 601, errors: 2 },
  ];

  const wordErrTypes: ErrorType[] = ['tajweed', 'pronunciation', 'omission', 'addition', 'mismatch'];
  const verseErrTypes: ErrorType[] = ['wrong_verse', 'forgotten_verse', 'hesitation'];

  for (const t of arc) {
    const ayahs = pageToAyahKeys(t.page);
    const errors: ErrorSpec[] = [];
    if (ayahs.length === 0) {
      // Index gap (e.g. page 595 metadata is degenerate). Skip errors,
      // still record the test so the history surface has the entry.
      tests.push({
        studentId,
        teacherId,
        testType: t.testType ?? 'newly_memorized',
        pageStart: t.page,
        pageEnd: t.page,
        startedAt: isoDaysAgo(t.daysAgo, between(9, 18), between(0, 50)),
        durationMinutes: between(10, 22),
        rating: t.rating,
        notes: null,
        errors: [],
      });
      continue;
    }
    for (let i = 0; i < t.errors; i++) {
      const a = pick(ayahs);
      if (!a) continue;
      const isVerseScope = rng() < 0.25;
      const type: ErrorType = isVerseScope ? pick(verseErrTypes) : pick(wordErrTypes);
      errors.push({
        surah: a.surah,
        ayah: a.ayah,
        word_position: randomWord(isVerseScope ? 'verse' : 'word'),
        error_type: type,
        teacher_note:
          rng() < 0.35
            ? pick([
                'Heavy letter — open the mouth.',
                'Pause clearly here.',
                'Watch the meem sākin.',
                'Read this aloud 3x before next test.',
                'Ghunnah duration short.',
              ])
            : null,
        ...(type === 'wrong_verse'
          ? { related_surah: a.surah, related_ayah: Math.max(1, a.ayah - 1) }
          : {}),
      });
    }
    tests.push({
      studentId,
      teacherId,
      testType: 'newly_memorized',
      pageStart: t.page,
      pageEnd: t.page,
      startedAt: isoDaysAgo(t.daysAgo, between(9, 18), between(0, 50)),
      durationMinutes: between(10, 22),
      rating: t.rating,
      notes:
        rng() < 0.4
          ? pick([
              'Lots of slips on the heavy letters today.',
              'Improving — keep at it.',
              'Strong start, lost focus mid-way.',
              'Review tajweed rules tonight.',
              null as unknown as string,
            ]) ?? null
          : null,
      errors,
    });
  }
  return tests;
}

// -------------- Senior test generator (Yusuf) --------------
function buildYusufTests(studentId: string, teacherId: string): TestSpec[] {
  const tests: TestSpec[] = [];
  // 10 tests over 21 days. Mix of revision (across his juz set) + 2 newly_memorized
  // touching his frontier (page 541 — start of "next" before juz 28). Most ratings
  // strong_pass / good / excellent; sparse errors.
  const reviewPages = [
    // From juz 30 (last)
    604, 603, 602, 601, 600, 598, 595, 590,
    // From juz 29
    580, 575, 570, 565,
    // From juz 28
    560, 555, 545,
    // From juz 1
    5, 10, 15, 20,
  ];
  const arc: { daysAgo: number; rating: Rating; testType: 'newly_memorized' | 'revision'; page: number; errors: number }[] = [
    { daysAgo: 21, rating: 'good',       testType: 'revision',         page: 604, errors: 2 },
    { daysAgo: 19, rating: 'strong_pass',testType: 'revision',         page: 580, errors: 0 },
    { daysAgo: 16, rating: 'good',       testType: 'revision',         page: 600, errors: 1 },
    { daysAgo: 13, rating: 'excellent',  testType: 'revision',         page: 20,  errors: 0 },
    { daysAgo: 11, rating: 'strong_pass',testType: 'revision',         page: 560, errors: 1 },
    { daysAgo: 9,  rating: 'pass_needs_practice',testType: 'revision', page: 593, errors: 2 },
    { daysAgo: 7,  rating: 'good',       testType: 'revision',         page: 555, errors: 1 },
    { daysAgo: 5,  rating: 'strong_pass',testType: 'revision',         page: 575, errors: 0 },
    { daysAgo: 3,  rating: 'excellent',  testType: 'revision',         page: 10,  errors: 0 },
    { daysAgo: 1,  rating: 'good',       testType: 'revision',         page: 565, errors: 1 },
  ];

  const wordErrTypes: ErrorType[] = ['tajweed', 'pronunciation', 'addition'];

  for (const t of arc) {
    const ayahs = pageToAyahKeys(t.page);
    const errors: ErrorSpec[] = [];
    if (ayahs.length === 0) {
      // Index gap (e.g. page 595 metadata is degenerate). Skip errors,
      // still record the test so the history surface has the entry.
      tests.push({
        studentId,
        teacherId,
        testType: t.testType ?? 'newly_memorized',
        pageStart: t.page,
        pageEnd: t.page,
        startedAt: isoDaysAgo(t.daysAgo, between(9, 18), between(0, 50)),
        durationMinutes: between(10, 22),
        rating: t.rating,
        notes: null,
        errors: [],
      });
      continue;
    }
    for (let i = 0; i < t.errors; i++) {
      const a = pick(ayahs);
      if (!a) continue;
      errors.push({
        surah: a.surah,
        ayah: a.ayah,
        word_position: between(1, 6),
        error_type: pick(wordErrTypes),
        teacher_note: rng() < 0.5 ? pick([
          'Slight overcompensation on the madd.',
          'Brief slip — clean otherwise.',
          'Watch the qalqalah letter.',
        ]) : null,
      });
    }
    tests.push({
      studentId,
      teacherId,
      testType: t.testType,
      pageStart: t.page,
      pageEnd: t.page,
      startedAt: isoDaysAgo(t.daysAgo, between(9, 19), between(0, 50)),
      durationMinutes: between(8, 18),
      rating: t.rating,
      notes:
        rng() < 0.3
          ? pick([
              'Sharp recall. Good ghunnah.',
              'Solid revision — flagged 1 letter.',
              'Excellent flow start to finish.',
            ])
          : null,
      errors,
    });
  }

  // Tip: 'reviewPages' is just the inventory we drew from; not all are used per test
  void reviewPages;
  return tests;
}

// -------------- Insert a single test + its errors + stats --------------
async function insertTest(t: TestSpec): Promise<void> {
  const endedAt = addMinutes(t.startedAt, t.durationMinutes);
  // Compute summary up-front from the error list (NEW/RECURRING/CLEARED).
  // For seed simplicity, we mark each unique signature as NEW the first
  // time it appears for this student and RECURRING if we've already seen
  // it. We don't compute CLEARED in the seed — leaving it empty is fine.
  const newErrors: ErrorSpec[] = [];
  const recurringErrors: ErrorSpec[] = [];
  for (const e of t.errors) {
    const sig = errorSignature(e.surah, e.ayah, e.word_position, e.error_type);
    const { data: existing } = await supabase
      .from('error_location_stats')
      .select('id, occurrence_count')
      .eq('student_id', t.studentId)
      .eq('signature', sig)
      .maybeSingle();
    if (existing) {
      recurringErrors.push(e);
      await supabase
        .from('error_location_stats')
        .update({
          occurrence_count: (existing.occurrence_count as number) + 1,
          last_seen_at: endedAt,
          tests_since_last_occurrence: 0,
          cleared: false,
        })
        .eq('id', existing.id);
    } else {
      newErrors.push(e);
      await supabase.from('error_location_stats').insert({
        student_id: t.studentId,
        signature: sig,
        surah_number: e.surah,
        ayah_number: e.ayah,
        word_position: e.word_position,
        error_type: e.error_type,
        occurrence_count: 1,
        first_seen_at: endedAt,
        last_seen_at: endedAt,
        tests_since_last_occurrence: 0,
        cleared: false,
      });
    }
  }

  const summary = {
    new: newErrors.map((e) => ({
      surah: e.surah,
      ayah: e.ayah,
      word_position: e.word_position,
      error_type: e.error_type,
    })),
    recurring: recurringErrors.map((e) => ({
      surah: e.surah,
      ayah: e.ayah,
      word_position: e.word_position,
      error_type: e.error_type,
    })),
    cleared: [] as unknown[],
  };

  // Insert the test row directly in 'completed' state (rating + ended_at set
  // to satisfy the migration 0004 check constraint).
  const { data: testRow, error: testErr } = await supabase
    .from('test')
    .insert({
      student_id: t.studentId,
      teacher_id: t.teacherId,
      test_type: t.testType,
      test_mode: 'enrolled_teacher',
      status: 'completed',
      rating: t.rating,
      ranges: [{ type: 'page', start: t.pageStart, end: t.pageEnd }],
      notes: t.notes,
      started_at: t.startedAt,
      ended_at: endedAt,
      summary,
    })
    .select('id')
    .single();
  if (testErr) throw testErr;
  const testId = testRow!.id as string;

  // Insert error_log rows. created_at backdated to the test window.
  if (t.errors.length > 0) {
    const rows = t.errors.map((e, i) => ({
      test_id: testId,
      student_id: t.studentId,
      surah_number: e.surah,
      ayah_number: e.ayah,
      word_position: e.word_position,
      word_position_end: null as number | null,
      error_type: e.error_type,
      teacher_note: e.teacher_note,
      related_surah: e.related_surah ?? null,
      related_ayah: e.related_ayah ?? null,
      created_at: addMinutes(t.startedAt, Math.min(t.durationMinutes - 1, 2 + i)),
    }));
    const { error: elErr } = await supabase.from('error_log').insert(rows);
    if (elErr) throw elErr;
  }

  // Touch ayah_review_state.last_reviewed_at for every covered ayah on the page.
  const covered = pageToAyahKeys(t.pageStart);
  for (const k of covered) {
    await supabase
      .from('ayah_review_state')
      .update({ last_reviewed_at: endedAt, updated_at: endedAt })
      .eq('student_id', t.studentId)
      .eq('surah_number', k.surah)
      .eq('ayah_number', k.ayah);
  }
}

async function seedTests(label: string, tests: TestSpec[]): Promise<void> {
  // Insert chronologically so error_location_stats NEW/RECURRING logic
  // matches what would happen in real life.
  tests.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  let i = 0;
  for (const t of tests) {
    i++;
    await insertTest(t);
    process.stdout.write(`    ${label}: ${i}/${tests.length}\r`);
  }
  process.stdout.write(`    ${label}: ${tests.length} tests inserted          \n`);
}

// -------------------------------------------------------------------------
// 6. Stage-machine seasoning — set recent_stage + ready_at on a sample of
// ayahs so the revision queue surfaces realistic Queue 2 entries.
// -------------------------------------------------------------------------
async function seedStageMachine(studentId: string, pages: number[]): Promise<void> {
  // For each page, set one ayah to each of (stage 1, ready now), (stage 2, ready in 2d),
  // (stage 3, ready in 6d). Stops once we've placed 3 stage rows per page or run out.
  for (const page of pages) {
    const ayahs = pageToAyahKeys(page);
    if (ayahs.length === 0) continue;
    const stages: Array<{ stage: number; readyAtDays: number }> = [
      { stage: 1, readyAtDays: 0 },
      { stage: 2, readyAtDays: 2 },
      { stage: 3, readyAtDays: 6 },
    ];
    for (let i = 0; i < Math.min(stages.length, ayahs.length); i++) {
      const s = stages[i]!;
      const a = ayahs[i]!;
      const readyAt = new Date();
      readyAt.setUTCDate(readyAt.getUTCDate() + s.readyAtDays);
      await supabase
        .from('ayah_review_state')
        .update({
          recent_stage: s.stage,
          ready_at: readyAt.toISOString(),
          consecutive_clean_tests: 0,
        })
        .eq('student_id', studentId)
        .eq('surah_number', a.surah)
        .eq('ayah_number', a.ayah);
    }
  }
}

// Promote a few pages to mastered for the senior student so the progress
// dashboard shows variety.
async function promoteSomePagesToMastered(studentId: string, pages: number[]): Promise<void> {
  if (pages.length === 0) return;
  const { error } = await supabase
    .from('memorization_page')
    .update({ status: 'mastered', mastered_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .in('page_number', pages);
  if (error) throw error;
}

// -------------------------------------------------------------------------
// main
// -------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('\n=== Tahfeedh seed ===\n');
  console.log('1. Cleanup');
  await cleanup();

  console.log('2. Create accounts');
  const teacherId = await createAccount(TEACHER);
  console.log(`  • teacher  ${TEACHER.email}  ${teacherId}`);
  const juniorId = await createAccount(JUNIOR);
  console.log(`  • junior   ${JUNIOR.email}   ${juniorId}`);
  const seniorId = await createAccount(SENIOR);
  console.log(`  • senior   ${SENIOR.email}   ${seniorId}`);

  console.log('3. Onboard students');
  await commitOnboarding(juniorId, buildJuniorOnboarding());
  console.log(`  • ${JUNIOR.email} — surahs 105–114 (pages 601–604), 0.5 new + 3 revision/day, backward`);
  await commitOnboarding(seniorId, buildSeniorOnboarding());
  console.log(`  • ${SENIOR.email} — juz 1 + 28–30 (~84 pages), 1 new + 5 revision/day, backward`);

  console.log('4. Create group + enroll');
  const groupId = await createGroup(teacherId, GROUP_NAME);
  await enroll(teacherId, juniorId, groupId);
  await enroll(teacherId, seniorId, groupId);
  console.log(`  • Group "${GROUP_NAME}" with both students`);

  console.log('5. Seed test history');
  await seedTests('Ahmad ', buildAhmadTests(juniorId, teacherId));
  await seedTests('Yusuf ', buildYusufTests(seniorId, teacherId));

  console.log('6. Season the revision queue');
  await seedStageMachine(juniorId, [601, 602, 603, 604]);
  await seedStageMachine(seniorId, [604, 603, 602, 580, 575, 560, 20, 15]);

  console.log('7. Promote a few of Yusuf’s pages to mastered');
  await promoteSomePagesToMastered(seniorId, [604, 603, 1, 2, 3, 4, 5]);

  console.log('\n=== Done ===');
  console.log('\nDemo credentials (password: ' + PASSWORD + ')');
  console.log(`  Teacher  ${TEACHER.email}`);
  console.log(`  Junior   ${JUNIOR.email}`);
  console.log(`  Senior   ${SENIOR.email}`);
  console.log('');
}

main().catch((err) => {
  console.error('\n[seed] failed:', err);
  process.exit(1);
});
