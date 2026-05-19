import { useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Group,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { BookOpenText, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { NextNewLesson } from '@tahfeedh/shared';
import { supabase } from '../lib/supabase';
import { chapter, quranIndex } from '../data/quran-data';
import { toArabicIndic } from '../lib/numerals';
import { EmptySlotCard } from './EmptySlotCard';

interface NewLessonCardProps {
  studentId: string;
}

interface NextLessonRow {
  page_number: number;
  kind: 'continue' | 'begin';
}

async function fetchNextLesson(studentId: string): Promise<NextNewLesson | null> {
  const { data, error } = await supabase.rpc('next_new_lesson', {
    p_student_id: studentId,
  });
  if (error) throw error;
  const rows = (data as NextLessonRow[] | null) ?? [];
  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row) return null;
  return { page_number: row.page_number, kind: row.kind };
}

export function NewLessonCard({ studentId }: NewLessonCardProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['next_new_lesson', studentId],
    queryFn: () => fetchNextLesson(studentId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <Skeleton height={108} radius="md" />;
  }

  if (isError) {
    return (
      <EmptySlotCard
        title="Couldn't load today's new lesson"
        icon={BookOpenText}
        helper="Refresh in a moment, or check that the marking endpoint is reachable."
        accent="sage"
        badge="Phase C"
      />
    );
  }

  if (!data) {
    return (
      <EmptySlotCard
        title="No new lesson — every page is in your mushaf"
        icon={Sparkles}
        helper="The full Quran is memorized. Revision will keep it sound."
        accent="sage"
        badge="Hifz complete"
      />
    );
  }

  const pageInfo = quranIndex.pages[String(data.page_number)];
  const startSurah = pageInfo ? chapter(pageInfo.surah_start) : null;
  const endSurah = pageInfo ? chapter(pageInfo.surah_end) : null;
  const surahLabel =
    startSurah && endSurah && startSurah.id !== endSurah.id
      ? `${startSurah.name_simple} – ${endSurah.name_simple}`
      : (startSurah?.name_simple ?? '');

  const verb = data.kind === 'continue' ? 'Continue' : 'Begin';

  return (
    <Group
      align="stretch"
      wrap="nowrap"
      gap="md"
      p="md"
      style={{
        background: 'var(--mantine-color-parchment-0)',
        borderRadius: 12,
        border: '1px solid rgba(21,53,30,0.08)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background:
            'radial-gradient(circle at 30% 30%, var(--mantine-color-sage-1), var(--mantine-color-sage-4))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(21,53,30,0.10)',
        }}
      >
        <BookOpenText size={26} strokeWidth={1.75} color="var(--mantine-color-mihrab-9)" />
      </div>
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        <Group gap={8} align="center">
          <Badge color="sage.7" variant="filled" radius="sm">
            New lesson
          </Badge>
          {data.kind === 'continue' && (
            <Badge color="honey.5" variant="light" radius="sm">
              In progress
            </Badge>
          )}
        </Group>
        <Text fw={600} size="md">
          {verb} page {data.page_number}
          {surahLabel ? ` · ${surahLabel}` : ''}
        </Text>
        <Text size="xs" c="dimmed" component="div">
          <Text component="span" style={{ fontFamily: 'Amiri, serif' }}>
            صفحة {toArabicIndic(data.page_number)}
          </Text>
          {' — '}
          {data.kind === 'continue'
            ? 'You started this page already; finish the second half today.'
            : "It's the next page past your frontier."}
        </Text>
      </Stack>
      <Button
        color="mihrab.9"
        variant="filled"
        radius="xl"
        onClick={() => navigate({ to: '/mushaf' })}
        style={{ alignSelf: 'center' }}
      >
        Open mushaf
      </Button>
    </Group>
  );
}
