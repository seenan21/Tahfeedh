import { createFileRoute, redirect } from '@tanstack/react-router';
import { Card, Group, Stack, Text } from '@mantine/core';
import { TrendingUp } from 'lucide-react';
import { homeRouteForRole } from '../lib/auth';
import { ForecastCard } from '../features/progress/ForecastCard';
import { ActivityStatsCard } from '../features/progress/ActivityStatsCard';
import { RevisionHealthGrid } from '../features/progress/RevisionHealthGrid';

export const Route = createFileRoute('/_authed/progress')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: ProgressPage,
});

function ProgressPage() {
  const { user } = Route.useRouteContext();

  return (
    <Stack maw={1080} mx="auto" gap="xl" py="md">
      {/* Hero */}
      <Stack gap={4}>
        <Text size="xs" tt="uppercase" c="parchment.0" fw={700} lts={0.8} style={{ opacity: 0.85 }}>
          <Group gap={6} align="center">
            <TrendingUp size={14} strokeWidth={2.2} />
            Progress
          </Group>
        </Text>
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="lg">
          <Stack gap={0}>
            <Text
              component="h1"
              style={{
                fontFamily: 'Cairo, sans-serif',
                fontWeight: 700,
                fontSize: 32,
                lineHeight: 1.1,
                direction: 'rtl',
                color: 'var(--mantine-color-parchment-0)',
                margin: 0,
              }}
            >
              التقدم
            </Text>
            <Text
              component="h2"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: 24,
                lineHeight: 1.1,
                color: 'var(--mantine-color-parchment-0)',
                margin: 0,
              }}
            >
              Forecast · Revision Health · Activity
            </Text>
          </Stack>
        </Group>
      </Stack>

      {/* Forecast + Activity row */}
      <Group align="stretch" wrap="wrap" gap="xl" grow>
        <Card padding="xl" radius="xl" shadow="xl" style={{ flex: '1 1 360px', minWidth: 320 }}>
          <ForecastCard studentId={user.id} />
        </Card>
        <Card padding="xl" radius="xl" shadow="xl" style={{ flex: '1 1 360px', minWidth: 320 }}>
          <ActivityStatsCard studentId={user.id} />
        </Card>
      </Group>

      {/* Revision health */}
      <Card padding="xl" radius="xl" shadow="xl">
        <RevisionHealthGrid studentId={user.id} />
      </Card>
    </Stack>
  );
}
