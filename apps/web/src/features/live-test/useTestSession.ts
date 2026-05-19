import { useCallback, useState } from 'react';
import type {
  ErrorType,
  ErrorSeverity,
  LogErrorInput,
  PostTestSummary,
  TestRating,
} from '@tahfeedh/shared';
import { apiFetch } from '../../api/client';

/**
 * Local view of an error_log row — what the right-pane streaming list renders.
 * `id` and `signature` come back from the server insert; the rest mirrors what
 * the user picked in the modal.
 */
export interface LoggedError {
  id: string;
  signature: string;
  surah: number;
  ayah: number;
  word_position: number | null;
  word_position_end: number | null;
  error_type: ErrorType;
  severity: ErrorSeverity;
  teacher_note: string | null;
  related_surah: number | null;
  related_ayah: number | null;
  created_at: string;
}

export function useTestSession(testId: string) {
  const [errors, setErrors] = useState<LoggedError[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const logError = useCallback(
    async (input: LogErrorInput) => {
      const res = await apiFetch<{ id: string; signature: string }>(
        `/api/tests/${testId}/error`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      const entry: LoggedError = {
        id: res.id,
        signature: res.signature,
        surah: input.surah,
        ayah: input.ayah,
        word_position: input.word_position ?? null,
        word_position_end: input.word_position_end ?? null,
        error_type: input.error_type,
        severity: input.severity ?? 'moderate',
        teacher_note: input.teacher_note ?? null,
        related_surah: input.related_surah ?? null,
        related_ayah: input.related_ayah ?? null,
        created_at: new Date().toISOString(),
      };
      setErrors((prev) => [...prev, entry]);
      return entry;
    },
    [testId],
  );

  const finishTest = useCallback(
    async (rating: TestRating, notes?: string): Promise<PostTestSummary> => {
      setSubmitting(true);
      try {
        const res = await apiFetch<{ ok: true; summary: PostTestSummary }>(
          `/api/tests/${testId}/finish`,
          {
            method: 'POST',
            body: JSON.stringify({ rating, notes }),
          },
        );
        return res.summary;
      } finally {
        setSubmitting(false);
      }
    },
    [testId],
  );

  return { errors, logError, finishTest, submitting };
}
