import { Group, Progress, Skeleton, Stack, Text, Tooltip } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { quranIndex } from '../data/quran-data';
import { toArabicIndic } from '../lib/numerals';

interface JuzProgressBarProps {
  studentId: string;
}

interface MemorizedPageRow {
  page_number: number;
}

async function fetchMemorizedPages(studentId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('memorization_page')
    .select('page_number')
    .eq('student_id', studentId)
    .in('status', ['memorized', 'mastered']);
  if (error) throw error;
  return ((data as MemorizedPageRow[] | null) ?? []).map((r) => r.page_number);
}

function pageToJuz(page: number): number | null {
  for (const [juzStr, info] of Object.entries(quranIndex.juzs)) {
    const [start, end] = info.pages;
    if (page >= start && page <= end) return Number(juzStr);
  }
  return null;
}

function juzCompletion(pages: number[]): { complete: number; partial: number } {
  const byJuz = new Map<number, number>();
  for (const p of pages) {
    const j = pageToJuz(p);
    if (j === null) continue;
    byJuz.set(j, (byJuz.get(j) ?? 0) + 1);
  }
  let complete = 0;
  let partial = 0;
  for (let j = 1; j <= 30; j++) {
    const info = quranIndex.juzs[String(j)];
    if (!info) continue;
    const [start, end] = info.pages;
    const juzLen = end - start + 1;
    const count = byJuz.get(j) ?? 0;
    if (count >= juzLen) complete += 1;
    else if (count > 0) partial += 1;
  }
  return { complete, partial };
}

export function JuzProgressBar({ studentId }: JuzProgressBarProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['memorized_pages', studentId],
    queryFn: () => fetchMemorizedPages(studentId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <Skeleton height={40} radius="sm" />;
  }

  const pages = data ?? [];
  const { complete, partial } = juzCompletion(pages);
  const completePct = (complete / 30) * 100;
  const partialPct = (partial / 30) * 100;

  return (
    <Stack gap={6}>
      <Group justify="space-between" align="baseline">
        <Text size="sm" c="dimmed">
          Memorized
        </Text>
        <Group gap={6} align="baseline">
          <Text
            component="span"
            size="lg"
            fw={700}
            style={{ fontFamily: 'Amiri, serif', direction: 'rtl' }}
          >
            {toArabicIndic(complete)} / {toArabicIndic(30)}
          </Text>
          <Text size="xs" c="dimmed">
            juz
          </Text>
        </Group>
      </Group>
      <Tooltip
        label={`${complete} complete · ${partial} in progress · ${30 - complete - partial} untouched`}
        position="bottom"
        withArrow
      >
        <Progress.Root size="lg" radius="xl">
          <Progress.Section value={completePct} color="sage.7" />
          <Progress.Section value={partialPct} color="honey.4" />
        </Progress.Root>
      </Tooltip>
    </Stack>
  );
}
