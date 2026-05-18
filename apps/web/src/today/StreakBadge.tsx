import { Group, Skeleton, Text } from '@mantine/core';
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
    return <Skeleton height={28} width={140} radius="sm" />;
  }

  const streak = data ?? 0;
  return (
    <Group gap={6} align="center">
      <Flame
        size={18}
        color={streak > 0 ? 'var(--mantine-color-honey-5)' : 'var(--mantine-color-gray-5)'}
        strokeWidth={1.75}
      />
      <Text fw={600} size="md">
        {streak} {streak === 1 ? 'day' : 'days'}
      </Text>
      <Text size="sm" c="dimmed">
        streak
      </Text>
    </Group>
  );
}
