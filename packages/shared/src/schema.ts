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
