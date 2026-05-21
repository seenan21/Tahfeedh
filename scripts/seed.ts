/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * scripts/seed.ts
 *
 * Demo seed for the Quran Foundation Hackathon submission. Three accounts:
 *
 *   hassan@tahfeedh.app / password123  — Ustaadh Hassan Jameel (teacher)
 *   ahmad@tahfeedh.app  / password123  — Ahmad Saleh, the focal student
 *                                          (memorized JUZ 30 only, pages 582–604;
 *                                           ≥5 distinct error markers per page across
 *                                           every error type, with varied intensities
 *                                           so the heatmap shows a real diagnostic
 *                                           picture)
 *   yusuf@tahfeedh.app  / password123  — Yusuf Bashir, contrast student
 *                                          (memorized juz 1 + juz 30; sparse errors,
 *                                           mostly pass — shows what a clean record
 *                                           looks like in the same UI)
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

// ADR 0046 — pass | repeat (was 6-value). Historical narrative collapses:
// fail/needs_work → repeat; everything else → pass.
type Rating = 'pass' | 'repeat';

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
  display: 'Ahmad Saleh',
  role: 'student' as const,
};
const SENIOR = {
  email: 'yusuf@tahfeedh.app',
  display: 'Yusuf Bashir',
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

// Build a CommitOnboardingPayload from a list of juzs. Pages + ayahReviewStates
// are derived from quran-index.json so the boundary handling matches the rest
// of the app.
function buildJuzPayload(
  juzs: number[],
  newPerDay: number,
  revisionPerDay: number,
): CommitOnboardingPayload {
  const memorizedPages = new Set<number>();
  const ayahKeys = new Set<string>();
  for (const j of juzs) {
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
    newPerDay,
    revisionPerDay,
    hasCompletedQuran: false,
    hifzDirection: 'backward',
  };
}

// Ahmad: only juz 30 (pages 582–604). 0.5 new pages/day + 3 revision/day.
// Direction is backward — traditional Juz Amma first path.
function buildAhmadOnboarding(): CommitOnboardingPayload {
  return buildJuzPayload([30], 0.5, 3);
}

// Yusuf: juz 1 + juz 30. 1 new/day + 5 revision/day. Backward.
function buildYusufOnboarding(): CommitOnboardingPayload {
  return buildJuzPayload([1, 30], 1, 5);
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

// -------------- Ahmad test generator: dense juz 30 history --------------
//
// Goal (per demo brief): every page in juz 30 (582–604) ends up with at least
// 5 distinct error signatures on the heatmap, drawn from all 8 error types
// across word + verse scope, with varied intensities so the overlay shows real
// diagnostic variety:
//   • 2 high-intensity "stubborn" word errors per page (hit 3× across tests
//     — these get the brightest tint + count badge)
//   • 2 mid-intensity word errors (hit 2×)
//   • 1–2 verse-scope errors (1× each — whole-verse band)
//   • 1–2 single-occurrence fresh errors (lowest intensity)
//
// Each page gets 3 tests spaced across ~25 days so the activity sparkline +
// recent-tests list both have content. Ratings drift from `repeat` early to
// `pass` later (the student improves over time on each page).
const NOTE_POOL = [
  'Heavy letter — open the mouth.',
  'Pause clearly here.',
  'Watch the meem sākin.',
  'Read this aloud 3x before next test.',
  'Ghunnah duration short.',
  'Slight overcompensation on the madd.',
  'Skipped this whole verse — review.',
  'Hesitated 4 seconds — review fluency.',
  'Mixed up similar verse from later in the surah.',
  'Watch the qalqalah letter.',
];
const TEST_NOTE_POOL = [
  'Lots of slips on the heavy letters today.',
  'Improving — keep at it.',
  'Strong start, lost focus mid-way.',
  'Review tajweed rules tonight.',
  'Same trouble spots as last week — repeat-listen the audio.',
  'Verse-recall is shaky on this page.',
  'Cleaner than the previous attempt.',
];

interface TroubleSpot extends ErrorSpec {
  // How many of the 3 tests should hit this signature. Drives heatmap intensity.
  hits: number;
}

function makeTroubleSpotsForPage(page: number, ayahs: AyahKey[]): TroubleSpot[] {
  const wordTypes: ErrorType[] = ['tajweed', 'pronunciation', 'omission', 'addition', 'mismatch'];
  const verseTypes: ErrorType[] = ['wrong_verse', 'forgotten_verse', 'hesitation'];
  const used = new Set<string>();
  const out: TroubleSpot[] = [];

  function makeWord(type: ErrorType, hits: number): TroubleSpot | null {
    for (let attempt = 0; attempt < 30; attempt++) {
      const a = ayahs[Math.floor(rng() * ayahs.length)];
      if (!a) continue;
      const wp = between(1, 8);
      const sig = `${a.surah}:${a.ayah}:${wp}:${type}`;
      if (used.has(sig)) continue;
      used.add(sig);
      return {
        surah: a.surah,
        ayah: a.ayah,
        word_position: wp,
        error_type: type,
        teacher_note: rng() < 0.4 ? pick(NOTE_POOL) : null,
        hits,
      };
    }
    return null;
  }
  function makeVerse(type: ErrorType, hits: number): TroubleSpot | null {
    for (let attempt = 0; attempt < 30; attempt++) {
      const a = ayahs[Math.floor(rng() * ayahs.length)];
      if (!a) continue;
      const sig = `${a.surah}:${a.ayah}::${type}`;
      if (used.has(sig)) continue;
      used.add(sig);
      const spot: TroubleSpot = {
        surah: a.surah,
        ayah: a.ayah,
        word_position: null,
        error_type: type,
        teacher_note: rng() < 0.5 ? pick(NOTE_POOL) : null,
        hits,
      };
      if (type === 'wrong_verse') {
        spot.related_surah = a.surah;
        spot.related_ayah = Math.max(1, a.ayah - 1);
      }
      return spot;
    }
    return null;
  }

  // High-intensity word errors (hit in all 3 tests = 3 occurrences each, bright marker).
  const hiTypes = pickTwo(wordTypes);
  for (const t of hiTypes) {
    const s = makeWord(t, 3);
    if (s) out.push(s);
  }
  // Mid-intensity word errors (2 occurrences).
  const midTypes = pickTwo(wordTypes.filter((t) => !hiTypes.includes(t)));
  for (const t of midTypes) {
    const s = makeWord(t, 2);
    if (s) out.push(s);
  }
  // Verse-scope (1 occurrence — whole-verse band).
  const verseChoice = verseTypes[page % verseTypes.length]!;
  const v = makeVerse(verseChoice, 1);
  if (v) out.push(v);
  // A second verse-scope on every third page so most pages have both bands +
  // markers, but not every page.
  if (page % 3 === 0) {
    const altVerse = verseTypes[(page + 1) % verseTypes.length]!;
    const v2 = makeVerse(altVerse, 1);
    if (v2) out.push(v2);
  }
  // Single fresh error to push the distinct-signature count comfortably over 5.
  const freshType = wordTypes[page % wordTypes.length]!;
  const freshSpot = makeWord(freshType, 1);
  if (freshSpot) out.push(freshSpot);

  return out;
}

function pickTwo<T>(arr: T[]): T[] {
  if (arr.length <= 2) return [...arr];
  const i = Math.floor(rng() * arr.length);
  let j = Math.floor(rng() * arr.length);
  while (j === i) j = Math.floor(rng() * arr.length);
  return [arr[i]!, arr[j]!];
}

function buildAhmadTests(studentId: string, teacherId: string): TestSpec[] {
  const tests: TestSpec[] = [];
  // Juz 30 = pages 582–604 = 23 pages.
  const pages: number[] = [];
  for (let p = 582; p <= 604; p++) pages.push(p);

  // Spread 3 tests per page across ~25 days. We stride the page-loop so the
  // activity sparkline isn't all-one-page-then-the-next; days mix across pages.
  let cursor = 25;
  for (const page of pages) {
    const ayahs = pageToAyahKeys(page);
    if (ayahs.length === 0) {
      // Empty page metadata — degenerate, skip entirely (still very rare).
      continue;
    }
    const spots = makeTroubleSpotsForPage(page, ayahs);

    // Assign each spot to a subset of tests by hits count. hits=3 → tests
    // [0,1,2], hits=2 → tests [0,1], hits=1 → tests [0] for early page work.
    // We rotate which test gets the hits=1 entries so newer tests still have
    // entries (otherwise test #3 is empty when only hi-intensity spots cycle).
    const testErrors: ErrorSpec[][] = [[], [], []];
    for (const spot of spots) {
      const { hits, ...err } = spot;
      if (hits >= 3) {
        testErrors[0]!.push({ ...err });
        testErrors[1]!.push({ ...err });
        testErrors[2]!.push({ ...err });
      } else if (hits === 2) {
        // Mid-intensity: hit in test 0 and a coin-flip of (1 or 2).
        testErrors[0]!.push({ ...err });
        testErrors[rng() < 0.5 ? 1 : 2]!.push({ ...err });
      } else {
        // Fresh: hit in exactly one randomly chosen test.
        testErrors[Math.floor(rng() * 3)]!.push({ ...err });
      }
    }

    // Three tests per page, spaced ~3 days apart, with ratings drifting from
    // repeat → pass as the student improves.
    const ratings: Rating[] = ['repeat', 'pass', 'pass'];
    for (let i = 0; i < 3; i++) {
      const daysAgo = Math.max(1, cursor - i * 3);
      tests.push({
        studentId,
        teacherId,
        testType: 'newly_memorized',
        pageStart: page,
        pageEnd: page,
        startedAt: isoDaysAgo(daysAgo, between(9, 17), between(0, 50)),
        durationMinutes: between(11, 22),
        rating: ratings[i]!,
        notes: rng() < 0.4 ? pick(TEST_NOTE_POOL) : null,
        errors: testErrors[i]!,
      });
    }

    // Advance the cursor by 1 day per page so adjacent pages get adjacent
    // first-test dates; this gives the activity sparkline daily density.
    cursor = Math.max(1, cursor - 1);
  }
  return tests;
}

// -------------- Yusuf test generator: clean record, contrast to Ahmad --------------
//
// Yusuf has juz 1 (pages 1–21) + juz 30 (pages 582–604) memorized. He's the
// "clean record" demo — sparse errors, mostly `pass` ratings. 12 revision tests
// spread over 22 days across a representative sample of his pages.
function buildYusufTests(studentId: string, teacherId: string): TestSpec[] {
  const tests: TestSpec[] = [];
  const wordErrTypes: ErrorType[] = ['tajweed', 'pronunciation', 'addition'];
  const yusufNotes = [
    'Sharp recall. Good ghunnah.',
    'Solid revision — flagged 1 letter.',
    'Excellent flow start to finish.',
    'Clean read.',
  ];
  const yusufErrorNotes = [
    'Slight overcompensation on the madd.',
    'Brief slip — clean otherwise.',
    'Watch the qalqalah letter.',
  ];

  const arc: { daysAgo: number; page: number; errors: number; rating: Rating }[] = [
    { daysAgo: 22, page: 604, errors: 1, rating: 'pass' },
    { daysAgo: 20, page: 600, errors: 0, rating: 'pass' },
    { daysAgo: 18, page: 595, errors: 1, rating: 'pass' },
    { daysAgo: 16, page: 590, errors: 0, rating: 'pass' },
    { daysAgo: 14, page: 585, errors: 2, rating: 'pass' },
    { daysAgo: 12, page: 1, errors: 0, rating: 'pass' },
    { daysAgo: 10, page: 5, errors: 1, rating: 'pass' },
    { daysAgo: 8, page: 10, errors: 0, rating: 'pass' },
    { daysAgo: 6, page: 15, errors: 1, rating: 'pass' },
    { daysAgo: 4, page: 20, errors: 0, rating: 'pass' },
    { daysAgo: 2, page: 598, errors: 1, rating: 'pass' },
    { daysAgo: 1, page: 602, errors: 0, rating: 'pass' },
  ];

  for (const t of arc) {
    const ayahs = pageToAyahKeys(t.page);
    const errors: ErrorSpec[] = [];
    if (ayahs.length > 0) {
      for (let i = 0; i < t.errors; i++) {
        const a = pick(ayahs);
        if (!a) continue;
        errors.push({
          surah: a.surah,
          ayah: a.ayah,
          word_position: between(1, 6),
          error_type: pick(wordErrTypes),
          teacher_note: rng() < 0.5 ? pick(yusufErrorNotes) : null,
        });
      }
    }
    tests.push({
      studentId,
      teacherId,
      testType: 'revision',
      pageStart: t.page,
      pageEnd: t.page,
      startedAt: isoDaysAgo(t.daysAgo, between(9, 19), between(0, 50)),
      durationMinutes: between(8, 16),
      rating: t.rating,
      notes: rng() < 0.3 ? pick(yusufNotes) : null,
      errors,
    });
  }
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
// ayahs so the revision queue surfaces realistic recent-revision entries.
// Per ADR 0049, only stages 1 and 2 are valid (CHECK constraint enforces it);
// stage 3 was collapsed into graduation.
// -------------------------------------------------------------------------
async function seedStageMachine(studentId: string, pages: number[]): Promise<void> {
  for (const page of pages) {
    const ayahs = pageToAyahKeys(page);
    if (ayahs.length === 0) continue;
    const stages: Array<{ stage: 1 | 2; readyAtDays: number }> = [
      { stage: 1, readyAtDays: 0 },
      { stage: 2, readyAtDays: 2 },
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
  await commitOnboarding(juniorId, buildAhmadOnboarding());
  console.log(`  • ${JUNIOR.email} — juz 30 only (pages 582–604), 0.5 new + 3 revision/day, backward`);
  await commitOnboarding(seniorId, buildYusufOnboarding());
  console.log(`  • ${SENIOR.email} — juz 1 + juz 30 (~44 pages), 1 new + 5 revision/day, backward`);

  console.log('4. Create group + enroll');
  const groupId = await createGroup(teacherId, GROUP_NAME);
  await enroll(teacherId, juniorId, groupId);
  await enroll(teacherId, seniorId, groupId);
  console.log(`  • Group "${GROUP_NAME}" with both students`);

  console.log('5. Seed test history');
  await seedTests('Ahmad ', buildAhmadTests(juniorId, teacherId));
  await seedTests('Yusuf ', buildYusufTests(seniorId, teacherId));

  console.log('6. Season the revision queue (stages 1 + 2 only per ADR 0049)');
  await seedStageMachine(juniorId, [604, 603, 602, 601, 600, 595, 590, 585]);
  await seedStageMachine(seniorId, [604, 603, 1, 5, 10, 20]);

  console.log('\n=== Done ===');
  console.log('\nDemo credentials (password: ' + PASSWORD + ')');
  console.log(`  Teacher  ${TEACHER.email}  — ${TEACHER.display}`);
  console.log(`  Ahmad    ${JUNIOR.email}   — ${JUNIOR.display} (juz 30 only, heavy error history)`);
  console.log(`  Yusuf    ${SENIOR.email}   — ${SENIOR.display} (juz 1 + 30, sparse errors)`);
  console.log('');
}

main().catch((err) => {
  console.error('\n[seed] failed:', err);
  process.exit(1);
});
