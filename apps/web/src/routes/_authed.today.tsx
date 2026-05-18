import { createFileRoute, redirect } from '@tanstack/react-router';
import { Card, Divider, Group, Stack, Text } from '@mantine/core';
import { BookOpenText, Repeat2 } from 'lucide-react';
import { homeRouteForRole } from '../lib/auth';
import { BilingualHero } from '../components/BilingualHero';
import { StreakBadge } from '../today/StreakBadge';
import { JuzProgressBar } from '../today/JuzProgressBar';
import { EmptySlotCard } from '../today/EmptySlotCard';

export const Route = createFileRoute('/_authed/today')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: TodayPage,
});

function TodayPage() {
  const { user } = Route.useRouteContext();

  return (
    <Stack maw={760} mx="auto" gap="lg">
      <BilingualHero arabic="اليوم" english="Today" align="start" />

      <Card>
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <Stack gap={0}>
              <Text size="sm" c="dimmed">
                {user.displayName ?? user.email}
              </Text>
              <Text size="xs" c="dimmed">
                Your hifz at a glance
              </Text>
            </Stack>
            <StreakBadge studentId={user.id} />
          </Group>

          <JuzProgressBar studentId={user.id} />

          <Divider />

          <Stack gap="xs">
            <Text fw={600} size="sm" c="dimmed" tt="uppercase" lts={0.5}>
              New lesson
            </Text>
            <EmptySlotCard
              title="Your next page will land here"
              icon={BookOpenText}
              helper="Once Phase C ships the mushaf grid, your next un-memorized page surfaces here."
            />
          </Stack>

          <Stack gap="xs">
            <Text fw={600} size="sm" c="dimmed" tt="uppercase" lts={0.5}>
              Review
            </Text>
            <EmptySlotCard
              title="Today's revision queue"
              icon={Repeat2}
              helper="The algorithm picks your revision pages once Phase D and M5 land."
            />
          </Stack>

          <Text size="sm" c="dimmed" ta="center">
            0 of 0 covered today — the live test flow lights this up in Phase D.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
