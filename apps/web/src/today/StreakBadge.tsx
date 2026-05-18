import { Group, Skeleton, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Flame } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StreakBadgeProps {
  studentId: string;
}

async function fetchStreak(studentId: string): Promise<number> {
  const { data, error } = await supabase.rpc('daily_streak', { p_student_id: studentId });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

export function StreakBadge({ studentId }: StreakBadgeProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['daily_streak', studentId],
    queryFn: () => fetchStreak(studentId),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <Skeleton height={68} width={148} radius="lg" />;
  }

  const streak = data ?? 0;
  const lit = streak > 0;

  return (
    <Group
      gap={12}
      wrap="nowrap"
      align="center"
      style={{
        padding: '10px 16px',
        borderRadius: 16,
        background: lit
          ? 'linear-gradient(135deg, color-mix(in srgb, var(--mantine-color-honey-4) 30%, white) 0%, white 100%)'
          : 'white',
        border: lit
          ? '1px solid color-mix(in srgb, var(--mantine-color-honey-4) 40%, transparent)'
          : '1px solid rgba(21,53,30,0.08)',
        boxShadow: '0 4px 12px -4px rgba(21,53,30,0.18)',
      }}
    >
      <div
        style={{
          width: 44, height: 44, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: lit
            ? 'linear-gradient(135deg, var(--mantine-color-honey-4) 0%, var(--mantine-color-brick-6) 100%)'
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
          <Text size="xs" c="dimmed">
            {streak === 1 ? 'day' : 'days'}
          </Text>
        </Group>
      </Stack>
    </Group>
  );
}
