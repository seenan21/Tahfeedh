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
});

export type OnboardingFinishInput = z.infer<typeof onboardingFinishSchema>;

// Memorization marking (Phase C, ADR 0012).

export const ayahKeySchema = z.object({
  surah: z.number().int().min(1).max(114),
  ayah: z.number().int().min(1),
});

export const markMemorizationSchema = z
  .object({
    pageNumber: z.number().int().min(1).max(604),
    status: z.enum(['memorized', 'in_progress', 'untouched']),
    verses: z.array(ayahKeySchema).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.status === 'in_progress') {
      if (!val.verses || val.verses.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "verses[] is required and non-empty when status is 'in_progress'",
          path: ['verses'],
        });
      }
    }
  });

export type MarkMemorizationInputParsed = z.infer<typeof markMemorizationSchema>;
