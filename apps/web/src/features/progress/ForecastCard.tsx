import { useMemo } from 'react';
import { Badge, Group, Skeleton, Stack, Text } from '@mantine/core';
import { CalendarCheck2, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { HifzDirection } from '@tahfeedh/shared';
import { supabase } from '../../lib/supabase';
import { quranIndex } from '../../data/quran-data';
import { computeForecast } from './lib/forecast';

interface ForecastCardProps {
  studentId: string;
  // True when the student is viewing their own forecast; false when a teacher
  // is viewing one of their students. Default true preserves the original
  // ADR 0025 callsite contract.
  isOwnView?: boolean;
}

interface MemorizedPageRow {
  page_number: number;
  status: 'in_progress' | 'memorized' | 'mastered';
}

interface SettingsRow {
  pages_per_session_new: number | null;
  hifz_direction: HifzDirection | null;
}

async function fetchPages(studentId: string): Promise<MemorizedPageRow[]> {
  const { data, error } = await supabase
    .from('memorization_page')
    .select('page_number, status')
    .eq('student_id', studentId);
  if (error) throw error;
  return (data as MemorizedPageRow[] | null) ?? [];
}

async function fetchSettings(studentId: string): Promise<SettingsRow> {
  const { data, error } = await supabase
    .from('student_settings')
    .select('pages_per_session_new, hifz_direction')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return (data as SettingsRow | null) ?? { pages_per_session_new: null, hifz_direction: null };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDaysAway(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'in 1 day';
  if (days < 30) return `in ${days} days`;
  const months = Math.round(days / 30);
  if (months < 12) return `in ~${months} mo`;
  const years = Math.round(days / 365);
  return `in ~${years} yr${years === 1 ? '' : 's'}`;
}

export function ForecastCard({ studentId, isOwnView = true }: ForecastCardProps) {
  const { data: pages, isLoading: pagesLoading } = useQuery({
    queryKey: ['memorization_pages', studentId],
    queryFn: () => fetchPages(studentId),
    staleTime: 30_000,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['student_settings', studentId],
    queryFn: () => fetchSettings(studentId),
    staleTime: 60_000,
  });

  const forecast = useMemo(() => {
    if (!pages || !settings) return null;
    const memorizedPageNumbers = new Set<number>();
    for (const r of pages) {
      if (r.status === 'memorized' || r.status === 'mastered') memorizedPageNumbers.add(r.page_number);
    }
    return computeForecast({
      memorizedPageNumbers,
      pagesPerSessionNew: settings.pages_per_session_new ?? 1,
      hifzDirection: settings.hifz_direction ?? 'forward',
      quranIndex,
    });
  }, [pages, settings]);

  const loading = pagesLoading || settingsLoading || !forecast;
  const pace = settings?.pages_per_session_new ?? 1;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Group gap={8} align="center">
          <TrendingUp size={16} color="var(--mantine-color-sage-7)" strokeWidth={2.2} />
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Forecast
          </Text>
        </Group>
        <Badge size="sm" variant="light" color="sage">
          {pace} {pace === 1 ? 'page' : 'pages'}/day
        </Badge>
      </Group>

      {loading ? (
        <Stack gap="sm">
          <Skeleton height={56} radius="md" />
          <Skeleton height={56} radius="md" />
        </Stack>
      ) : forecast.hasCompletedHifz ? (
        <Stack gap={4} py="md" align="center">
          <Text fw={700} fz="lg">
            Hifz complete
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            Every page of the Quran is memorized. Focus on revision and mastery.
          </Text>
        </Stack>
      ) : (
        <Stack gap="sm">
          {/* Next juz */}
          <Group
            justify="space-between"
            align="center"
            p="sm"
            wrap="nowrap"
            style={{
              borderRadius: 12,
              background: 'rgba(214, 235, 200, 0.35)',
              border: '1px solid color-mix(in srgb, var(--mantine-color-sage-7) 14%, transparent)',
            }}
          >
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={600}>
                Next juz · {forecast.nextJuzNumber}
              </Text>
              <Text fw={700} fz="md">
                {formatDate(forecast.nextJuzDate!)}
              </Text>
              <Text size="xs" c="dimmed">
                {forecast.pagesLeftInNextJuz} pages left · {formatDaysAway(forecast.daysToNextJuz)}
              </Text>
            </Stack>
            <CalendarCheck2 size={20} color="var(--mantine-color-sage-7)" strokeWidth={2} />
          </Group>

          {/* Full Quran */}
          <Group
            justify="space-between"
            align="center"
            p="sm"
            wrap="nowrap"
            style={{
              borderRadius: 12,
              background: 'rgba(255, 244, 196, 0.5)',
              border: '1px solid color-mix(in srgb, var(--mantine-color-honey-4) 30%, transparent)',
            }}
          >
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={600}>
                Full Quran
              </Text>
              <Text fw={700} fz="md">
                {formatDate(forecast.fullQuranDate!)}
              </Text>
              <Text size="xs" c="dimmed">
                {604 - forecast.pagesMemorized} pages left · {formatDaysAway(forecast.daysToFullQuran)}
              </Text>
            </Stack>
            <CalendarCheck2 size={20} color="var(--mantine-color-honey-4)" strokeWidth={2} />
          </Group>

          <Text size="xs" c="dimmed" ta="center" mt={4}>
            {isOwnView
              ? `At your configured pace of ${pace} ${pace === 1 ? 'page' : 'pages'}/day. Adjust in Settings.`
              : `Student's configured pace · ${pace} ${pace === 1 ? 'page' : 'pages'}/day. Only the student can change this.`}
          </Text>
        </Stack>
      )}
    </Stack>
  );
}
