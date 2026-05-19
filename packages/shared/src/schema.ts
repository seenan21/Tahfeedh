import { z } from 'zod';

export const userRoleSchema = z.enum(['student', 'teacher']);

export const testRangeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('page'), start: z.number().int(), end: z.number().int() }),
  z.object({ type: z.literal('surah'), surah: z.number().int() }),
  z.object({
    type: z.literal('ayah'),
    surah: z.number().int(),
    start_ayah: z.number().int(),
    end_ayah: z.number().int(),
  }),
  z.object({ type: z.literal('juz'), juz: z.number().int() }),
  z.object({ type: z.literal('hizb'), hizb: z.number().int() }),
  z.object({ type: z.literal('rub'), rub: z.number().int() }),
]);

export const testRangesSchema = z.array(testRangeSchema).min(1);

// Onboarding finish request (Phase B, DESIGN.md §6.3).
// Client sends user selections; the server expands them against the static
// quran index and calls the commit_onboarding SQL function.

export const hifzDirectionSchema = z.enum(['forward', 'backward']);

export const onboardingFinishSchema = z.object({
  path: z.enum(['fresh', 'partial', 'complete']),
  selections: z.object({
    juzs: z.array(z.number().int().min(1).max(30)).default([]),
    surahs: z
      .array(
        z.object({
          surah: z.number().int().min(1).max(114),
          upToAyah: z.number().int().min(1).optional(),
        }),
      )
      .default([]),
    inProgress: z
      .object({
        juz: z.number().int().min(1).max(30),
        surah: z.number().int().min(1).max(114),
        ayah: z.number().int().min(1),
      })
      .optional(),
  }),
  session: z.object({
    newPerDay: z.number().min(0.5).max(20),
    revisionPerDay: z.number().min(0).max(20),
  }),
  hifzDirection: hifzDirectionSchema.default('forward'),
});

export type OnboardingFinishInput = z.infer<typeof onboardingFinishSchema>;

// (Note: a markMemorizationSchema lived here in Phase C but was removed when
// ADR 0015 reverted to test-driven memorization. The SQL function
// mark_memorization() still exists in the DB, reserved for the post-M8 Edit
// Memorization settings flow — see notes-for-future.md.)

// Phase D — live tests + errors (DESIGN.md §8, §9, §13).

export const testTypeSchema = z.enum(['newly_memorized', 'revision']);
export const testModeSchema = z.enum(['enrolled_teacher', 'guest_teacher']);
export const testRatingSchema = z.enum([
  'strong_pass',
  'pass_needs_practice',
  'excellent',
  'good',
  'needs_work',
  'fail',
]);

export const errorTypeSchema = z.enum([
  'tajweed',
  'pronunciation',
  'omission',
  'addition',
  'mismatch',
  'wrong_verse',
  'forgotten_verse',
  'hesitation',
]);
export const errorSeveritySchema = z.enum(['minor', 'moderate', 'major']);

export const testCreateSchema = z
  .object({
    test_type: testTypeSchema,
    test_mode: testModeSchema,
    ranges: testRangesSchema,
    guest_tester_name: z.string().trim().min(1).max(80).optional(),
  })
  .refine(
    (v) => v.test_mode === 'enrolled_teacher' || !!v.guest_tester_name,
    { message: 'guest_tester_name required for guest_teacher tests', path: ['guest_tester_name'] },
  );

export type TestCreateInput = z.infer<typeof testCreateSchema>;

export const logErrorSchema = z
  .object({
    surah: z.number().int().min(1).max(114),
    ayah: z.number().int().min(1),
    word_position: z.number().int().min(1).optional(),
    word_position_end: z.number().int().min(1).optional(),
    error_type: errorTypeSchema,
    severity: errorSeveritySchema.default('moderate'),
    teacher_note: z.string().trim().max(2000).optional(),
    related_surah: z.number().int().min(1).max(114).optional(),
    related_ayah: z.number().int().min(1).optional(),
  })
  .refine(
    (v) => v.word_position_end == null || (v.word_position != null && v.word_position_end >= v.word_position),
    { message: 'word_position_end requires word_position and must be >=', path: ['word_position_end'] },
  )
  .refine(
    (v) => v.error_type !== 'wrong_verse' || (v.related_surah != null && v.related_ayah != null),
    { message: 'wrong_verse requires related_surah and related_ayah', path: ['related_surah'] },
  );

export type LogErrorInput = z.infer<typeof logErrorSchema>;

export const finishTestSchema = z.object({
  rating: testRatingSchema,
  notes: z.string().trim().max(2000).optional(),
});

export type FinishTestInput = z.infer<typeof finishTestSchema>;
