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
