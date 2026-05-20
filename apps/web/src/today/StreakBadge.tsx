import { Group, Skeleton, Stack, Text, Tooltip } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Flame } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../api/client';

interface StreakBadgeProps {
  studentId: string;
}

interface QfStreakResponse {
  connected: boolean;
  days?: number;
  error?: boolean;
  type?: string | null;
  status?: string | null;
}

async function fetchLocalStreak(studentId: string): Promise<number> {
  const { data, error } = await supabase.rpc('daily_streak', { p_student_id: studentId });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

async function fetchQfStreak(): Promise<QfStreakResponse> {
  try {
    return await apiFetch<QfStreakResponse>('/api/qf-user/streak');
  } catch {
    // Treat any fetch error as "not available" — fall back to local
    return { connected: false };
  }
}

export function StreakBadge({ studentId }: StreakBadgeProps) {
  const localQ = useQuery({
    queryKey: ['daily_streak', studentId],
    queryFn: () => fetchLocalStreak(studentId),
    staleTime: 60_000,
  });
  const qfQ = useQuery({
    queryKey: ['qf-streak', studentId],
    queryFn: fetchQfStreak,
    staleTime: 60_000,
  });

  if (localQ.isLoading) {
    return <Skeleton height={68} width={148} radius="lg" />;
  }

  const useQf =
    qfQ.data?.connected === true && qfQ.data?.error !== true && typeof qfQ.data?.days === 'number';
  const streak = useQf ? qfQ.data!.days! : (localQ.data ?? 0);
  const lit = streak > 0;
  const source: 'qf' | 'local' = useQf ? 'qf' : 'local';

  const sublabel =
    source === 'qf' ? 'via Quran.com' : streak === 1 ? 'day' : 'days';

  const badge = (
    <Group
      gap={12}
      wrap="nowrap"
      align="center"
      style={{
        padding: '10px 16px',
        borderRadius: 16,
        background: lit
          ? source === 'qf'
            ? 'linear-gradient(135deg, color-mix(in srgb, #0E7C5C 18%, white) 0%, white 100%)'
            : 'linear-gradient(135deg, color-mix(in srgb, var(--mantine-color-honey-4) 30%, white) 0%, white 100%)'
          : 'white',
        border: lit
          ? source === 'qf'
            ? '1px solid color-mix(in srgb, #0E7C5C 35%, transparent)'
            : '1px solid color-mix(in srgb, var(--mantine-color-honey-4) 40%, transparent)'
          : '1px solid rgba(21,53,30,0.08)',
        boxShadow: '0 4px 12px -4px rgba(21,53,30,0.18)',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: lit
            ? source === 'qf'
              ? 'linear-gradient(135deg, #0E7C5C 0%, #15351E 100%)'
              : 'linear-gradient(135deg, var(--mantine-color-honey-4) 0%, var(--mantine-color-brick-6) 100%)'
            : 'var(--mantine-color-gray-1)',
        }}
      >
        <Flame
          size={22}
          strokeWidth={2}
          color={lit ? 'white' : 'var(--mantine-color-gray-5)'}
          fill={lit ? 'white' : 'none'}
        />
      </div>
      <Stack gap={0}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={0.6}>
          Streak
        </Text>
        <Group gap={4} align="baseline">
          <Text fw={700} size="xl" lh={1}>
            {streak}
          </Text>
          <Text size="xs" c={source === 'qf' ? '#0E7C5C' : 'dimmed'}>
            {sublabel}
          </Text>
        </Group>
      </Stack>
    </Group>
  );

  if (source === 'qf') {
    return (
      <Tooltip
        label="Showing your Quran.com QURAN streak (synced via the User API)."
        position="bottom"
      >
        {badge}
      </Tooltip>
    );
  }
  return badge;
}
